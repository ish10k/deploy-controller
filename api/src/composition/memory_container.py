from src.application.use_cases.deployments import DeploymentRunnerUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentSetUseCases,
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    ReleaseSourceUseCases,
)
from src.application.use_cases.identity import PrincipalUseCases
from src.composition.container import Container
from src.composition.local_seed import seed_local_data
from src.infrastructure.ids import UuidIdGenerator
from src.infrastructure.memory.repositories import (
    MemoryComponentRepository,
    MemoryComponentSetRepository,
    MemoryDeploymentExecutionRepository,
    MemoryDeploymentRunnerRepository,
    MemoryDeploySetRepository,
    MemoryEnvironmentRepository,
    MemoryEnvironmentStateRepository,
    MemoryBootstrapStateRepository,
    MemoryPrincipalRepository,
    MemoryReleaseRepository,
    MemoryReleaseSourceRepository,
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
    release_sources = MemoryReleaseSourceRepository(store)
    deploysets = MemoryDeploySetRepository(store)
    environments = MemoryEnvironmentRepository(store)
    runners = MemoryDeploymentRunnerRepository(store)
    principals = MemoryPrincipalRepository(store)
    bootstrap = MemoryBootstrapStateRepository(store)
    states = MemoryEnvironmentStateRepository(store)
    executions = MemoryDeploymentExecutionRepository(store)
    clock = SystemClock()
    identity = PrincipalUseCases(principals=principals, bootstrap=bootstrap, clock=clock)
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
        release_sources=ReleaseSourceUseCases(
            release_sources=release_sources,
            releases=releases,
            component_sets=component_sets,
            clock=clock,
            principals=identity,
        ),
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
        deployment_runners=DeploymentRunnerUseCases(
            runners=runners,
            executions=executions,
            deploysets=deploysets,
            states=states,
            clock=clock,
            principals=identity,
        ),
        principals=identity,
    )


