import os

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
from src.infrastructure.dynamodb.repositories import (
    DynamoComponentRepository,
    DynamoComponentSetRepository,
    DynamoDeploymentExecutionRepository,
    DynamoDeploymentRunnerRepository,
    DynamoDeploySetRepository,
    DynamoEnvironmentRepository,
    DynamoEnvironmentStateRepository,
    DynamoBootstrapStateRepository,
    DynamoPrincipalRepository,
    DynamoReleaseRepository,
    DynamoReleaseSourceRepository,
)
from src.infrastructure.ids import UuidIdGenerator
from src.infrastructure.time import SystemClock


def build_aws_container() -> Container:
    components = DynamoComponentRepository(os.environ["COMPONENTS_TABLE"])
    component_sets = DynamoComponentSetRepository(os.environ["COMPONENT_SETS_TABLE"])
    releases = DynamoReleaseRepository(os.environ["RELEASES_TABLE"])
    release_sources = DynamoReleaseSourceRepository(os.environ["RELEASE_SOURCES_TABLE"])
    deploysets = DynamoDeploySetRepository(os.environ["DEPLOYSETS_TABLE"])
    environments = DynamoEnvironmentRepository(os.environ["ENVIRONMENTS_TABLE"])
    runners = DynamoDeploymentRunnerRepository(os.environ["DEPLOYMENT_RUNNERS_TABLE"])
    principals = DynamoPrincipalRepository(os.environ["PRINCIPALS_TABLE"])
    bootstrap = DynamoBootstrapStateRepository(os.environ["BOOTSTRAP_TABLE"])
    states = DynamoEnvironmentStateRepository(os.environ["ENVIRONMENT_STATE_TABLE"])
    executions = DynamoDeploymentExecutionRepository(os.environ["DEPLOYMENT_EXECUTIONS_TABLE"])
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


