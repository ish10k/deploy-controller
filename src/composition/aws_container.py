import os

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
from src.infrastructure.artifacts import ConventionArtifactResolver
from src.infrastructure.dynamodb.repositories import (
    DynamoComponentRepository,
    DynamoDeploymentExecutionRepository,
    DynamoDeploySetRepository,
    DynamoEnvironmentRepository,
    DynamoEnvironmentStateRepository,
    DynamoEnvironmentTargetRepository,
    DynamoReleaseRepository,
    DynamoTargetResolutionRepository,
)
from src.infrastructure.ids import UuidIdGenerator
from src.infrastructure.memory.actual_sha_reader import MemoryActualShaReader
from src.infrastructure.time import SystemClock


def build_aws_container() -> Container:
    components = DynamoComponentRepository(os.environ["COMPONENTS_TABLE"])
    releases = DynamoReleaseRepository(os.environ["RELEASES_TABLE"])
    deploysets = DynamoDeploySetRepository(os.environ["DEPLOYSETS_TABLE"])
    environments = DynamoEnvironmentRepository(os.environ["ENVIRONMENTS_TABLE"])
    environment_targets = DynamoEnvironmentTargetRepository(os.environ["ENVIRONMENT_TARGETS_TABLE"])
    target_resolutions = DynamoTargetResolutionRepository(os.environ["TARGET_RESOLUTIONS_TABLE"])
    states = DynamoEnvironmentStateRepository(os.environ["ENVIRONMENT_STATE_TABLE"])
    executions = DynamoDeploymentExecutionRepository(os.environ["DEPLOYMENT_EXECUTIONS_TABLE"])
    planner = PlanDeploymentUseCase(
        deploysets=deploysets,
        releases=releases,
        environments=environments,
        components=components,
        environment_targets=environment_targets,
        target_resolutions=target_resolutions,
        executions=executions,
        artifact_resolver=ConventionArtifactResolver(
            artifact_bucket=os.environ["ARTIFACT_BUCKET"],
            ecr_registry=os.environ["ECR_REGISTRY"],
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
