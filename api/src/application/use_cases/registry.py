from src.application.ports import (
    Clock,
    ComponentRepository,
    ReleaseRepository,
    DeploymentRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    ComponentVersionRepository,
    PublisherRepository,
    TagDefinitionRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.deployments import RunnerEligibilityUseCases
from src.domain.enums import ReleaseItemSource, ExecutionStatus, ItemStatus, Permission, RequestedAction, TagResourceType
from src.domain.errors import ConflictError, NotFoundError, ValidationError
from src.domain.models import (
    Component,
    Release,
    Deployment,
    ReleaseCreateRequest,
    ReleaseCreateResult,
    ReleaseItem,
    Environment,
    EnvironmentState,
    AuthContext,
    ComponentVersion,
    ComponentVersionCreateRequest,
    Publisher,
    PublisherCreateRequest,
    PublisherCreateResult,
    TagDefinition,
    RotateTokenResult,
)
from src.application.use_cases.credentials import issue_pat
from src.application.use_cases.identity import PrincipalUseCases


def _same(left: object, right: object) -> bool:
    return left == right


class ComponentUseCases:
    def __init__(self, components: ComponentRepository, events: EventLogUseCases | None = None) -> None:
        self.components = components
        self.events = events

    def put(self, component: Component, context: AuthContext, workspace_id: str = "default") -> Component:
        require_permission(context, Permission.COMPONENTS_WRITE)
        component = component.model_copy(update={"workspace_id": workspace_id})
        existing = self.components.get(component.component_id, workspace_id)
        self.components.put(component)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="component.created" if existing is None else "component.updated",
                category="registry",
                summary=f"{'Created' if existing is None else 'Updated'} component {component.component_id}",
                resource_type="component",
                resource_id=component.component_id,
                before=existing,
                after=component,
            )
        return component

    def get(self, component_id: str, workspace_id: str = "default") -> Component:
        component = self.components.get(component_id, workspace_id)
        if component is None:
            raise NotFoundError(f"Component not found: {component_id}")
        return component

    def list(self, workspace_id: str = "default") -> list[Component]:
        return self.components.list(workspace_id)


class ReleaseUseCases:
    def __init__(self, releases: ReleaseRepository, events: EventLogUseCases | None = None) -> None:
        self.releases = releases
        self.events = events

    def put(self, release: Release, context: AuthContext, workspace_id: str = "default") -> Release:
        require_permission(context, Permission.RELEASES_WRITE)
        release = release.model_copy(update={"workspace_id": workspace_id})
        existing = self.releases.get(release.release_id, workspace_id)
        if existing is None:
            release = release.model_copy(update={"created_by": context.principal_id})
        self.releases.put(release)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="release.created" if existing is None else "release.updated",
                category="registry",
                summary=f"{'Created' if existing is None else 'Updated'} Release {release.release_id}",
                resource_type="release",
                resource_id=release.release_id,
                before=existing,
                after=release,
            )
        return release

    def get(self, release_id: str, workspace_id: str = "default") -> Release:
        release = self.releases.get(release_id, workspace_id)
        if release is None:
            raise NotFoundError(f"Release not found: {release_id}")
        return release

    def list(self, workspace_id: str = "default") -> list[Release]:
        return self.releases.list(workspace_id)


class ComponentVersionUseCases:
    def __init__(self, versions: ComponentVersionRepository, clock: Clock, events: EventLogUseCases | None = None) -> None:
        self.versions = versions
        self.clock = clock
        self.events = events

    def create(self, request: ComponentVersion | ComponentVersionCreateRequest | dict[str, object], context: AuthContext, workspace_id: str = "default") -> ComponentVersion:
        require_permission(context, Permission.VERSIONS_CREATE)
        if isinstance(request, dict):
            request = ComponentVersionCreateRequest.model_validate(request)
        if isinstance(request, ComponentVersion):
            create_request = ComponentVersionCreateRequest(
                componentId=request.component_id,
                version=request.version,
                description=request.description,
                notes=request.notes,
                artifact=request.artifact,
                source=request.source,
                tags=request.tags,
            )
        else:
            create_request = request
        existing = self.versions.get(create_request.component_id, create_request.version, workspace_id)
        component_version = ComponentVersion(
            workspaceId=workspace_id,
            componentId=create_request.component_id,
            version=create_request.version,
            description=create_request.description,
            notes=create_request.notes,
            artifact=create_request.artifact,
            source=create_request.source,
            createdAt=existing.created_at if existing is not None else self.clock.now(),
            createdBy=context.principal_id,
            tags=create_request.tags,
        )
        if existing is not None:
            if _same(existing, component_version):
                return existing
            raise ConflictError(
                f"Version already exists with different content: {component_version.component_id}/{component_version.version}"
            )
        self.versions.create(component_version)
        if self.events:
            self.events.append_actor(
                actor_principal_id=component_version.created_by,
                action="version.created",
                category="version",
                summary=f"Created version {component_version.component_id} {component_version.version}",
                resource_type="version",
                resource_id=f"{component_version.component_id}:{component_version.version}",
                after=component_version,
                metadata={"componentId": component_version.component_id, "version": component_version.version},
            )
        return component_version

    def get(self, component_id: str, version: str, workspace_id: str = "default") -> ComponentVersion:
        component_version = self.versions.get(component_id, version, workspace_id)
        if component_version is None:
            raise NotFoundError(f"Version not found: {component_id}/{version}")
        return component_version

    def list(self, component_id: str | None = None, workspace_id: str = "default") -> list[ComponentVersion]:
        return self.versions.list_by_component(component_id, workspace_id)


