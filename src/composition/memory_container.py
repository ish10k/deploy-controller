from src.application.use_cases.deployments import AdapterUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentSetUseCases,
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
)
from src.composition.container import Container
from src.composition.local_seed import seed_local_data
from src.infrastructure.ids import UuidIdGenerator
from src.infrastructure.memory.repositories import (
    MemoryComponentRepository,
    MemoryComponentSetRepository,
    MemoryDeploymentExecutionRepository,
    MemoryDeploySetRepository,
    MemoryEnvironmentRepository,
    MemoryEnvironmentStateRepository,
    MemoryReleaseRepository,
    MemoryRepositories,
)
from src.infrastructure.time import SystemClock


def build_memory_container(store: MemoryRepositories | None = None) -> Container:
    seeded = store is None
    store = store or MemoryRepositories()
    if seeded:
        seed_local_data(store)
    components = MemoryComponentRepository(store)
    component_sets = MemoryComponentSetRepository(store)
    releases = MemoryReleaseRepository(store)
    deploysets = MemoryDeploySetRepository(store)
    environments = MemoryEnvironmentRepository(store)
    states = MemoryEnvironmentStateRepository(store)
    executions = MemoryDeploymentExecutionRepository(store)
    clock = SystemClock()
    planner = PlanDeploymentUseCase(
        deploysets=deploysets,
        releases=releases,
        environments=environments,
        executions=executions,
    )
    return Container(
        components=ComponentUseCases(components),
        component_sets=ComponentSetUseCases(component_sets),
        releases=ReleaseUseCases(releases),
        deploysets=DeploySetUseCases(
            deploysets=deploysets,
            component_sets=component_sets,
            releases=releases,
            executions=executions,
            clock=clock,
        ),
        environments=EnvironmentUseCases(environments),
        read_only=ReadOnlyUseCases(states, executions),
        plan_deployment=planner,
        create_deployment=CreateDeploymentUseCase(
            planner=planner,
            executions=executions,
            states=states,
            clock=clock,
            id_generator=UuidIdGenerator(),
        ),
        adapters=AdapterUseCases(executions=executions, states=states, clock=clock),
    )
