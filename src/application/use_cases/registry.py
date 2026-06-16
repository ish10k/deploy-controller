from src.application.ports import (
    ComponentRepository,
    DeploymentExecutionRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    EnvironmentTargetRepository,
    ReleaseRepository,
    TargetResolutionRepository,
)
from src.domain.errors import ConflictError, NotFoundError
from src.domain.models import (
    Component,
    DeploySet,
    Environment,
    EnvironmentTarget,
    Release,
    TargetResolution,
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
    def __init__(self, deploysets: DeploySetRepository) -> None:
        self.deploysets = deploysets

    def create(self, deployset: DeploySet) -> DeploySet:
        existing = self.deploysets.get(deployset.deployset_id)
        if existing is not None:
            if _same(existing, deployset):
                return existing
            raise ConflictError(f"DeploySet already exists with different content: {deployset.deployset_id}")
        self.deploysets.create(deployset)
        return deployset

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


class EnvironmentTargetUseCases:
    def __init__(self, targets: EnvironmentTargetRepository) -> None:
        self.targets = targets

    def put(self, target: EnvironmentTarget) -> EnvironmentTarget:
        self.targets.put(target)
        return target

    def get(self, environment_id: str, component_id: str) -> EnvironmentTarget:
        target = self.targets.get(environment_id, component_id)
        if target is None:
            raise NotFoundError(f"EnvironmentTarget not found: {environment_id}/{component_id}")
        return target

    def list(self, environment_id: str | None = None) -> list[EnvironmentTarget]:
        return self.targets.list_by_environment(environment_id)


class TargetResolutionUseCases:
    def __init__(self, resolutions: TargetResolutionRepository) -> None:
        self.resolutions = resolutions

    def put(self, resolution: TargetResolution) -> TargetResolution:
        self.resolutions.put(resolution)
        return resolution

    def get(self, component_type: str, target_key: str) -> TargetResolution:
        resolution = self.resolutions.get(component_type, target_key)
        if resolution is None:
            raise NotFoundError(f"TargetResolution not found: {component_type}/{target_key}")
        return resolution

    def list(self, component_type: str | None = None) -> list[TargetResolution]:
        return self.resolutions.list_by_type(component_type)


class ReadOnlyUseCases:
    def __init__(
        self,
        states: EnvironmentStateRepository,
        executions: DeploymentExecutionRepository,
    ) -> None:
        self.states = states
        self.executions = executions

    def get_environment_state(self, environment_id: str):
        state = self.states.get(environment_id)
        if state is None:
            raise NotFoundError(f"EnvironmentState not found: {environment_id}")
        return state

    def list_environment_states(self):
        return self.states.list()

    def get_deployment_execution(self, deployment_execution_id: str):
        execution = self.executions.get(deployment_execution_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

    def list_deployment_executions(self, environment_id: str | None = None):
        return self.executions.list_by_environment(environment_id)
