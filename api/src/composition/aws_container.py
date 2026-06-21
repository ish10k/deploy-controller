import os

from src.application.use_cases.deployments import DeploymentRunnerUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase, RunnerEligibilityUseCases
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.registry import (
    ReleaseSetUseCases,
    ComponentUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    PublisherUseCases,
    TagDefinitionUseCases,
)
from src.application.use_cases.identity import PrincipalUseCases
from src.application.use_cases.roles import RoleUseCases
from src.application.use_cases.tenancy import OrganizationUseCases, WorkspaceUseCases
from src.application.use_cases.webhooks import WebhookUseCases
from src.composition.container import Container
from src.infrastructure.dynamodb.repositories import (
    DynamoComponentRepository,
    DynamoReleaseSetRepository,
    DynamoDeploymentRepository,
    DynamoDeploymentRunnerRepository,
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
    DynamoTagDefinitionRepository,
    DynamoWorkspaceMembershipRepository,
    DynamoWorkspaceRepository,
    DynamoWebhookDeliveryRepository,
    DynamoWebhookRepository,
)
from src.infrastructure.ids import EventIdGenerator, UuidIdGenerator, WebhookDeliveryIdGenerator
from src.infrastructure.time import SystemClock


def build_aws_container() -> Container:
    components = DynamoComponentRepository(os.environ["COMPONENTS_TABLE"])
    release_sets_table = os.environ.get("RELEASE_SETS_TABLE") or os.environ.get("DEPLOYSETS_TABLE") or os.environ["COMPONENT_SETS_TABLE"]
    release_sets = DynamoReleaseSetRepository(release_sets_table)
    releases = DynamoReleaseRepository(os.environ["RELEASES_TABLE"])
    publishers = DynamoPublisherRepository(os.environ["PUBLISHERS_TABLE"])
    environments = DynamoEnvironmentRepository(os.environ["ENVIRONMENTS_TABLE"])
    runners = DynamoDeploymentRunnerRepository(os.environ["DEPLOYMENT_RUNNERS_TABLE"])
    organization_repo = DynamoOrganizationRepository(os.environ["ORGANIZATIONS_TABLE"])
    workspace_repo = DynamoWorkspaceRepository(os.environ["WORKSPACES_TABLE"])
    tag_definitions = DynamoTagDefinitionRepository(os.environ["TAG_DEFINITIONS_TABLE"])
    organization_memberships = DynamoOrganizationMembershipRepository(os.environ["ORGANIZATION_MEMBERSHIPS_TABLE"])
    workspace_memberships = DynamoWorkspaceMembershipRepository(os.environ["WORKSPACE_MEMBERSHIPS_TABLE"])
    principals = DynamoPrincipalRepository(os.environ["PRINCIPALS_TABLE"])
    role_repo = DynamoRoleRepository(os.environ["ROLES_TABLE"])
    bootstrap = DynamoBootstrapStateRepository(os.environ["BOOTSTRAP_TABLE"])
    states = DynamoEnvironmentStateRepository(os.environ["ENVIRONMENT_STATE_TABLE"])
    executions = DynamoDeploymentRepository(os.environ["DEPLOYMENT_EXECUTIONS_TABLE"])
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
        release_sets=release_sets,
        components=components,
        environments=environments,
    )
    planner = PlanDeploymentUseCase(
        release_sets=release_sets,
        releases=releases,
        environments=environments,
        executions=executions,
        runner_eligibility=runner_eligibility,
    )
    return Container(
        components=ComponentUseCases(components, events=events),
        release_sets=ReleaseSetUseCases(release_sets=release_sets, components=components, releases=releases, executions=executions, clock=clock, events=events),
        releases=ReleaseUseCases(releases, events=events),
        publishers=PublisherUseCases(
            publishers=publishers,
            releases=releases,
            release_sets=release_sets,
            clock=clock,
            principals=identity,
            events=events,
        ),
        environments=EnvironmentUseCases(environments, events=events),
        tag_definitions=TagDefinitionUseCases(tag_definitions),
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
            release_sets=release_sets,
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



