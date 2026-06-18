from src.application.ports import (
    Clock,
    ComponentRepository,
    ComponentSetRepository,
    DeploymentExecutionRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    ReleaseRepository,
    ReleaseSourceRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.domain.enums import DeploySetItemSource, ExecutionStatus, ItemStatus, Permission, RequestedAction
from src.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploySet,
    DeploySetCreateRequest,
    DeploySetCreateResult,
    DeploySetItem,
    Environment,
    EnvironmentState,
    AuthContext,
    Release,
    ReleaseSource,
    ReleaseSourceCreateRequest,
    ReleaseSourceCreateResult,
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


class ComponentSetUseCases:
    def __init__(self, component_sets: ComponentSetRepository, events: EventLogUseCases | None = None) -> None:
        self.component_sets = component_sets
        self.events = events

    def put(self, component_set: ComponentSet, context: AuthContext, workspace_id: str = "default") -> ComponentSet:
        require_permission(context, Permission.COMPONENT_SETS_WRITE)
        component_set = component_set.model_copy(update={"workspace_id": workspace_id})
        existing = self.component_sets.get(component_set.component_set_id, workspace_id)
        if existing is None:
            component_set = component_set.model_copy(update={"created_by": context.principal_id})
        self.component_sets.put(component_set)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="component_set.created" if existing is None else "component_set.updated",
                category="registry",
                summary=f"{'Created' if existing is None else 'Updated'} ComponentSet {component_set.component_set_id}",
                resource_type="componentSet",
                resource_id=component_set.component_set_id,
                before=existing,
                after=component_set,
            )
        return component_set

    def get(self, component_set_id: str, workspace_id: str = "default") -> ComponentSet:
        component_set = self.component_sets.get(component_set_id, workspace_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {component_set_id}")
        return component_set

    def list(self, workspace_id: str = "default") -> list[ComponentSet]:
        return self.component_sets.list(workspace_id)


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


class ReleaseSourceUseCases:
    def __init__(
        self,
        *,
        release_sources: ReleaseSourceRepository,
        releases: ReleaseRepository,
        component_sets: ComponentSetRepository,
        clock: Clock,
        principals: PrincipalUseCases,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.release_sources = release_sources
        self.releases = releases
        self.component_sets = component_sets
        self.clock = clock
        self.principals = principals
        self.events = events

    def create(self, request: ReleaseSourceCreateRequest, context: AuthContext, workspace_id: str = "default") -> ReleaseSourceCreateResult:
        require_permission(context, Permission.RELEASE_SOURCES_WRITE)
        existing = self.release_sources.get(request.release_source_id, workspace_id)
        if existing is not None:
            raise ConflictError(f"ReleaseSource already exists: {request.release_source_id}")
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        release_source = ReleaseSource(
            workspace_id=workspace_id,
            release_source_id=request.release_source_id,
            display_name=request.display_name,
            principal_id=f"service:workspace:{workspace_id}:release-source:{request.release_source_id}",
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
            principal_id=release_source.principal_id,
            display_name=release_source.display_name,
            role="release-source",
            created_by="system:release-source-create",
            tags=release_source.tags,
        )
        self.release_sources.put(release_source)
        if self.events:
            self.events.append_actor(
                actor_principal_id=release_source.created_by,
                action="release_source.created",
                category="integration",
                summary=f"Created release source {release_source.release_source_id}",
                resource_type="releaseSource",
                resource_id=release_source.release_source_id,
                after=release_source,
            )
        return ReleaseSourceCreateResult(release_source=release_source, token=token)

    def put(self, release_source: ReleaseSource, context: AuthContext, workspace_id: str = "default") -> ReleaseSource:
        require_permission(context, Permission.RELEASE_SOURCES_WRITE)
        release_source = release_source.model_copy(update={"workspace_id": workspace_id})
        existing = self.release_sources.get(release_source.release_source_id, workspace_id)
        if existing is None:
            release_source = release_source.model_copy(update={"created_by": context.principal_id})
        self.release_sources.put(release_source)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="release_source.updated",
                category="integration",
                summary=f"Updated release source {release_source.release_source_id}",
                resource_type="releaseSource",
                resource_id=release_source.release_source_id,
                before=existing,
                after=release_source,
            )
        return release_source

    def get(self, release_source_id: str, workspace_id: str = "default") -> ReleaseSource:
        release_source = self.release_sources.get(release_source_id, workspace_id)
        if release_source is None:
            raise NotFoundError(f"ReleaseSource not found: {release_source_id}")
        return release_source

    def list(self, workspace_id: str = "default") -> list[ReleaseSource]:
        return self.release_sources.list(workspace_id)

    def rotate_token(self, release_source_id: str, context: AuthContext, workspace_id: str = "default") -> RotateTokenResult:
        require_permission(context, Permission.RELEASE_SOURCES_WRITE)
        release_source = self.get(release_source_id, workspace_id)
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        updated = release_source.model_copy(
            update={
                "auth_method": "pat",
                "token_hash": token_hash,
                "token_prefix": token_prefix,
                "token_created_at": release_source.token_created_at or now,
                "token_rotated_at": now,
            }
        )
        self.release_sources.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="release_source.token_rotated",
                category="security",
                summary=f"Rotated token for release source {release_source_id}",
                resource_type="releaseSource",
                resource_id=release_source_id,
                before=release_source,
                after=updated,
                metadata={"tokenPrefix": updated.token_prefix, "tokenRotatedAt": updated.token_rotated_at},
            )
        return RotateTokenResult(token=token)

    def publish_release(self, release_source_id: str, release: Release, context: AuthContext, workspace_id: str = "default") -> Release:
        require_permission(context, Permission.RELEASE_SOURCES_PUBLISH)
        release_source = self.get(release_source_id, workspace_id)
        if context.principal_id.startswith("service:") and context.principal_id != release_source.principal_id:
            raise ForbiddenError(f"ReleaseSource token cannot publish for another source: {release_source_id}")
        if not release_source.active:
            raise ValidationError(f"ReleaseSource is inactive: {release_source_id}")
        if not self._allows_component(release_source, release.component_id):
            raise ValidationError(f"ReleaseSource scope does not allow component: {release.component_id}")

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
                summary=f"Published release {release.component_id} {release.version} from {release_source_id}",
                resource_type="release",
                resource_id=f"{release.component_id}:{release.version}",
                after=release,
                metadata={"releaseSourceId": release_source_id, "componentId": release.component_id, "version": release.version},
            )
        return release

    def _allows_component(self, release_source: ReleaseSource, component_id: str) -> bool:
        scope = release_source.scope
        if not scope.component_ids and not scope.component_set_ids:
            return True
        if component_id in scope.component_ids:
            return True
        for component_set_id in scope.component_set_ids:
            component_set = self.component_sets.get(component_set_id, release_source.workspace_id)
            if component_set and any(item.component_id == component_id for item in component_set.components):
                return True
        return False