class PublisherUseCases:
    def __init__(
        self,
        *,
        publishers: PublisherRepository,
        clock: Clock,
        principals: PrincipalUseCases,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.publishers = publishers
        self.clock = clock
        self.principals = principals
        self.events = events

    def create(self, request: PublisherCreateRequest, context: AuthContext, workspace_id: str = "default") -> PublisherCreateResult:
        require_permission(context, Permission.PUBLISHERS_WRITE)
        existing = self.publishers.get(request.publisher_id, workspace_id)
        if existing is not None:
            raise ConflictError(f"Publisher already exists: {request.publisher_id}")
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        publisher = Publisher(
            workspace_id=workspace_id,
            publisher_id=request.publisher_id,
            display_name=request.display_name,
            principal_id=f"service:workspace:{workspace_id}:publisher:{request.publisher_id}",
            auth_method="pat",
            token_hash=token_hash,
            token_prefix=token_prefix,
            token_created_at=now,
            token_rotated_at=None,
            last_used_at=None,
            active=request.active,
            scope=request.scope,
            tags=request.tags,
            created_at=now,
            created_by=context.principal_id,
        )
        self.principals.ensure_service_principal(
            principal_id=publisher.principal_id,
            display_name=publisher.display_name,
            role="publisher",
            created_by="system:publisher-create",
            tags=publisher.tags,
        )
        self.publishers.put(publisher)
        if self.events:
            self.events.append_actor(
                actor_principal_id=publisher.created_by,
                action="publisher.created",
                category="integration",
                summary=f"Created publisher {publisher.publisher_id}",
                resource_type="publisher",
                resource_id=publisher.publisher_id,
                after=publisher,
            )
        return PublisherCreateResult(publisher=publisher, token=token)

    def put(self, publisher: Publisher, context: AuthContext, workspace_id: str = "default") -> Publisher:
        require_permission(context, Permission.PUBLISHERS_WRITE)
        publisher = publisher.model_copy(update={"workspace_id": workspace_id})
        existing = self.publishers.get(publisher.publisher_id, workspace_id)
        if existing is None:
            publisher = publisher.model_copy(update={"created_by": context.principal_id})
        self.publishers.put(publisher)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="publisher.updated",
                category="integration",
                summary=f"Updated publisher {publisher.publisher_id}",
                resource_type="publisher",
                resource_id=publisher.publisher_id,
                before=existing,
                after=publisher,
            )
        return publisher

    def get(self, publisher_id: str, workspace_id: str = "default") -> Publisher:
        publisher = self.publishers.get(publisher_id, workspace_id)
        if publisher is None:
            raise NotFoundError(f"Publisher not found: {publisher_id}")
        return publisher

    def list(self, workspace_id: str = "default") -> list[Publisher]:
        return self.publishers.list(workspace_id)

    def rotate_token(self, publisher_id: str, context: AuthContext, workspace_id: str = "default") -> RotateTokenResult:
        require_permission(context, Permission.PUBLISHERS_WRITE)
        publisher = self.get(publisher_id, workspace_id)
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        updated = publisher.model_copy(
            update={
                "auth_method": "pat",
                "token_hash": token_hash,
                "token_prefix": token_prefix,
                "token_created_at": publisher.token_created_at or now,
                "token_rotated_at": now,
            }
        )
        self.publishers.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="publisher.token_rotated",
                category="security",
                summary=f"Rotated token for publisher {publisher_id}",
                resource_type="publisher",
                resource_id=publisher_id,
                before=publisher,
                after=updated,
                metadata={"tokenPrefix": updated.token_prefix, "tokenRotatedAt": updated.token_rotated_at},
            )
        return RotateTokenResult(token=token)

