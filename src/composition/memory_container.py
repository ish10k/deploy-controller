from src.application.use_cases.deployments import CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentTargetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    TargetResolutionUseCases,
)
from src.composition.container import Container
from src.composition.local_seed import seed_local_data
from src.infrastructure.artifacts import ConventionArtifactResolver
from src.infrastructure.ids import UuidIdGenerator
from src.infrastructure.memory.actual_sha_reader import MemoryActualShaReader
from src.infrastructure.memory.repositories import (
    MemoryComponentRepository,
    MemoryDeploymentExecutionRepository,
    MemoryDeploySetRepository,
    MemoryEnvironmentRepository,
    MemoryEnvironmentStateRepository,
    MemoryEnvironmentTargetRepository,
    MemoryReleaseRepository,
    MemoryRepositories,
    MemoryTargetResolutionRepository,
)
from src.infrastructure.time import SystemClock


def build_memory_container(store: MemoryRepositories | None = None) -> Container:
    seeded = store is None
    store = store or MemoryRepositories()
    if seeded:
        seed_local_data(store)
    components = MemoryComponentRepository(store)
    releases = MemoryReleaseRepository(store)
    deploysets = MemoryDeploySetRepository(store)
    environments = MemoryEnvironmentRepository(store)
    environment_targets = MemoryEnvironmentTargetRepository(store)
    target_resolutions = MemoryTargetResolutionRepository(store)
    states = MemoryEnvironmentStateRepository(store)
    executions = MemoryDeploymentExecutionRepository(store)
    planner = PlanDeploymentUseCase(
        deploysets=deploysets,
        releases=releases,
        environments=environments,
        components=components,
        environment_targets=environment_targets,
        target_resolutions=target_resolutions,
        executions=executions,
        artifact_resolver=ConventionArtifactResolver(
            artifact_bucket="local-artifacts",
            ecr_registry="localhost:5000",
        ),
        actual_sha_reader=MemoryActualShaReader(),
    )
    return Container(
        components=ComponentUseCases(components),
        releases=ReleaseUseCases(releases),
        deploysets=DeploySetUseCases(deploysets),
        environments=EnvironmentUseCases(environments),
        environment_targets=EnvironmentTargetUseCases(environment_targets),
        target_resolutions=TargetResolutionUseCases(target_resolutions),
        read_only=ReadOnlyUseCases(states, executions),
        plan_deployment=planner,
        create_deployment=CreateDeploymentUseCase(
            planner=planner,
            executions=executions,
            states=states,
            clock=SystemClock(),
            id_generator=UuidIdGenerator(),
        ),
    )
