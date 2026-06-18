from collections.abc import Iterable
from dataclasses import dataclass, field

from src.domain.enums import ExecutionStatus
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploymentRunner,
    DeploySet,
    Environment,
    EnvironmentState,
    EventLogEntry,
    BootstrapState,
    Organization,
    OrganizationMembership,
    Principal,
    Release,
    ReleaseSource,
    Role,
    Workspace,
    WorkspaceMembership,
    Webhook,
    WebhookDelivery,
)


@dataclass
class MemoryRepositories:
    organizations: dict[str, Organization] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    organization_memberships: dict[tuple[str, str], OrganizationMembership] = field(default_factory=dict)
    workspace_memberships: dict[tuple[str, str], WorkspaceMembership] = field(default_factory=dict)
    components: dict[tuple[str, str], Component] = field(default_factory=dict)
    component_sets: dict[tuple[str, str], ComponentSet] = field(default_factory=dict)
    releases: dict[tuple[str, str, str], Release] = field(default_factory=dict)
    release_sources: dict[tuple[str, str], ReleaseSource] = field(default_factory=dict)
    deploysets: dict[tuple[str, str], DeploySet] = field(default_factory=dict)
    environments: dict[tuple[str, str], Environment] = field(default_factory=dict)
    deployment_runners: dict[tuple[str, str], DeploymentRunner] = field(default_factory=dict)
    principals: dict[str, Principal] = field(default_factory=dict)
    roles: dict[tuple[str, str], Role] = field(default_factory=dict)
    bootstrap: BootstrapState = field(default_factory=BootstrapState)
    environment_states: dict[tuple[str, str], EnvironmentState] = field(default_factory=dict)
    deployment_executions: dict[tuple[str, str], DeploymentExecution] = field(default_factory=dict)
    event_log: dict[str, EventLogEntry] = field(default_factory=dict)
    webhooks: dict[tuple[str, str], Webhook] = field(default_factory=dict)
    webhook_deliveries: dict[tuple[str, str], WebhookDelivery] = field(default_factory=dict)

    def get_organization(self, organization_id: str) -> Organization | None:
        return self.organizations.get(organization_id)

    def list_organizations(self) -> list[Organization]:
        return sorted(self.organizations.values(), key=lambda item: item.organization_id)

    def put_organization(self, organization: Organization) -> None:
        self.organizations[organization.organization_id] = organization

    def get_workspace(self, workspace_id: str) -> Workspace | None:
        return self.workspaces.get(workspace_id)

    def list_workspaces(self, organization_id: str | None = None) -> list[Workspace]:
        values: Iterable[Workspace] = self.workspaces.values()
        if organization_id is not None:
            values = (item for item in values if item.organization_id == organization_id)
        return sorted(values, key=lambda item: item.workspace_id)

    def put_workspace(self, workspace: Workspace) -> None:
        self.workspaces[workspace.workspace_id] = workspace

    def get_organization_membership(self, organization_id: str, principal_id: str) -> OrganizationMembership | None:
        return self.organization_memberships.get((organization_id, principal_id))

    def list_organization_memberships(
        self,
        organization_id: str | None = None,
        principal_id: str | None = None,
    ) -> list[OrganizationMembership]:
        values: Iterable[OrganizationMembership] = self.organization_memberships.values()
        if organization_id is not None:
            values = (item for item in values if item.organization_id == organization_id)
        if principal_id is not None:
            values = (item for item in values if item.principal_id == principal_id)
        return sorted(values, key=lambda item: (item.organization_id, item.principal_id))

    def put_organization_membership(self, membership: OrganizationMembership) -> None:
        self.organization_memberships[(membership.organization_id, membership.principal_id)] = membership

    def get_workspace_membership(self, workspace_id: str, principal_id: str) -> WorkspaceMembership | None:
        return self.workspace_memberships.get((workspace_id, principal_id))

    def list_workspace_memberships(
        self,
        workspace_id: str | None = None,
        principal_id: str | None = None,
    ) -> list[WorkspaceMembership]:
        values: Iterable[WorkspaceMembership] = self.workspace_memberships.values()
        if workspace_id is not None:
            values = (item for item in values if item.workspace_id == workspace_id)
        if principal_id is not None:
            values = (item for item in values if item.principal_id == principal_id)
        return sorted(values, key=lambda item: (item.workspace_id, item.principal_id))

    def put_workspace_membership(self, membership: WorkspaceMembership) -> None:
        self.workspace_memberships[(membership.workspace_id, membership.principal_id)] = membership

    def get_component(self, component_id: str, workspace_id: str = "default") -> Component | None:
        return self.components.get((workspace_id, component_id))

    def list_components(self, workspace_id: str = "default") -> list[Component]:
        return sorted((item for item in self.components.values() if item.workspace_id == workspace_id), key=lambda item: item.component_id)

    def put_component(self, component: Component) -> None:
        self.components[(component.workspace_id, component.component_id)] = component

    def get_component_set(self, component_set_id: str, workspace_id: str = "default") -> ComponentSet | None:
        return self.component_sets.get((workspace_id, component_set_id))

    def list_component_sets(self, workspace_id: str = "default") -> list[ComponentSet]:
        return sorted((item for item in self.component_sets.values() if item.workspace_id == workspace_id), key=lambda item: item.component_set_id)

    def put_component_set(self, component_set: ComponentSet) -> None:
        self.component_sets[(component_set.workspace_id, component_set.component_set_id)] = component_set

    def get_release(self, component_id: str, version: str, workspace_id: str = "default") -> Release | None:
        return self.releases.get((workspace_id, component_id, version))

    def create_release(self, release: Release) -> None:
        key = (release.workspace_id, release.component_id, release.version)
        if key in self.releases:
            raise ConflictError(f"Release already exists: {release.component_id}/{release.version}")
        self.releases[key] = release

    def list_releases(self, component_id: str | None = None, workspace_id: str = "default") -> list[Release]:
        values: Iterable[Release] = (item for item in self.releases.values() if item.workspace_id == workspace_id)
        if component_id is not None:
            values = (item for item in values if item.component_id == component_id)
        return sorted(values, key=lambda item: (item.component_id, item.version))

    def get_release_source(self, release_source_id: str, workspace_id: str = "default") -> ReleaseSource | None:
        return self.release_sources.get((workspace_id, release_source_id))

    def list_release_sources(self, workspace_id: str = "default") -> list[ReleaseSource]:
        return sorted((item for item in self.release_sources.values() if item.workspace_id == workspace_id), key=lambda item: item.release_source_id)

    def put_release_source(self, release_source: ReleaseSource) -> None:
        self.release_sources[(release_source.workspace_id, release_source.release_source_id)] = release_source

    def get_deployset(self, deployset_id: str, workspace_id: str = "default") -> DeploySet | None:
        return self.deploysets.get((workspace_id, deployset_id))

    def create_deployset(self, deployset: DeploySet) -> None:
        key = (deployset.workspace_id, deployset.deployset_id)
        if key in self.deploysets:
            raise ConflictError(f"DeploySet already exists: {deployset.deployset_id}")
        self.deploysets[key] = deployset

    def list_deploysets(self, workspace_id: str = "default") -> list[DeploySet]:
        return sorted((item for item in self.deploysets.values() if item.workspace_id == workspace_id), key=lambda item: item.deployset_id)

    def get_environment(self, environment_id: str, workspace_id: str = "default") -> Environment | None:
        return self.environments.get((workspace_id, environment_id))

    def list_environments(self, workspace_id: str = "default") -> list[Environment]:
        return sorted((item for item in self.environments.values() if item.workspace_id == workspace_id), key=lambda item: item.environment_id)

    def put_environment(self, environment: Environment) -> None:
        self.environments[(environment.workspace_id, environment.environment_id)] = environment

    def get_deployment_runner(self, runner_id: str, workspace_id: str = "default") -> DeploymentRunner | None:
        return self.deployment_runners.get((workspace_id, runner_id))

    def list_deployment_runners(self, workspace_id: str = "default") -> list[DeploymentRunner]:
        return sorted((item for item in self.deployment_runners.values() if item.workspace_id == workspace_id), key=lambda item: item.runner_id)

    def put_deployment_runner(self, runner: DeploymentRunner) -> None:
        self.deployment_runners[(runner.workspace_id, runner.runner_id)] = runner

    def get_principal(self, principal_id: str) -> Principal | None:
        return self.principals.get(principal_id)

    def get_principal_by_oidc(self, external_issuer: str, external_subject: str) -> Principal | None:
        return next(
            (
                principal
                for principal in self.principals.values()
                if principal.type == "user"
                and principal.external_issuer == external_issuer
                and principal.external_subject == external_subject
            ),
            None,
        )

    def list_principals(self) -> list[Principal]:
        return sorted(self.principals.values(), key=lambda item: item.principal_id)

    def put_principal(self, principal: Principal) -> None:
        self.principals[principal.principal_id] = principal

    def get_role(self, role_id: str, workspace_id: str = "default") -> Role | None:
        return self.roles.get((workspace_id, role_id))

    def list_roles(self, workspace_id: str = "default") -> list[Role]:
        return sorted((item for item in self.roles.values() if item.workspace_id == workspace_id), key=lambda item: item.role_id)

    def put_role(self, role: Role) -> None:
        self.roles[(role.workspace_id, role.role_id)] = role

    def get_bootstrap_state(self) -> BootstrapState:
        return self.bootstrap

    def put_bootstrap_state(self, state: BootstrapState) -> None:
        self.bootstrap = state

    def get_environment_state(self, environment_id: str, workspace_id: str = "default") -> EnvironmentState | None:
        return self.environment_states.get((workspace_id, environment_id))

    def list_environment_states(self, workspace_id: str = "default") -> list[EnvironmentState]:
        return sorted((item for item in self.environment_states.values() if item.workspace_id == workspace_id), key=lambda item: item.environment_id)

    def put_environment_state(self, state: EnvironmentState) -> None:
        self.environment_states[(state.workspace_id, state.environment_id)] = state

    def get_deployment_execution(self, deployment_execution_id: str, workspace_id: str = "default") -> DeploymentExecution | None:
        return self.deployment_executions.get((workspace_id, deployment_execution_id))

    def create_deployment_execution(self, execution: DeploymentExecution) -> None:
        key = (execution.workspace_id, execution.deployment_execution_id)
        if key in self.deployment_executions:
            raise ConflictError(f"DeploymentExecution already exists: {execution.deployment_execution_id}")
        self.deployment_executions[key] = execution

    def put_deployment_execution(self, execution: DeploymentExecution) -> None:
        self.deployment_executions[(execution.workspace_id, execution.deployment_execution_id)] = execution

    def list_deployment_executions(self, environment_id: str | None = None, workspace_id: str = "default") -> list[DeploymentExecution]:
        values: Iterable[DeploymentExecution] = (item for item in self.deployment_executions.values() if item.workspace_id == workspace_id)
        if environment_id is not None:
            values = (item for item in values if item.environment_id == environment_id)
        return sorted(values, key=lambda item: (item.started_at, item.deployment_execution_id), reverse=True)

    def latest_deployment_execution(self, environment_id: str, workspace_id: str = "default") -> DeploymentExecution | None:
        executions = self.list_deployment_executions(environment_id, workspace_id)
        return executions[0] if executions else None

    def list_pending_deployment_executions(self, workspace_id: str = "default") -> list[DeploymentExecution]:
        return sorted(
            (item for item in self.deployment_executions.values() if item.workspace_id == workspace_id and item.status == ExecutionStatus.PENDING),
            key=lambda item: (item.started_at, item.deployment_execution_id),
        )

    def append_event(self, event: EventLogEntry) -> None:
        self.event_log[event.event_id] = event

    def get_event(self, event_id: str) -> EventLogEntry | None:
        return self.event_log.get(event_id)

    def list_events(
        self,
        *,
        limit: int = 50,
        cursor: str | None = None,
        actor_principal_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        category: str | None = None,
        action: str | None = None,
        origin: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
    ) -> tuple[list[EventLogEntry], str | None]:
        events = sorted(self.event_log.values(), key=lambda item: (item.occurred_at, item.event_id), reverse=True)
        if actor_principal_id:
            events = [event for event in events if event.actor_principal_id == actor_principal_id]
        if resource_type:
            events = [event for event in events if event.resource_type == resource_type]
        if resource_id:
            events = [event for event in events if event.resource_id == resource_id]
        if category:
            events = [event for event in events if event.category == category]
        if action:
            events = [event for event in events if event.action == action]
        if origin:
            events = [event for event in events if event.origin == origin]
        if from_time:
            events = [event for event in events if event.occurred_at >= from_time]
        if to_time:
            events = [event for event in events if event.occurred_at <= to_time]

        start = int(cursor) if cursor else 0
        window = events[start:start + limit]
        next_cursor = str(start + limit) if start + limit < len(events) else None
        return window, next_cursor

    def get_webhook(self, webhook_id: str, workspace_id: str = "default") -> Webhook | None:
        return self.webhooks.get((workspace_id, webhook_id))

    def list_webhooks(self, workspace_id: str = "default") -> list[Webhook]:
        return sorted((item for item in self.webhooks.values() if item.workspace_id == workspace_id), key=lambda item: item.webhook_id)

    def put_webhook(self, webhook: Webhook) -> None:
        self.webhooks[(webhook.workspace_id, webhook.webhook_id)] = webhook

    def get_webhook_delivery(self, webhook_delivery_id: str, workspace_id: str = "default") -> WebhookDelivery | None:
        return self.webhook_deliveries.get((workspace_id, webhook_delivery_id))

    def list_webhook_deliveries(
        self,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        workspace_id: str = "default",
    ) -> list[WebhookDelivery]:
        deliveries = sorted(
            (item for item in self.webhook_deliveries.values() if item.workspace_id == workspace_id),
            key=lambda item: (item.created_at, item.webhook_delivery_id),
            reverse=True,
        )
        if webhook_id:
            deliveries = [delivery for delivery in deliveries if delivery.webhook_id == webhook_id]
        if event_id:
            deliveries = [delivery for delivery in deliveries if delivery.event_id == event_id]
        if status:
            deliveries = [delivery for delivery in deliveries if delivery.status == status]
        if resource_type:
            deliveries = [delivery for delivery in deliveries if delivery.envelope.resource.type == resource_type]
        if resource_id:
            deliveries = [delivery for delivery in deliveries if delivery.envelope.resource.id == resource_id]
        return deliveries

    def put_webhook_delivery(self, delivery: WebhookDelivery) -> None:
        self.webhook_deliveries[(delivery.workspace_id, delivery.webhook_delivery_id)] = delivery


class MemoryOrganizationRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, organization_id: str) -> Organization | None:
        return self.store.get_organization(organization_id)

    def list(self) -> list[Organization]:
        return self.store.list_organizations()

    def put(self, organization: Organization) -> None:
        self.store.put_organization(organization)


class MemoryWorkspaceRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, workspace_id: str) -> Workspace | None:
        return self.store.get_workspace(workspace_id)

    def list(self, organization_id: str | None = None) -> list[Workspace]:
        return self.store.list_workspaces(organization_id)

    def put(self, workspace: Workspace) -> None:
        self.store.put_workspace(workspace)


class MemoryOrganizationMembershipRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, organization_id: str, principal_id: str) -> OrganizationMembership | None:
        return self.store.get_organization_membership(organization_id, principal_id)

    def list(self, organization_id: str | None = None, principal_id: str | None = None) -> list[OrganizationMembership]:
        return self.store.list_organization_memberships(organization_id, principal_id)

    def put(self, membership: OrganizationMembership) -> None:
        self.store.put_organization_membership(membership)


class MemoryWorkspaceMembershipRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, workspace_id: str, principal_id: str) -> WorkspaceMembership | None:
        return self.store.get_workspace_membership(workspace_id, principal_id)

    def list(self, workspace_id: str | None = None, principal_id: str | None = None) -> list[WorkspaceMembership]:
        return self.store.list_workspace_memberships(workspace_id, principal_id)

    def put(self, membership: WorkspaceMembership) -> None:
        self.store.put_workspace_membership(membership)


class MemoryComponentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str, workspace_id: str = "default") -> Component | None:
        return self.store.get_component(component_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[Component]:
        return self.store.list_components(workspace_id)

    def put(self, component: Component) -> None:
        self.store.put_component(component)


class MemoryComponentSetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_set_id: str, workspace_id: str = "default") -> ComponentSet | None:
        return self.store.get_component_set(component_set_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[ComponentSet]:
        return self.store.list_component_sets(workspace_id)

    def put(self, component_set: ComponentSet) -> None:
        self.store.put_component_set(component_set)


class MemoryReleaseRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str, version: str, workspace_id: str = "default") -> Release | None:
        return self.store.get_release(component_id, version, workspace_id)

    def create(self, release: Release) -> None:
        self.store.create_release(release)

    def list_by_component(self, component_id: str | None = None, workspace_id: str = "default") -> list[Release]:
        return self.store.list_releases(component_id, workspace_id)


class MemoryReleaseSourceRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, release_source_id: str, workspace_id: str = "default") -> ReleaseSource | None:
        return self.store.get_release_source(release_source_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[ReleaseSource]:
        return self.store.list_release_sources(workspace_id)

    def put(self, release_source: ReleaseSource) -> None:
        self.store.put_release_source(release_source)


class MemoryDeploySetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployset_id: str, workspace_id: str = "default") -> DeploySet | None:
        return self.store.get_deployset(deployset_id, workspace_id)

    def create(self, deployset: DeploySet) -> None:
        self.store.create_deployset(deployset)

    def list(self, workspace_id: str = "default") -> list[DeploySet]:
        return self.store.list_deploysets(workspace_id)


class MemoryEnvironmentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, environment_id: str, workspace_id: str = "default") -> Environment | None:
        return self.store.get_environment(environment_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[Environment]:
        return self.store.list_environments(workspace_id)

    def put(self, environment: Environment) -> None:
        self.store.put_environment(environment)


class MemoryDeploymentRunnerRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, runner_id: str, workspace_id: str = "default") -> DeploymentRunner | None:
        return self.store.get_deployment_runner(runner_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[DeploymentRunner]:
        return self.store.list_deployment_runners(workspace_id)

    def put(self, runner: DeploymentRunner) -> None:
        self.store.put_deployment_runner(runner)


class MemoryPrincipalRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, principal_id: str) -> Principal | None:
        return self.store.get_principal(principal_id)

    def get_by_oidc(self, external_issuer: str, external_subject: str) -> Principal | None:
        return self.store.get_principal_by_oidc(external_issuer, external_subject)

    def list(self) -> list[Principal]:
        return self.store.list_principals()

    def put(self, principal: Principal) -> None:
        self.store.put_principal(principal)


class MemoryRoleRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, role_id: str, workspace_id: str = "default") -> Role | None:
        return self.store.get_role(role_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[Role]:
        return self.store.list_roles(workspace_id)

    def put(self, role: Role) -> None:
        self.store.put_role(role)


class MemoryBootstrapStateRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self) -> BootstrapState:
        return self.store.get_bootstrap_state()

    def put(self, state: BootstrapState) -> None:
        self.store.put_bootstrap_state(state)


class MemoryEnvironmentStateRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, environment_id: str, workspace_id: str = "default") -> EnvironmentState | None:
        return self.store.get_environment_state(environment_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[EnvironmentState]:
        return self.store.list_environment_states(workspace_id)

    def put(self, state: EnvironmentState) -> None:
        self.store.put_environment_state(state)


class MemoryDeploymentExecutionRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployment_execution_id: str, workspace_id: str = "default") -> DeploymentExecution | None:
        return self.store.get_deployment_execution(deployment_execution_id, workspace_id)

    def create(self, execution: DeploymentExecution) -> None:
        self.store.create_deployment_execution(execution)

    def put(self, execution: DeploymentExecution) -> None:
        self.store.put_deployment_execution(execution)

    def list_by_environment(self, environment_id: str | None = None, workspace_id: str = "default") -> list[DeploymentExecution]:
        return self.store.list_deployment_executions(environment_id, workspace_id)

    def latest_for_environment(self, environment_id: str, workspace_id: str = "default") -> DeploymentExecution | None:
        return self.store.latest_deployment_execution(environment_id, workspace_id)

    def list_pending(self, workspace_id: str = "default") -> list[DeploymentExecution]:
        return self.store.list_pending_deployment_executions(workspace_id)


class MemoryEventLogRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def append(self, event: EventLogEntry) -> None:
        self.store.append_event(event)

    def get(self, event_id: str) -> EventLogEntry | None:
        return self.store.get_event(event_id)

    def list(
        self,
        *,
        limit: int = 50,
        cursor: str | None = None,
        actor_principal_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        category: str | None = None,
        action: str | None = None,
        origin: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
    ) -> tuple[list[EventLogEntry], str | None]:
        return self.store.list_events(
            limit=limit,
            cursor=cursor,
            actor_principal_id=actor_principal_id,
            resource_type=resource_type,
            resource_id=resource_id,
            category=category,
            action=action,
            origin=origin,
            from_time=from_time,
            to_time=to_time,
        )


class MemoryWebhookRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, webhook_id: str, workspace_id: str = "default") -> Webhook | None:
        return self.store.get_webhook(webhook_id, workspace_id)

    def list(self, workspace_id: str = "default") -> list[Webhook]:
        return self.store.list_webhooks(workspace_id)

    def put(self, webhook: Webhook) -> None:
        self.store.put_webhook(webhook)


class MemoryWebhookDeliveryRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, webhook_delivery_id: str, workspace_id: str = "default") -> WebhookDelivery | None:
        return self.store.get_webhook_delivery(webhook_delivery_id, workspace_id)

    def list(
        self,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        workspace_id: str = "default",
    ) -> list[WebhookDelivery]:
        return self.store.list_webhook_deliveries(
            webhook_id=webhook_id,
            event_id=event_id,
            status=status,
            resource_type=resource_type,
            resource_id=resource_id,
            workspace_id=workspace_id,
        )

    def put(self, delivery: WebhookDelivery) -> None:
        self.store.put_webhook_delivery(delivery)
