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
from src.composition.local_seed import seed_local_data
from src.infrastructure.ids import EventIdGenerator, UuidIdGenerator, WebhookDeliveryIdGenerator
from src.infrastructure.memory.repositories import (
    MemoryComponentRepository,
    MemoryReleaseSetRepository,
    MemoryDeploymentRepository,
    MemoryDeploymentRunnerRepository,
    MemoryEnvironmentRepository,
    MemoryEnvironmentStateRepository,
    MemoryEventLogRepository,
    MemoryBootstrapStateRepository,
    MemoryOrganizationMembershipRepository,
    MemoryOrganizationRepository,
    MemoryPrincipalRepository,
    MemoryReleaseRepository,
    MemoryPublisherRepository,
    MemoryRepositories,
    MemoryRoleRepository,
    MemoryTagDefinitionRepository,
    MemoryWorkspaceMembershipRepository,
    MemoryWorkspaceRepository,
    MemoryWebhookDeliveryRepository,
    MemoryWebhookRepository,
)
from src.infrastructure.time import SystemClock


def build_memory_container(store: MemoryRepositories | None = None) -> Container:
    seeded = store is None
    store = store or MemoryRepositories()
    if seeded:
        seed_local_data(store)
    components = MemoryComponentRepository(store)
    release_sets = MemoryReleaseSetRepository(store)
    releases = MemoryReleaseRepository(store)
    publishers = MemoryPublisherRepository(store)
    environments = MemoryEnvironmentRepository(store)
    runners = MemoryDeploymentRunnerRepository(store)
    organization_repo = MemoryOrganizationRepository(store)
    workspace_repo = MemoryWorkspaceRepository(store)
    tag_definitions = MemoryTagDefinitionRepository(store)
    organization_memberships = MemoryOrganizationMembershipRepository(store)
    workspace_memberships = MemoryWorkspaceMembershipRepository(store)
    principals = MemoryPrincipalRepository(store)
    role_repo = MemoryRoleRepository(store)
    bootstrap = MemoryBootstrapStateRepository(store)
    states = MemoryEnvironmentStateRepository(store)
    executions = MemoryDeploymentRepository(store)
    event_log = MemoryEventLogRepository(store)
    webhook_repo = MemoryWebhookRepository(store)
    webhook_deliveries = MemoryWebhookDeliveryRepository(store)
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



