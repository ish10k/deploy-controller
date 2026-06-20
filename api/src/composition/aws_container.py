import os

from src.application.use_cases.deployments import DeploymentRunnerUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase, RunnerEligibilityUseCases
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.registry import (
    ComponentSetUseCases,
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    PublisherUseCases,
)
from src.application.use_cases.identity import PrincipalUseCases
from src.application.use_cases.roles import RoleUseCases
from src.application.use_cases.tenancy import OrganizationUseCases, WorkspaceUseCases
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
    DynamoOrganizationMembershipRepository,
    DynamoOrganizationRepository,
    DynamoPrincipalRepository,
    DynamoReleaseRepository,
    DynamoPublisherRepository,
    DynamoRoleRepository,
    DynamoWorkspaceMembershipRepository,
    DynamoWorkspaceRepository,
    DynamoWebhookDeliveryRepository,
    DynamoWebhookRepository,
)
from src.infrastructure.ids import EventIdGenerator, UuidIdGenerator, WebhookDeliveryIdGenerator
from src.infrastructure.time import SystemClock


def build_aws_container() -> Container:
    components = DynamoComponentRepository(os.environ["COMPONENTS_TABLE"])
    component_sets = DynamoComponentSetRepository(os.environ["COMPONENT_SETS_TABLE"])
    releases = DynamoReleaseRepository(os.environ["RELEASES_TABLE"])
    publishers = DynamoPublisherRepository(os.environ["PUBLISHERS_TABLE"])
    deploysets = DynamoDeploySetRepository(os.environ["DEPLOYSETS_TABLE"])
    environments = DynamoEnvironmentRepository(os.environ["ENVIRONMENTS_TABLE"])
    runners = DynamoDeploymentRunnerRepository(os.environ["DEPLOYMENT_RUNNERS_TABLE"])
    organization_repo = DynamoOrganizationRepository(os.environ["ORGANIZATIONS_TABLE"])
    workspace_repo = DynamoWorkspaceRepository(os.environ["WORKSPACES_TABLE"])
    organization_memberships = DynamoOrganizationMembershipRepository(os.environ["ORGANIZATION_MEMBERSHIPS_TABLE"])
    workspace_memberships = DynamoWorkspaceMembershipRepository(os.environ["WORKSPACE_MEMBERSHIPS_TABLE"])
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
    organizations = OrganizationUseCases(
        organizations=organization_repo,
        workspaces=workspace_repo,
        organization_memberships=organization_memberships,
        workspace_memberships=workspace_memberships,
        clock=clock,
    )
    workspaces = WorkspaceUseCases(workspaces=workspace_repo, memberships=workspace_memberships, clock=clock)
    identity = PrincipalUseCases(
        principals=principals,
        roles=role_repo,
        bootstrap=bootstrap,
        clock=clock,
        events=events,
        organizations=organization_repo,
        workspaces=workspace_repo,
        organization_memberships=organization_memberships,
        workspace_memberships=workspace_memberships,
        bootstrap_tenancy=organizations,
    )
    runner_eligibility = RunnerEligibilityUseCases(
        runners=runners,
        deploysets=deploysets,
        components=components,
        environments=environments,
    )
    planner = PlanDeploymentUseCase(
        deploysets=deploysets,
        releases=releases,
        environments=environments,
        executions=executions,
        runner_eligibility=runner_eligibility,
    )
    return Container(
        components=ComponentUseCases(components, events=events),
        component_sets=ComponentSetUseCases(component_sets, events=events),
        releases=ReleaseUseCases(releases, events=events),
        publishers=PublisherUseCases(
            publishers=publishers,
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
        read_only=ReadOnlyUseCases(states, executions, runner_eligibility),
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
            components=components,
            environments=environments,
            states=states,
            clock=clock,
            principals=identity,
            events=events,
        ),
        principals=identity,
        roles=roles,
        organizations=organizations,
        workspaces=workspaces,
        events=events,
        webhooks=webhooks,
    )