class ReleaseUseCases:
    def __init__(
        self,
        *,
        releases: ReleaseRepository,
        components: ComponentRepository,
        versions: ComponentVersionRepository,
        executions: DeploymentRepository,
        clock: Clock,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.releases = releases
        self.components = components
        self.versions = versions
        self.executions = executions
        self.clock = clock
        self.events = events

    def create(self, request: Release | ReleaseCreateRequest | dict[str, object], context: AuthContext, workspace_id: str = "default") -> ReleaseCreateResult:
        require_permission(context, Permission.RELEASES_CREATE)
        if isinstance(request, dict):
            request = ReleaseCreateRequest.model_validate(request)
        if isinstance(request, Release):
            request = request.model_copy(update={"created_by": context.principal_id})
        release, warnings = self._expand(request, workspace_id, context.principal_id)
        existing = self.releases.get(release.release_id, workspace_id)
        if existing is not None:
            if _same(existing, release):
                return ReleaseCreateResult(release=existing, warnings=warnings)
            raise ConflictError(f"Release already exists with different content: {release.release_id}")
        self.releases.create(release)
        if self.events:
            self.events.append_actor(
                actor_principal_id=release.created_by,
                action="release.created",
                category="deployment",
                summary=f"Created Release {release.release_id}",
                resource_type="release",
                resource_id=release.release_id,
                after=release,
                metadata={"warnings": warnings},
            )
        return ReleaseCreateResult(release=release, warnings=warnings)

    def _expand(self, request: Release | ReleaseCreateRequest, workspace_id: str, created_by: str) -> tuple[Release, list[str]]:
        if isinstance(request, Release):
            request = request.model_copy(update={"workspace_id": workspace_id})
            self._validate_complete(request, workspace_id)
            return request, []

        active_component_ids = [component.component_id for component in self.components.list(workspace_id) if component.active]
        active_component_id_set = set(active_component_ids)
        explicit_versions = {item.component_id: item.version for item in request.items if item.component_id in active_component_id_set}
        missing = [component_id for component_id in active_component_ids if component_id not in explicit_versions]
        inferred_versions: dict[str, str] = {}

        if missing:
            if request.base_release_id is None and request.base_environment_id is None:
                raise ValidationError("baseEnvironmentId or baseReleaseId is required when active components are missing")
            inferred_versions = self._infer_versions(
                missing=missing,
                base_release_id=request.base_release_id,
                base_environment_id=request.base_environment_id,
                workspace_id=workspace_id,
            )

        items = [
            ReleaseItem(
                component_id=component_id,
                version=explicit_versions[component_id],
                source=ReleaseItemSource.EXPLICIT,
            )
            for component_id in active_component_ids
            if component_id in explicit_versions
        ]
        items.extend(
            ReleaseItem(
                component_id=component_id,
                version=inferred_versions[component_id],
                source=ReleaseItemSource.INFERRED,
            )
            for component_id in missing
        )
        self._validate_versions(items, workspace_id)
        warnings = []
        if inferred_versions:
            source = (
                f"baseReleaseId={request.base_release_id}"
                if request.base_release_id is not None
                else f"baseEnvironmentId={request.base_environment_id}"
            )
            warnings.append(
                f"{len(inferred_versions)} component versions were inferred from {source}. "
                "Fully explicit Releases are recommended."
            )

        return (
            Release(
                workspace_id=workspace_id,
                release_id=request.release_id,
                schema_version=1,
                notes=request.notes,
                base_environment_id=request.base_environment_id,
                base_release_id=request.base_release_id,
                items=items,
                created_at=self.clock.now(),
                created_by=created_by,
                tags=request.tags,
            ),
            warnings,
        )

    def _infer_versions(
        self,
        *,
        missing: list[str],
        base_release_id: str | None,
        base_environment_id: str | None,
        workspace_id: str,
    ) -> dict[str, str]:
        if base_release_id is not None:
            base = self.releases.get(base_release_id, workspace_id)
            if base is None:
                raise NotFoundError(f"Base Release not found: {base_release_id}")
            base_versions = {item.component_id: item.version for item in base.items}
        else:
            executions = self.executions.list_by_environment(base_environment_id, workspace_id)
            successful = next(
                (execution for execution in executions if execution.status == ExecutionStatus.SUCCEEDED),
                None,
            )
            if successful is None:
                raise ValidationError(f"No successful deployment state found for environment: {base_environment_id}")
            base_versions = {
                item.component_id: item.version
                for item in successful.items
                if item.status == ItemStatus.SUCCEEDED and item.requested_action == RequestedAction.DEPLOY
            }

        inferred = {}
        for component_id in missing:
            version = base_versions.get(component_id)
            if version is None:
                raise ValidationError(f"Could not infer version for component: {component_id}")
            inferred[component_id] = version
        return inferred

    def _validate_complete(self, release: Release, workspace_id: str) -> None:
        active_component_ids = [component.component_id for component in self.components.list(workspace_id) if component.active]
        present = {item.component_id for item in release.items if item.component_id in active_component_ids}
        missing = sorted(component_id for component_id in active_component_ids if component_id not in present)
        if missing:
            raise ValidationError(f"Release is missing active components: {', '.join(missing)}")
        self._validate_versions([item for item in release.items if item.component_id in active_component_ids], workspace_id)

    def _validate_versions(self, items: list[ReleaseItem], workspace_id: str) -> None:
        for item in items:
            if self.versions.get(item.component_id, item.version, workspace_id) is None:
                raise NotFoundError(f"Version not found: {item.component_id}/{item.version}")

    def get(self, release_id: str, workspace_id: str = "default") -> Release:
        release = self.releases.get(release_id, workspace_id)
        if release is None:
            raise NotFoundError(f"Release not found: {release_id}")
        return release

    def list(self, workspace_id: str = "default") -> list[Release]:
        return self.releases.list(workspace_id)


class EnvironmentUseCases:
    def __init__(self, environments: EnvironmentRepository, events: EventLogUseCases | None = None) -> None:
        self.environments = environments
        self.events = events

    def put(self, environment: Environment, context: AuthContext, workspace_id: str = "default") -> Environment:
        require_permission(context, Permission.ENVIRONMENTS_WRITE)
        environment = environment.model_copy(update={"workspace_id": workspace_id})
        existing = self.environments.get(environment.environment_id, workspace_id)
        self.environments.put(environment)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="environment.created" if existing is None else "environment.updated",
                category="environment",
                summary=f"{'Created' if existing is None else 'Updated'} environment {environment.environment_id}",
                resource_type="environment",
                resource_id=environment.environment_id,
                before=existing,
                after=environment,
            )
        return environment

    def get(self, environment_id: str, workspace_id: str = "default") -> Environment:
        environment = self.environments.get(environment_id, workspace_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        return environment

    def list(self, workspace_id: str = "default") -> list[Environment]:
        return self.environments.list(workspace_id)


class TagDefinitionUseCases:
    def __init__(self, tag_definitions: TagDefinitionRepository) -> None:
        self.tag_definitions = tag_definitions

    def list(
        self,
        context: AuthContext,
        workspace_id: str = "default",
        resource_type: TagResourceType | None = None,
    ) -> list[TagDefinition]:
        require_permission(context, Permission.TAG_DEFINITIONS_READ)
        definitions = self.tag_definitions.list(workspace_id)
        if resource_type is None:
            return definitions
        return [definition for definition in definitions if resource_type in definition.selector.resource_types]


class ReadOnlyUseCases:
    def __init__(
        self,
        states: EnvironmentStateRepository,
        executions: DeploymentRepository,
        runner_eligibility: RunnerEligibilityUseCases,
    ) -> None:
        self.states = states
        self.executions = executions
        self.runner_eligibility = runner_eligibility

    def get_environment_state(self, environment_id: str, workspace_id: str = "default") -> EnvironmentState:
        state = self.states.get(environment_id, workspace_id)
        if state is None:
            raise NotFoundError(f"EnvironmentState not found: {environment_id}")
        return state

    def list_environment_states(self, workspace_id: str = "default") -> list[EnvironmentState]:
        return self.states.list(workspace_id)

    def get_deployment_execution(self, deployment_id: str, workspace_id: str = "default") -> Deployment:
        execution = self.executions.get(deployment_id, workspace_id)
        if execution is None:
            raise NotFoundError(f"Deployment not found: {deployment_id}")
        return self.runner_eligibility.decorate_execution(execution, workspace_id)

    def list_deployment_executions(self, environment_id: str | None = None, workspace_id: str = "default") -> list[Deployment]:
        return [self.runner_eligibility.decorate_execution(execution, workspace_id) for execution in self.executions.list_by_environment(environment_id, workspace_id)]

    def list_pending_deployment_executions(self, workspace_id: str = "default") -> list[Deployment]:
        return self.executions.list_pending(workspace_id)
