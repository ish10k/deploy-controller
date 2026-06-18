import os

from src.application.use_cases.deployments import DeploymentRunnerUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.events import EventLogUseCases
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
from src.application.use_cases.roles import RoleUseCases
from src.application.use_cases.webhooks import WebhookUseCases
from src.composition.container import Container
from src.infrastructure.dynamodb.repositories import (
    DynamoComponentRepository,
    DynamoComponentSetRepository,
    DynamoDeploymentExecutionRepository,
    DynamoDeploymentRunnerRepository,
    DynamoDeploySetRepository,
    DynamoEnvironmentRepository,
    DynamoEnvironmentStateRepository,
    DynamoEventLogRepository,
    DynamoBootstrapStateRepository,
    DynamoPrincipalRepository,
    DynamoReleaseRepository,
    DynamoReleaseSourceRepository,
    DynamoRoleRepository,
    DynamoWebhookDeliveryRepository,
    DynamoWebhookRepository,
)
from src.infrastructure.ids import EventIdGenerator, UuidIdGenerator, WebhookDeliveryIdGenerator
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
    role_repo = DynamoRoleRepository(os.environ["ROLES_TABLE"])
    bootstrap = DynamoBootstrapStateRepository(os.environ["BOOTSTRAP_TABLE"])
    states = DynamoEnvironmentStateRepository(os.environ["ENVIRONMENT_STATE_TABLE"])
    executions = DynamoDeploymentExecutionRepository(os.environ["DEPLOYMENT_EXECUTIONS_TABLE"])
    event_log = DynamoEventLogRepository(os.environ["EVENT_LOG_TABLE"])
    webhook_repo = DynamoWebhookRepository(os.environ["WEBHOOKS_TABLE"])
    webhook_deliveries = DynamoWebhookDeliveryRepository(os.environ["WEBHOOK_DELIVERIES_TABLE"])
    clock = SystemClock()
    webhooks = WebhookUseCases(
        webhooks=webhook_repo,
        deliveries=webhook_deliveries,
        clock=clock,
        delivery_ids=WebhookDeliveryIdGenerator(),
        dispatch_async=True,
    )
    events = EventLogUseCases(events=event_log, clock=clock, id_generator=EventIdGenerator(), on_append=webhooks.enqueue_for_event)
    webhooks.set_event_log(events)
    roles = RoleUseCases(roles=role_repo, events=events)
    identity = PrincipalUseCases(principals=principals, roles=role_repo, bootstrap=bootstrap, clock=clock, events=events)
    planner = PlanDeploymentUseCase(
        deploysets=deploysets,
        releases=releases,
        environments=environments,
        executions=executions,
    )
    return Container(
        components=ComponentUseCases(components, events=events),
        component_sets=ComponentSetUseCases(component_sets, events=events),
        releases=ReleaseUseCases(releases, events=events),
        release_sources=ReleaseSourceUseCases(
            release_sources=release_sources,
            releases=releases,
            component_sets=component_sets,
            clock=clock,
            principals=identity,
            events=events,
        ),
        deploysets=DeploySetUseCases(
            deploysets=deploysets,
            component_sets=component_sets,
            releases=releases,
            executions=executions,
            clock=clock,
            events=events,
        ),
        environments=EnvironmentUseCases(environments, events=events),
        read_only=ReadOnlyUseCases(states, executions),
        plan_deployment=planner,
        create_deployment=CreateDeploymentUseCase(
            planner=planner,
            executions=executions,
            states=states,
            clock=clock,
            id_generator=UuidIdGenerator(),
            events=events,
        ),
        deployment_runners=DeploymentRunnerUseCases(
            runners=runners,
            executions=executions,
            deploysets=deploysets,
            states=states,
            clock=clock,
            principals=identity,
            events=events,
        ),
        principals=identity,
        roles=roles,
        events=events,
        webhooks=webhooks,
    )
