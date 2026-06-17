from src.application.ports import (
    Clock,
    ComponentRepository,
    ComponentSetRepository,
    DeploymentExecutionRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    ReleaseRepository,
)
from src.domain.enums import DeploySetItemSource, ExecutionStatus, ItemStatus, RequestedAction
from src.domain.errors import ConflictError, NotFoundError, ValidationError
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
    Release,
)


def _same(left: object, right: object) -> bool:
    return left == right


class ComponentUseCases:
    def __init__(self, components: ComponentRepository) -> None:
        self.components = components

    def put(self, component: Component) -> Component:
        self.components.put(component)
        return component

    def get(self, component_id: str) -> Component:
        component = self.components.get(component_id)
        if component is None:
            raise NotFoundError(f"Component not found: {component_id}")
        return component

    def list(self) -> list[Component]:
        return self.components.list()


class ComponentSetUseCases:
    def __init__(self, component_sets: ComponentSetRepository) -> None:
        self.component_sets = component_sets

    def put(self, component_set: ComponentSet) -> ComponentSet:
        self.component_sets.put(component_set)
        return component_set

    def get(self, component_set_id: str) -> ComponentSet:
        component_set = self.component_sets.get(component_set_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {component_set_id}")
        return component_set

    def list(self) -> list[ComponentSet]:
        return self.component_sets.list()


class ReleaseUseCases:
    def __init__(self, releases: ReleaseRepository) -> None:
        self.releases = releases

    def create(self, release: Release) -> Release:
        existing = self.releases.get(release.component_id, release.version)
        if existing is not None:
            if _same(existing, release):
                return existing
            raise ConflictError(
                f"Release already exists with different content: {release.component_id}/{release.version}"
            )
        self.releases.create(release)
        return release

    def get(self, component_id: str, version: str) -> Release:
        release = self.releases.get(component_id, version)
        if release is None:
            raise NotFoundError(f"Release not found: {component_id}/{version}")
        return release

    def list(self, component_id: str | None = None) -> list[Release]:
        return self.releases.list_by_component(component_id)


class DeploySetUseCases:
    def __init__(
        self,
        *,
        deploysets: DeploySetRepository,
        component_sets: ComponentSetRepository,
        releases: ReleaseRepository,
        executions: DeploymentExecutionRepository,
        clock: Clock,
    ) -> None:
        self.deploysets = deploysets
        self.component_sets = component_sets
        self.releases = releases
        self.executions = executions
        self.clock = clock

    def create(self, request: DeploySet | DeploySetCreateRequest | dict[str, object]) -> DeploySetCreateResult:
        if isinstance(request, dict):
            request = DeploySetCreateRequest.model_validate(request)
        deployset, warnings = self._expand(request)
        existing = self.deploysets.get(deployset.deployset_id)
        if existing is not None:
            if _same(existing, deployset):
                return DeploySetCreateResult(deployset=existing, warnings=warnings)
            raise ConflictError(f"DeploySet already exists with different content: {deployset.deployset_id}")
        self.deploysets.create(deployset)
        return DeploySetCreateResult(deployset=deployset, warnings=warnings)

    def _expand(self, request: DeploySet | DeploySetCreateRequest) -> tuple[DeploySet, list[str]]:
        if isinstance(request, DeploySet):
            self._validate_complete(request)
            return request, []

        component_set = self.component_sets.get(request.component_set_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {request.component_set_id}")

        component_ids = [item.component_id for item in component_set.components]
        component_id_set = set(component_ids)
        required_component_ids = [item.component_id for item in component_set.components if item.required]
        explicit_versions = {item.component_id: item.version for item in request.items}
        unknown = sorted(set(explicit_versions) - component_id_set)
        if unknown:
            raise ValidationError(f"DeploySet contains components outside ComponentSet: {', '.join(unknown)}")
        missing = [component_id for component_id in required_component_ids if component_id not in explicit_versions]
        inferred_versions: dict[str, str] = {}

        if missing:
            if request.base_deployset_id is None and request.base_environment_id is None:
                raise ValidationError(
                    "baseEnvironmentId or baseDeploySetId is required when required components are missing"
                )
            inferred_versions = self._infer_versions(
                missing=missing,
                base_deployset_id=request.base_deployset_id,
                base_environment_id=request.base_environment_id,
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
        self._validate_releases(items)
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
                deployset_id=request.deployset_id,
                component_set_id=request.component_set_id,
                schema_version=1,
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
    ) -> dict[str, str]:
        if base_deployset_id is not None:
            base = self.deploysets.get(base_deployset_id)
            if base is None:
                raise NotFoundError(f"Base DeploySet not found: {base_deployset_id}")
            base_versions = {item.component_id: item.version for item in base.items}
        else:
            executions = self.executions.list_by_environment(base_environment_id)
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
                raise ValidationError(f"Could not infer version for required component: {component_id}")
            inferred[component_id] = version
        return inferred

    def _validate_complete(self, deployset: DeploySet) -> None:
        component_set = self.component_sets.get(deployset.component_set_id)
        if component_set is None:
            raise NotFoundError(f"ComponentSet not found: {deployset.component_set_id}")
        required = {item.component_id for item in component_set.components if item.required}
        present = {item.component_id for item in deployset.items}
        missing = sorted(required - present)
        if missing:
            raise ValidationError(f"DeploySet is missing required components: {', '.join(missing)}")
        self._validate_releases(deployset.items)

    def _validate_releases(self, items: list[DeploySetItem]) -> None:
        for item in items:
            if self.releases.get(item.component_id, item.version) is None:
                raise NotFoundError(f"Release not found: {item.component_id}/{item.version}")

    def get(self, deployset_id: str) -> DeploySet:
        deployset = self.deploysets.get(deployset_id)
        if deployset is None:
            raise NotFoundError(f"DeploySet not found: {deployset_id}")
        return deployset

    def list(self) -> list[DeploySet]:
        return self.deploysets.list()


class EnvironmentUseCases:
    def __init__(self, environments: EnvironmentRepository) -> None:
        self.environments = environments

    def put(self, environment: Environment) -> Environment:
        self.environments.put(environment)
        return environment

    def get(self, environment_id: str) -> Environment:
        environment = self.environments.get(environment_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        return environment

    def list(self) -> list[Environment]:
        return self.environments.list()


class ReadOnlyUseCases:
    def __init__(
        self,
        states: EnvironmentStateRepository,
        executions: DeploymentExecutionRepository,
    ) -> None:
        self.states = states
        self.executions = executions

    def get_environment_state(self, environment_id: str) -> EnvironmentState:
        state = self.states.get(environment_id)
        if state is None:
            raise NotFoundError(f"EnvironmentState not found: {environment_id}")
        return state

    def list_environment_states(self) -> list[EnvironmentState]:
        return self.states.list()

    def get_deployment_execution(self, deployment_execution_id: str) -> DeploymentExecution:
        execution = self.executions.get(deployment_execution_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

    def list_deployment_executions(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        return self.executions.list_by_environment(environment_id)


