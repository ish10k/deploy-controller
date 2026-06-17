from collections.abc import Iterable
from dataclasses import dataclass, field

from src.domain.enums import ExecutionStatus
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploySet,
    Environment,
    EnvironmentState,
    Release,
)


@dataclass
class MemoryRepositories:
    components: dict[str, Component] = field(default_factory=dict)
    component_sets: dict[str, ComponentSet] = field(default_factory=dict)
    releases: dict[tuple[str, str], Release] = field(default_factory=dict)
    deploysets: dict[str, DeploySet] = field(default_factory=dict)
    environments: dict[str, Environment] = field(default_factory=dict)
    environment_states: dict[str, EnvironmentState] = field(default_factory=dict)
    deployment_executions: dict[str, DeploymentExecution] = field(default_factory=dict)

    def get_component(self, component_id: str) -> Component | None:
        return self.components.get(component_id)

    def list_components(self) -> list[Component]:
        return sorted(self.components.values(), key=lambda item: item.component_id)

    def put_component(self, component: Component) -> None:
        self.components[component.component_id] = component

    def get_component_set(self, component_set_id: str) -> ComponentSet | None:
        return self.component_sets.get(component_set_id)

    def list_component_sets(self) -> list[ComponentSet]:
        return sorted(self.component_sets.values(), key=lambda item: item.component_set_id)

    def put_component_set(self, component_set: ComponentSet) -> None:
        self.component_sets[component_set.component_set_id] = component_set

    def get_release(self, component_id: str, version: str) -> Release | None:
        return self.releases.get((component_id, version))

    def create_release(self, release: Release) -> None:
        key = (release.component_id, release.version)
        if key in self.releases:
            raise ConflictError(f"Release already exists: {release.component_id}/{release.version}")
        self.releases[key] = release

    def list_releases(self, component_id: str | None = None) -> list[Release]:
        values: Iterable[Release] = self.releases.values()
        if component_id is not None:
            values = (item for item in values if item.component_id == component_id)
        return sorted(values, key=lambda item: (item.component_id, item.version))

    def get_deployset(self, deployset_id: str) -> DeploySet | None:
        return self.deploysets.get(deployset_id)

    def create_deployset(self, deployset: DeploySet) -> None:
        if deployset.deployset_id in self.deploysets:
            raise ConflictError(f"DeploySet already exists: {deployset.deployset_id}")
        self.deploysets[deployset.deployset_id] = deployset

    def list_deploysets(self) -> list[DeploySet]:
        return sorted(self.deploysets.values(), key=lambda item: item.deployset_id)

    def get_environment(self, environment_id: str) -> Environment | None:
        return self.environments.get(environment_id)

    def list_environments(self) -> list[Environment]:
        return sorted(self.environments.values(), key=lambda item: item.environment_id)

    def put_environment(self, environment: Environment) -> None:
        self.environments[environment.environment_id] = environment

    def get_environment_state(self, environment_id: str) -> EnvironmentState | None:
        return self.environment_states.get(environment_id)

    def list_environment_states(self) -> list[EnvironmentState]:
        return sorted(self.environment_states.values(), key=lambda item: item.environment_id)

    def put_environment_state(self, state: EnvironmentState) -> None:
        self.environment_states[state.environment_id] = state

    def get_deployment_execution(self, deployment_execution_id: str) -> DeploymentExecution | None:
        return self.deployment_executions.get(deployment_execution_id)

    def create_deployment_execution(self, execution: DeploymentExecution) -> None:
        if execution.deployment_execution_id in self.deployment_executions:
            raise ConflictError(f"DeploymentExecution already exists: {execution.deployment_execution_id}")
        self.deployment_executions[execution.deployment_execution_id] = execution

    def put_deployment_execution(self, execution: DeploymentExecution) -> None:
        self.deployment_executions[execution.deployment_execution_id] = execution

    def list_deployment_executions(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        values: Iterable[DeploymentExecution] = self.deployment_executions.values()
        if environment_id is not None:
            values = (item for item in values if item.environment_id == environment_id)
        return sorted(values, key=lambda item: (item.started_at, item.deployment_execution_id), reverse=True)

    def latest_deployment_execution(self, environment_id: str) -> DeploymentExecution | None:
        executions = self.list_deployment_executions(environment_id)
        return executions[0] if executions else None

    def list_pending_deployment_executions(self) -> list[DeploymentExecution]:
        return sorted(
            (item for item in self.deployment_executions.values() if item.status == ExecutionStatus.PENDING),
            key=lambda item: (item.started_at, item.deployment_execution_id),
        )


class MemoryComponentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str) -> Component | None:
        return self.store.get_component(component_id)

    def list(self) -> list[Component]:
        return self.store.list_components()

    def put(self, component: Component) -> None:
        self.store.put_component(component)


class MemoryComponentSetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_set_id: str) -> ComponentSet | None:
        return self.store.get_component_set(component_set_id)

    def list(self) -> list[ComponentSet]:
        return self.store.list_component_sets()

    def put(self, component_set: ComponentSet) -> None:
        self.store.put_component_set(component_set)


class MemoryReleaseRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str, version: str) -> Release | None:
        return self.store.get_release(component_id, version)

    def create(self, release: Release) -> None:
        self.store.create_release(release)

    def list_by_component(self, component_id: str | None = None) -> list[Release]:
        return self.store.list_releases(component_id)


class MemoryDeploySetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployset_id: str) -> DeploySet | None:
        return self.store.get_deployset(deployset_id)

    def create(self, deployset: DeploySet) -> None:
        self.store.create_deployset(deployset)

    def list(self) -> list[DeploySet]:
        return self.store.list_deploysets()


class MemoryEnvironmentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, environment_id: str) -> Environment | None:
        return self.store.get_environment(environment_id)

    def list(self) -> list[Environment]:
        return self.store.list_environments()

    def put(self, environment: Environment) -> None:
        self.store.put_environment(environment)


class MemoryEnvironmentStateRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, environment_id: str) -> EnvironmentState | None:
        return self.store.get_environment_state(environment_id)

    def list(self) -> list[EnvironmentState]:
        return self.store.list_environment_states()

    def put(self, state: EnvironmentState) -> None:
        self.store.put_environment_state(state)


class MemoryDeploymentExecutionRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployment_execution_id: str) -> DeploymentExecution | None:
        return self.store.get_deployment_execution(deployment_execution_id)

    def create(self, execution: DeploymentExecution) -> None:
        self.store.create_deployment_execution(execution)

    def put(self, execution: DeploymentExecution) -> None:
        self.store.put_deployment_execution(execution)

    def list_by_environment(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        return self.store.list_deployment_executions(environment_id)

    def latest_for_environment(self, environment_id: str) -> DeploymentExecution | None:
        return self.store.latest_deployment_execution(environment_id)

    def list_pending(self) -> list[DeploymentExecution]:
        return self.store.list_pending_deployment_executions()


