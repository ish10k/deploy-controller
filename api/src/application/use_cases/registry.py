from src.application.ports import (
    Clock,
    ComponentRepository,
    ReleaseSetRepository,
    DeploymentRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    ReleaseRepository,
    PublisherRepository,
    TagDefinitionRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.deployments import RunnerEligibilityUseCases
from src.domain.enums import ReleaseSetItemSource, ExecutionStatus, ItemStatus, Permission, RequestedAction, TagResourceType
from src.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from src.domain.models import (
    Component,
    ReleaseSet,
    Deployment,
    ReleaseSetCreateRequest,
    ReleaseSetCreateResult,
    ReleaseSetItem,
    Environment,
    EnvironmentState,
    AuthContext,
    Release,
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


class ReleaseSetUseCases:
    def __init__(self, release_sets: ReleaseSetRepository, events: EventLogUseCases | None = None) -> None:
        self.release_sets = release_sets
        self.events = events

    def put(self, release_set: ReleaseSet, context: AuthContext, workspace_id: str = "default") -> ReleaseSet:
        require_permission(context, Permission.RELEASE_SETS_WRITE)
        release_set = release_set.model_copy(update={"workspace_id": workspace_id})
        existing = self.release_sets.get(release_set.release_set_id, workspace_id)
        if existing is None:
            release_set = release_set.model_copy(update={"created_by": context.principal_id})
        self.release_sets.put(release_set)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="release-set.created" if existing is None else "release-set.updated",
                category="registry",
                summary=f"{'Created' if existing is None else 'Updated'} ReleaseSet {release_set.release_set_id}",
                resource_type="release-set",
                resource_id=release_set.release_set_id,
                before=existing,
                after=release_set,
            )
        return release_set

    def get(self, release_set_id: str, workspace_id: str = "default") -> ReleaseSet:
        release_set = self.release_sets.get(release_set_id, workspace_id)
        if release_set is None:
            raise NotFoundError(f"ReleaseSet not found: {release_set_id}")
        return release_set

    def list(self, workspace_id: str = "default") -> list[ReleaseSet]:
        return self.release_sets.list(workspace_id)


class ReleaseUseCases:
    def __init__(self, releases: ReleaseRepository, events: EventLogUseCases | None = None) -> None:
        self.releases = releases
        self.events = events

    def create(self, release: Release, context: AuthContext, workspace_id: str = "default") -> Release:
        require_permission(context, Permission.RELEASES_CREATE)
        release = release.model_copy(update={"workspace_id": workspace_id, "created_by": context.principal_id})
        existing = self.releases.get(release.component_id, release.version, workspace_id)
        if existing is not None:
            if _same(existing, release):
                return existing
            raise ConflictError(
                f"Release already exists with different content: {release.component_id}/{release.version}"
            )
        self.releases.create(release)
        if self.events:
            self.events.append_actor(
                actor_principal_id=release.created_by,
                action="release.created",
                category="release",
                summary=f"Created release {release.component_id} {release.version}",
                resource_type="release",
                resource_id=f"{release.component_id}:{release.version}",
                after=release,
                metadata={"componentId": release.component_id, "version": release.version},
            )
        return release

    def get(self, component_id: str, version: str, workspace_id: str = "default") -> Release:
        release = self.releases.get(component_id, version, workspace_id)
        if release is None:
            raise NotFoundError(f"Release not found: {component_id}/{version}")
        return release

    def list(self, component_id: str | None = None, workspace_id: str = "default") -> list[Release]:
        return self.releases.list_by_component(component_id, workspace_id)


class PublisherUseCases:
    def __init__(
        self,
        *,
        publishers: PublisherRepository,
        releases: ReleaseRepository,
        release_sets: ReleaseSetRepository,
        clock: Clock,
        principals: PrincipalUseCases,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.publishers = publishers
        self.releases = releases
        self.release_sets = release_sets
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

    def publish_release(self, publisher_id: str, release: Release, context: AuthContext, workspace_id: str = "default") -> Release:
        require_permission(context, Permission.PUBLISHERS_PUBLISH)
        publisher = self.get(publisher_id, workspace_id)
        if context.principal_id.startswith("service:") and context.principal_id != publisher.principal_id:
            raise ForbiddenError(f"Publisher token cannot publish for another publisher: {publisher_id}")
        if not publisher.active:
            raise ValidationError(f"Publisher is inactive: {publisher_id}")
        if not self._allows_component(publisher, release.component_id):
            raise ValidationError(f"Publisher scope does not allow component: {release.component_id}")

        release = release.model_copy(update={"workspace_id": workspace_id, "created_by": context.principal_id})
        existing = self.releases.get(release.component_id, release.version, workspace_id)
        if existing is not None:
            if _same(existing, release):
                return existing
            raise ConflictError(
                f"Release already exists with different content: {release.component_id}/{release.version}"
            )
        self.releases.create(release)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="release.published",
                category="release",
                summary=f"Published release {release.component_id} {release.version} from {publisher_id}",
                resource_type="release",
                resource_id=f"{release.component_id}:{release.version}",
                after=release,
                metadata={"publisherId": publisher_id, "componentId": release.component_id, "version": release.version},
            )
        return release

    def _allows_component(self, publisher: Publisher, component_id: str) -> bool:
        scope = publisher.scope
        if not scope.component_ids:
            return True
        if component_id in scope.component_ids:
            return True
        return False


class ReleaseSetUseCases:
    def __init__(
        self,
        *,
        release_sets: ReleaseSetRepository,
        components: ComponentRepository,
        releases: ReleaseRepository,
        executions: DeploymentRepository,
        clock: Clock,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.release_sets = release_sets
        self.components = components
        self.releases = releases
        self.executions = executions
        self.clock = clock
        self.events = events

    def create(self, request: ReleaseSet | ReleaseSetCreateRequest | dict[str, object], context: AuthContext, workspace_id: str = "default") -> ReleaseSetCreateResult:
        require_permission(context, Permission.RELEASE_SETS_CREATE)
        if isinstance(request, dict):
            request = ReleaseSetCreateRequest.model_validate(request)
        if isinstance(request, ReleaseSetCreateRequest):
            request = request.model_copy(update={"created_by": context.principal_id})
        if isinstance(request, ReleaseSet):
            request = request.model_copy(update={"created_by": context.principal_id})
        release_set, warnings = self._expand(request, workspace_id)
        existing = self.release_sets.get(release_set.release_set_id, workspace_id)
        if existing is not None:
            if _same(existing, release_set):
                return ReleaseSetCreateResult(release_set=existing, warnings=warnings)
            raise ConflictError(f"ReleaseSet already exists with different content: {release_set.release_set_id}")
        self.release_sets.create(release_set)
        if self.events:
            self.events.append_actor(
                actor_principal_id=release_set.created_by,
                action="release-set.created",
                category="deployment",
                summary=f"Created ReleaseSet {release_set.release_set_id}",
                resource_type="release-set",
                resource_id=release_set.release_set_id,
                after=release_set,
                metadata={"warnings": warnings},
            )
        return ReleaseSetCreateResult(release_set=release_set, warnings=warnings)

    def _expand(self, request: ReleaseSet | ReleaseSetCreateRequest, workspace_id: str) -> tuple[ReleaseSet, list[str]]:
        if isinstance(request, ReleaseSet):
            request = request.model_copy(update={"workspace_id": workspace_id})
            self._validate_complete(request, workspace_id)
            return request, []

        active_component_ids = [component.component_id for component in self.components.list(workspace_id) if component.active]
        active_component_id_set = set(active_component_ids)
        explicit_versions = {item.component_id: item.version for item in request.items if item.component_id in active_component_id_set}
        missing = [component_id for component_id in active_component_ids if component_id not in explicit_versions]
        inferred_versions: dict[str, str] = {}

        if missing:
            if request.base_release_set_id is None and request.base_environment_id is None:
                raise ValidationError("baseEnvironmentId or baseReleaseSetId is required when active components are missing")
            inferred_versions = self._infer_versions(
                missing=missing,
                base_release_set_id=request.base_release_set_id,
                base_environment_id=request.base_environment_id,
                workspace_id=workspace_id,
            )

        items = [
            ReleaseSetItem(
                component_id=component_id,
                version=explicit_versions[component_id],
                source=ReleaseSetItemSource.EXPLICIT,
            )
            for component_id in active_component_ids
            if component_id in explicit_versions
        ]
        items.extend(
            ReleaseSetItem(
                component_id=component_id,
                version=inferred_versions[component_id],
                source=ReleaseSetItemSource.INFERRED,
            )
            for component_id in missing
        )
        self._validate_releases(items, workspace_id)
        warnings = []
        if inferred_versions:
            source = (
                f"baseReleaseSetId={request.base_release_set_id}"
                if request.base_release_set_id is not None
                else f"baseEnvironmentId={request.base_environment_id}"
            )
            warnings.append(
                f"{len(inferred_versions)} component versions were inferred from {source}. "
                "Fully explicit ReleaseSets are recommended."
            )

        return (
            ReleaseSet(
                workspace_id=workspace_id,
                release_set_id=request.release_set_id,
                schema_version=1,
                notes=request.notes,
                base_environment_id=request.base_environment_id,
                base_release_set_id=request.base_release_set_id,
                items=items,
                created_at=self.clock.now(),
                created_by=request.created_by,
                tags=request.tags,
            ),
            warnings,
        )

    def _infer_versions(
        self,
        *,
        missing: list[str],
        base_release_set_id: str | None,
        base_environment_id: str | None,
        workspace_id: str,
    ) -> dict[str, str]:
        if base_release_set_id is not None:
            base = self.release_sets.get(base_release_set_id, workspace_id)
            if base is None:
                raise NotFoundError(f"Base ReleaseSet not found: {base_release_set_id}")
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

    def _validate_complete(self, release_set: ReleaseSet, workspace_id: str) -> None:
        active_component_ids = [component.component_id for component in self.components.list(workspace_id) if component.active]
        present = {item.component_id for item in release_set.items if item.component_id in active_component_ids}
        missing = sorted(component_id for component_id in active_component_ids if component_id not in present)
        if missing:
            raise ValidationError(f"ReleaseSet is missing active components: {', '.join(missing)}")
        self._validate_releases([item for item in release_set.items if item.component_id in active_component_ids], workspace_id)

    def _validate_releases(self, items: list[ReleaseSetItem], workspace_id: str) -> None:
        for item in items:
            if self.releases.get(item.component_id, item.version, workspace_id) is None:
                raise NotFoundError(f"Release not found: {item.component_id}/{item.version}")

    def get(self, release_set_id: str, workspace_id: str = "default") -> ReleaseSet:
        release_set = self.release_sets.get(release_set_id, workspace_id)
        if release_set is None:
            raise NotFoundError(f"ReleaseSet not found: {release_set_id}")
        return release_set

    def list(self, workspace_id: str = "default") -> list[ReleaseSet]:
        return self.release_sets.list(workspace_id)


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