class DeploySetUseCases:
    def __init__(
        self,
        *,
        deploysets: DeploySetRepository,
        component_sets: ComponentSetRepository,
        releases: ReleaseRepository,
        executions: DeploymentExecutionRepository,
        clock: Clock,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.deploysets = deploysets
        self.component_sets = component_sets
        self.releases = releases
        self.executions = executions
        self.clock = clock
        self.events = events

    def create(self, request: DeploySet | DeploySetCreateRequest | dict[str, object], context: AuthContext, workspace_id: str = "default") -> DeploySetCreateResult:
        require_permission(context, Permission.DEPSETS_CREATE)
        if isinstance(request, dict):
            request = DeploySetCreateRequest.model_validate(request)
        if isinstance(request, DeploySetCreateRequest):
            request = request.model_copy(update={"created_by": context.principal_id})
        if isinstance(request, DeploySet):
            request = request.model_copy(update={"created_by": context.principal_id})
        deployset, warnings = self._expand(request, workspace_id)
        existing = self.deploysets.get(deployset.deployset_id, workspace_id)
        if existing is not None:
            if _same(existing, deployset):
                return DeploySetCreateResult(deployset=existing, warnings=warnings)
            raise ConflictError(f"DeploySet already exists with different content: {deployset.deployset_id}")
        self.deploysets.create(deployset)
        if self.events:
            self.events.append_actor(
                actor_principal_id=deployset.created_by,
                action="deployset.created",
                category="deployment",
                summary=f"Created DeploySet {deployset.deployset_id}",
                resource_type="deployset",
                resource_id=deployset.deployset_id,
                after=deployset,
                metadata={"warnings": warnings},
            )
        return DeploySetCreateResult(deployset=deployset, warnings=warnings)

    def _expand(self, request: DeploySet | DeploySetCreateRequest, workspace_id: str) -> tuple[DeploySet, list[str]]:
        if isinstance(request, DeploySet):
            request = request.model_copy(update={"workspace_id": workspace_id})
            self._validate_complete(request, workspace_id)
            return request, []

        component_set = self.component_sets.get(request.component_set_id, workspace_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {request.component_set_id}")

        component_ids = [item.component_id for item in component_set.components]
        component_id_set = set(component_ids)
        explicit_versions = {item.component_id: item.version for item in request.items}
        unknown = sorted(set(explicit_versions) - component_id_set)
        if unknown:
            raise ValidationError(f"DeploySet contains components outside ComponentSet: {', '.join(unknown)}")
        missing = [component_id for component_id in component_ids if component_id not in explicit_versions]
        inferred_versions: dict[str, str] = {}

        if missing:
            if request.base_deployset_id is None and request.base_environment_id is None:
                raise ValidationError("baseEnvironmentId or baseDeploySetId is required when ComponentSet components are missing")
            inferred_versions = self._infer_versions(
                missing=missing,
                base_deployset_id=request.base_deployset_id,
                base_environment_id=request.base_environment_id,
                workspace_id=workspace_id,
            )

        items = [
            DeploySetItem(
                component_id=component_id,
                version=explicit_versions[component_id],
                source=DeploySetItemSource.EXPLICIT,
            )
            for component_id in component_ids
            if component_id in explicit_versions
        ]
        items.extend(
            DeploySetItem(
                component_id=component_id,
                version=inferred_versions[component_id],
                source=DeploySetItemSource.INFERRED,
            )
            for component_id in missing
        )
        self._validate_releases(items, workspace_id)
        warnings = []
        if inferred_versions:
            source = (
                f"baseDeploySetId={request.base_deployset_id}"
                if request.base_deployset_id is not None
                else f"baseEnvironmentId={request.base_environment_id}"
            )
            warnings.append(
                f"{len(inferred_versions)} component versions were inferred from {source}. "
                "Fully explicit DeploySets are recommended."
            )

        return (
            DeploySet(
                workspace_id=workspace_id,
                deployset_id=request.deployset_id,
                component_set_id=request.component_set_id,
                schema_version=1,
                notes=request.notes,
                base_environment_id=request.base_environment_id,
                base_deployset_id=request.base_deployset_id,
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
        base_deployset_id: str | None,
        base_environment_id: str | None,
        workspace_id: str,
    ) -> dict[str, str]:
        if base_deployset_id is not None:
            base = self.deploysets.get(base_deployset_id, workspace_id)
            if base is None:
                raise NotFoundError(f"Base DeploySet not found: {base_deployset_id}")
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

    def _validate_complete(self, deployset: DeploySet, workspace_id: str) -> None:
        component_set = self.component_sets.get(deployset.component_set_id, workspace_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {deployset.component_set_id}")
        expected = {item.component_id for item in component_set.components}
        present = {item.component_id for item in deployset.items}
        missing = sorted(expected - present)
        if missing:
            raise ValidationError(f"DeploySet is missing ComponentSet components: {', '.join(missing)}")
        self._validate_releases(deployset.items, workspace_id)

    def _validate_releases(self, items: list[DeploySetItem], workspace_id: str) -> None:
        for item in items:
            if self.releases.get(item.component_id, item.version, workspace_id) is None:
                raise NotFoundError(f"Release not found: {item.component_id}/{item.version}")

    def get(self, deployset_id: str, workspace_id: str = "default") -> DeploySet:
        deployset = self.deploysets.get(deployset_id, workspace_id)
        if deployset is None:
            raise NotFoundError(f"DeploySet not found: {deployset_id}")
        return deployset

    def list(self, workspace_id: str = "default") -> list[DeploySet]:
        return self.deploysets.list(workspace_id)


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


class ReadOnlyUseCases:
    def __init__(
        self,
        states: EnvironmentStateRepository,
        executions: DeploymentExecutionRepository,
    ) -> None:
        self.states = states
        self.executions = executions

    def get_environment_state(self, environment_id: str, workspace_id: str = "default") -> EnvironmentState:
        state = self.states.get(environment_id, workspace_id)
        if state is None:
            raise NotFoundError(f"EnvironmentState not found: {environment_id}")
        return state

    def list_environment_states(self, workspace_id: str = "default") -> list[EnvironmentState]:
        return self.states.list(workspace_id)

    def get_deployment_execution(self, deployment_execution_id: str, workspace_id: str = "default") -> DeploymentExecution:
        execution = self.executions.get(deployment_execution_id, workspace_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

    def list_deployment_executions(self, environment_id: str | None = None, workspace_id: str = "default") -> list[DeploymentExecution]:
        return self.executions.list_by_environment(environment_id, workspace_id)
