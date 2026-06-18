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
    Principal,
    Release,
    ReleaseSource,
    Role,
    Webhook,
    WebhookDelivery,
)


@dataclass
class MemoryRepositories:
    components: dict[str, Component] = field(default_factory=dict)
    component_sets: dict[str, ComponentSet] = field(default_factory=dict)
    releases: dict[tuple[str, str], Release] = field(default_factory=dict)
    release_sources: dict[str, ReleaseSource] = field(default_factory=dict)
    deploysets: dict[str, DeploySet] = field(default_factory=dict)
    environments: dict[str, Environment] = field(default_factory=dict)
    deployment_runners: dict[str, DeploymentRunner] = field(default_factory=dict)
    principals: dict[str, Principal] = field(default_factory=dict)
    roles: dict[str, Role] = field(default_factory=dict)
    bootstrap: BootstrapState = field(default_factory=BootstrapState)
    environment_states: dict[str, EnvironmentState] = field(default_factory=dict)
    deployment_executions: dict[str, DeploymentExecution] = field(default_factory=dict)
    event_log: dict[str, EventLogEntry] = field(default_factory=dict)
    webhooks: dict[str, Webhook] = field(default_factory=dict)
    webhook_deliveries: dict[str, WebhookDelivery] = field(default_factory=dict)

    def get_component(self, component_id: str) -> Component | None:
        return self.components.get(component_id)

    def list_components(self) -> list[Component]:
        return sorted(self.components.values(), key=lambda item: item.component_id)

    def put_component(self, component: Component) -> None:
        self.components[component.component_id] = component

    def get_component_set(self, component_set_id: str) -> ComponentSet | None:
        return self.component_sets.get(component_set_id)

    def list_component_sets(self) -> list[ComponentSet]:
        return sorted(self.component_sets.values(), key=lambda item: item.component_set_id)

    def put_component_set(self, component_set: ComponentSet) -> None:
        self.component_sets[component_set.component_set_id] = component_set

    def get_release(self, component_id: str, version: str) -> Release | None:
        return self.releases.get((component_id, version))

    def create_release(self, release: Release) -> None:
        key = (release.component_id, release.version)
        if key in self.releases:
            raise ConflictError(f"Release already exists: {release.component_id}/{release.version}")
        self.releases[key] = release

    def list_releases(self, component_id: str | None = None) -> list[Release]:
        values: Iterable[Release] = self.releases.values()
        if component_id is not None:
            values = (item for item in values if item.component_id == component_id)
        return sorted(values, key=lambda item: (item.component_id, item.version))

    def get_release_source(self, release_source_id: str) -> ReleaseSource | None:
        return self.release_sources.get(release_source_id)

    def list_release_sources(self) -> list[ReleaseSource]:
        return sorted(self.release_sources.values(), key=lambda item: item.release_source_id)

    def put_release_source(self, release_source: ReleaseSource) -> None:
        self.release_sources[release_source.release_source_id] = release_source

    def get_deployset(self, deployset_id: str) -> DeploySet | None:
        return self.deploysets.get(deployset_id)

    def create_deployset(self, deployset: DeploySet) -> None:
        if deployset.deployset_id in self.deploysets:
            raise ConflictError(f"DeploySet already exists: {deployset.deployset_id}")
        self.deploysets[deployset.deployset_id] = deployset

    def list_deploysets(self) -> list[DeploySet]:
        return sorted(self.deploysets.values(), key=lambda item: item.deployset_id)

    def get_environment(self, environment_id: str) -> Environment | None:
        return self.environments.get(environment_id)

    def list_environments(self) -> list[Environment]:
        return sorted(self.environments.values(), key=lambda item: item.environment_id)

    def put_environment(self, environment: Environment) -> None:
        self.environments[environment.environment_id] = environment

    def get_deployment_runner(self, runner_id: str) -> DeploymentRunner | None:
        return self.deployment_runners.get(runner_id)

    def list_deployment_runners(self) -> list[DeploymentRunner]:
        return sorted(self.deployment_runners.values(), key=lambda item: item.runner_id)

    def put_deployment_runner(self, runner: DeploymentRunner) -> None:
        self.deployment_runners[runner.runner_id] = runner

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

    def get_role(self, role_id: str) -> Role | None:
        return self.roles.get(role_id)

    def list_roles(self) -> list[Role]:
        return sorted(self.roles.values(), key=lambda item: item.role_id)

    def put_role(self, role: Role) -> None:
        self.roles[role.role_id] = role

    def get_bootstrap_state(self) -> BootstrapState:
        return self.bootstrap

    def put_bootstrap_state(self, state: BootstrapState) -> None:
        self.bootstrap = state

    def get_environment_state(self, environment_id: str) -> EnvironmentState | None:
        return self.environment_states.get(environment_id)

    def list_environment_states(self) -> list[EnvironmentState]:
        return sorted(self.environment_states.values(), key=lambda item: item.environment_id)

    def put_environment_state(self, state: EnvironmentState) -> None:
        self.environment_states[state.environment_id] = state

    def get_deployment_execution(self, deployment_execution_id: str) -> DeploymentExecution | None:
        return self.deployment_executions.get(deployment_execution_id)

    def create_deployment_execution(self, execution: DeploymentExecution) -> None:
        if execution.deployment_execution_id in self.deployment_executions:
            raise ConflictError(f"DeploymentExecution already exists: {execution.deployment_execution_id}")
        self.deployment_executions[execution.deployment_execution_id] = execution

    def put_deployment_execution(self, execution: DeploymentExecution) -> None:
        self.deployment_executions[execution.deployment_execution_id] = execution

    def list_deployment_executions(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        values: Iterable[DeploymentExecution] = self.deployment_executions.values()
        if environment_id is not None:
            values = (item for item in values if item.environment_id == environment_id)
        return sorted(values, key=lambda item: (item.started_at, item.deployment_execution_id), reverse=True)

    def latest_deployment_execution(self, environment_id: str) -> DeploymentExecution | None:
        executions = self.list_deployment_executions(environment_id)
        return executions[0] if executions else None

    def list_pending_deployment_executions(self) -> list[DeploymentExecution]:
        return sorted(
            (item for item in self.deployment_executions.values() if item.status == ExecutionStatus.PENDING),
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

    def get_webhook(self, webhook_id: str) -> Webhook | None:
        return self.webhooks.get(webhook_id)

    def list_webhooks(self) -> list[Webhook]:
        return sorted(self.webhooks.values(), key=lambda item: item.webhook_id)

    def put_webhook(self, webhook: Webhook) -> None:
        self.webhooks[webhook.webhook_id] = webhook

    def get_webhook_delivery(self, webhook_delivery_id: str) -> WebhookDelivery | None:
        return self.webhook_deliveries.get(webhook_delivery_id)

    def list_webhook_deliveries(
        self,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> list[WebhookDelivery]:
        deliveries = sorted(
            self.webhook_deliveries.values(),
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
        self.webhook_deliveries[delivery.webhook_delivery_id] = delivery


class MemoryComponentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str) -> Component | None:
        return self.store.get_component(component_id)

    def list(self) -> list[Component]:
        return self.store.list_components()

    def put(self, component: Component) -> None:
        self.store.put_component(component)


class MemoryComponentSetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_set_id: str) -> ComponentSet | None:
        return self.store.get_component_set(component_set_id)

    def list(self) -> list[ComponentSet]:
        return self.store.list_component_sets()

    def put(self, component_set: ComponentSet) -> None:
        self.store.put_component_set(component_set)


class MemoryReleaseRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, component_id: str, version: str) -> Release | None:
        return self.store.get_release(component_id, version)

    def create(self, release: Release) -> None:
        self.store.create_release(release)

    def list_by_component(self, component_id: str | None = None) -> list[Release]:
        return self.store.list_releases(component_id)


class MemoryReleaseSourceRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, release_source_id: str) -> ReleaseSource | None:
        return self.store.get_release_source(release_source_id)

    def list(self) -> list[ReleaseSource]:
        return self.store.list_release_sources()

    def put(self, release_source: ReleaseSource) -> None:
        self.store.put_release_source(release_source)


class MemoryDeploySetRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployset_id: str) -> DeploySet | None:
        return self.store.get_deployset(deployset_id)

    def create(self, deployset: DeploySet) -> None:
        self.store.create_deployset(deployset)

    def list(self) -> list[DeploySet]:
        return self.store.list_deploysets()


class MemoryEnvironmentRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, environment_id: str) -> Environment | None:
        return self.store.get_environment(environment_id)

    def list(self) -> list[Environment]:
        return self.store.list_environments()

    def put(self, environment: Environment) -> None:
        self.store.put_environment(environment)


class MemoryDeploymentRunnerRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, runner_id: str) -> DeploymentRunner | None:
        return self.store.get_deployment_runner(runner_id)

    def list(self) -> list[DeploymentRunner]:
        return self.store.list_deployment_runners()

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

    def get(self, role_id: str) -> Role | None:
        return self.store.get_role(role_id)

    def list(self) -> list[Role]:
        return self.store.list_roles()

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

    def get(self, environment_id: str) -> EnvironmentState | None:
        return self.store.get_environment_state(environment_id)

    def list(self) -> list[EnvironmentState]:
        return self.store.list_environment_states()

    def put(self, state: EnvironmentState) -> None:
        self.store.put_environment_state(state)


class MemoryDeploymentExecutionRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, deployment_execution_id: str) -> DeploymentExecution | None:
        return self.store.get_deployment_execution(deployment_execution_id)

    def create(self, execution: DeploymentExecution) -> None:
        self.store.create_deployment_execution(execution)

    def put(self, execution: DeploymentExecution) -> None:
        self.store.put_deployment_execution(execution)

    def list_by_environment(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        return self.store.list_deployment_executions(environment_id)

    def latest_for_environment(self, environment_id: str) -> DeploymentExecution | None:
        return self.store.latest_deployment_execution(environment_id)

    def list_pending(self) -> list[DeploymentExecution]:
        return self.store.list_pending_deployment_executions()


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

    def get(self, webhook_id: str) -> Webhook | None:
        return self.store.get_webhook(webhook_id)

    def list(self) -> list[Webhook]:
        return self.store.list_webhooks()

    def put(self, webhook: Webhook) -> None:
        self.store.put_webhook(webhook)


class MemoryWebhookDeliveryRepository:
    def __init__(self, store: MemoryRepositories) -> None:
        self.store = store

    def get(self, webhook_delivery_id: str) -> WebhookDelivery | None:
        return self.store.get_webhook_delivery(webhook_delivery_id)

    def list(
        self,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> list[WebhookDelivery]:
        return self.store.list_webhook_deliveries(
            webhook_id=webhook_id,
            event_id=event_id,
            status=status,
            resource_type=resource_type,
            resource_id=resource_id,
        )

    def put(self, delivery: WebhookDelivery) -> None:
        self.store.put_webhook_delivery(delivery)
