import hashlib

from src.domain.enums import (
    DeploySetItemSource,
    ExecutionStatus,
    ItemStatus,
    ReportedAction,
    RequestedAction,
    RequestedReason,
)
from src.domain.models import (
    Artifact,
    Component,
    ComponentSet,
    ComponentSetItem,
    DeploySet,
    DeploySetItem,
    DeploymentExecution,
    DeploymentExecutionItem,
    Environment,
    EnvironmentState,
    Release,
    Source,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def _sha256(label: str) -> str:
    return hashlib.sha256(label.encode("utf-8")).hexdigest()


def _digest(label: str) -> str:
    return f"sha256:{_sha256(label)}"


def _artifact(component_id: str, version: str) -> Artifact:
    return Artifact(
        key=f"s3://deployset-artifacts/{component_id}/{version}/{component_id}-{version}.tar.gz",
        digest=_digest(f"{component_id}:{version}"),
    )


def _source(component_id: str, version: str) -> Source:
    return Source(
        key=f"git+https://git.example.com/{component_id}.git#{version}",
        digest=_digest(f"source:{component_id}:{version}"),
    )


def _release(component_id: str, version: str, *, created_at: str, created_by: str) -> Release:
    return Release(
        component_id=component_id,
        version=version,
        description=f"{component_id} release {version}",
        artifact=_artifact(component_id, version),
        source=_source(component_id, version),
        created_at=created_at,
        created_by=created_by,
        tags={"channel": "stable" if version.endswith(".0") else "candidate"},
    )


def _deployset_item(component_id: str, version: str) -> DeploySetItem:
    return DeploySetItem(component_id=component_id, version=version, source=DeploySetItemSource.EXPLICIT)


def _execution_item(
    *,
    component_id: str,
    version: str,
    requested_action: RequestedAction,
    status: ItemStatus,
    requested_reason: RequestedReason | None = None,
    reported_action: ReportedAction | None = None,
    reported_by: str | None = None,
    adapter_reason: str | None = None,
    message: str | None = None,
    error: str | None = None,
) -> DeploymentExecutionItem:
    return DeploymentExecutionItem(
        component_id=component_id,
        version=version,
        artifact=_artifact(component_id, version),
        requested_action=requested_action,
        reported_action=reported_action,
        status=status,
        requested_reason=requested_reason,
        adapter_reason=adapter_reason,
        reported_by=reported_by,
        message=message,
        error=error,
    )


def _seed_execution(store: MemoryRepositories, execution: DeploymentExecution, state: EnvironmentState) -> None:
    store.create_deployment_execution(execution)
    store.put_environment_state(state)


def seed_local_data(store: MemoryRepositories) -> None:
    if store.components:
        return

    # Components
    store.put_component(
        Component(
            component_id="web",
            type="ecs",
            active=True,
            tags={"team": "frontend", "tier": "customer-facing", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="api",
            type="ecs",
            active=True,
            tags={"team": "platform", "tier": "application", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="worker",
            type="lambda",
            active=True,
            tags={"team": "platform", "tier": "async", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="auth",
            type="ecs",
            active=True,
            tags={"team": "identity", "tier": "shared", "owner": "security"},
        )
    )
    store.put_component(
        Component(
            component_id="postgres",
            type="rds",
            active=True,
            tags={"team": "data", "tier": "database", "owner": "data-platform"},
        )
    )
    store.put_component(
        Component(
            component_id="redis",
            type="elasticache",
            active=True,
            tags={"team": "data", "tier": "cache", "owner": "data-platform"},
        )
    )

    # Component sets
    store.put_component_set(
        ComponentSet(
            component_set_id="local-platform",
            description="Primary application stack for the checkout and account experience.",
            components=[
                ComponentSetItem(component_id="web", required=True),
                ComponentSetItem(component_id="api", required=True),
                ComponentSetItem(component_id="worker", required=True),
                ComponentSetItem(component_id="auth", required=True),
            ],
            tags={"domain": "customer-app", "environment": "shared"},
            created_at="2026-04-01T09:00:00Z",
            created_by="platform-bootstrap",
        )
    )
    store.put_component_set(
        ComponentSet(
            component_set_id="data-services",
            description="Shared data services used by application stacks and batch jobs.",
            components=[
                ComponentSetItem(component_id="postgres", required=True),
                ComponentSetItem(component_id="redis", required=False),
            ],
            tags={"domain": "data-platform", "environment": "shared"},
            created_at="2026-04-03T09:00:00Z",
            created_by="data-platform-bootstrap",
        )
    )

    # Releases
    release_specs = [
        ("web", "3.18.0", "2026-04-18T09:00:00Z", "frontend-release-bot"),
        ("web", "3.18.1", "2026-05-02T10:15:00Z", "frontend-release-bot"),
        ("web", "3.19.0", "2026-06-01T08:40:00Z", "frontend-release-bot"),
        ("api", "5.6.0", "2026-04-14T07:30:00Z", "platform-release-bot"),
        ("api", "5.7.0", "2026-05-15T13:20:00Z", "platform-release-bot"),
        ("api", "5.7.1", "2026-06-05T14:05:00Z", "platform-release-bot"),
        ("worker", "5.6.0", "2026-04-09T06:45:00Z", "platform-release-bot"),
        ("worker", "5.7.0", "2026-05-20T12:00:00Z", "platform-release-bot"),
        ("auth", "2.14.0", "2026-03-22T15:00:00Z", "security-release-bot"),
        ("auth", "2.15.0", "2026-05-28T09:35:00Z", "security-release-bot"),
        ("postgres", "14.10.0", "2026-02-11T11:25:00Z", "data-release-bot"),
        ("postgres", "14.11.0", "2026-05-25T11:25:00Z", "data-release-bot"),
        ("redis", "7.0.10", "2026-03-05T16:10:00Z", "data-release-bot"),
        ("redis", "7.0.12", "2026-05-18T16:55:00Z", "data-release-bot"),
    ]
    for component_id, version, created_at, created_by in release_specs:
        store.create_release(_release(component_id, version, created_at=created_at, created_by=created_by))

    # DeploySets
    store.create_deployset(
        DeploySet(
            deployset_id="local-default",
            component_set_id="local-platform",
            schema_version=1,
            description="Default local app stack for demos and smoke testing.",
            items=[
                _deployset_item("web", "3.19.0"),
                _deployset_item("api", "5.7.1"),
                _deployset_item("worker", "5.7.0"),
                _deployset_item("auth", "2.15.0"),
            ],
            created_at="2026-06-01T09:10:00Z",
            created_by="release-manager",
            tags={"track": "local", "ring": "demo"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="local-hotfix",
            component_set_id="local-platform",
            schema_version=1,
            description="Hotfix variant of the local app stack with a patched web release.",
            items=[
                _deployset_item("web", "3.18.1"),
                _deployset_item("api", "5.7.1"),
                _deployset_item("worker", "5.7.0"),
                _deployset_item("auth", "2.15.0"),
            ],
            created_at="2026-06-04T16:30:00Z",
            created_by="release-manager",
            tags={"track": "local", "type": "hotfix"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="dev-default",
            component_set_id="local-platform",
            schema_version=1,
            description="Integration environment baseline for day-to-day development.",
            items=[
                _deployset_item("web", "3.19.0"),
                _deployset_item("api", "5.7.0"),
                _deployset_item("worker", "5.7.0"),
                _deployset_item("auth", "2.15.0"),
            ],
            created_at="2026-06-06T09:05:00Z",
            created_by="release-manager",
            tags={"track": "dev", "ring": "integration"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="staging-default",
            component_set_id="local-platform",
            schema_version=1,
            description="Pre-production stack used for release validation and smoke tests.",
            items=[
                _deployset_item("web", "3.18.1"),
                _deployset_item("api", "5.7.0"),
                _deployset_item("worker", "5.7.0"),
                _deployset_item("auth", "2.15.0"),
            ],
            created_at="2026-06-08T10:45:00Z",
            created_by="release-manager",
            tags={"track": "staging", "ring": "pre-prod"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="prod-default",
            component_set_id="local-platform",
            schema_version=1,
            description="Stable production baseline for the customer-facing stack.",
            items=[
                _deployset_item("web", "3.18.0"),
                _deployset_item("api", "5.6.0"),
                _deployset_item("worker", "5.6.0"),
                _deployset_item("auth", "2.14.0"),
            ],
            created_at="2026-06-09T08:20:00Z",
            created_by="change-manager",
            tags={"track": "prod", "ring": "stable"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="prod-hotfix",
            component_set_id="local-platform",
            schema_version=1,
            description="Production hotfix track with only the minimum approved change set.",
            items=[
                _deployset_item("web", "3.18.0"),
                _deployset_item("api", "5.6.0"),
                _deployset_item("worker", "5.6.0"),
                _deployset_item("auth", "2.15.0"),
            ],
            created_at="2026-06-12T13:15:00Z",
            created_by="change-manager",
            tags={"track": "prod", "type": "security-hotfix"},
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="data-default",
            component_set_id="data-services",
            schema_version=1,
            description="Shared data platform baseline for storage and cache services.",
            items=[
                _deployset_item("postgres", "14.11.0"),
                _deployset_item("redis", "7.0.12"),
            ],
            created_at="2026-06-07T07:50:00Z",
            created_by="data-release-manager",
            tags={"track": "shared-data", "ring": "stable"},
        )
    )

    # Environments
    store.put_environment(
        Environment(
            environment_id="local",
            active=True,
            tags={"kind": "developer-sandbox", "region": "local"},
        )
    )
    store.put_environment(
        Environment(
            environment_id="dev",
            active=True,
            tags={"kind": "integration", "region": "eu-west-1"},
        )
    )
    store.put_environment(
        Environment(
            environment_id="staging",
            active=True,
            tags={"kind": "pre-production", "region": "eu-west-1"},
        )
    )
    store.put_environment(
        Environment(
            environment_id="prod",
            active=True,
            tags={"kind": "production", "region": "eu-west-1"},
        )
    )
    store.put_environment(
        Environment(
            environment_id="shared-data",
            active=True,
            tags={"kind": "shared-service", "region": "eu-west-1"},
        )
    )

    # Deployment history
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-local-20260615-001",
            environment_id="local",
            deployset_id="local-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="dev@company.com",
            force=False,
            started_at="2026-06-15T09:05:00Z",
            completed_at="2026-06-15T09:18:00Z",
            claimed_by="local-runner-01",
            items=[
                _execution_item(
                    component_id="web",
                    version="3.19.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="local-runner-01",
                ),
                _execution_item(
                    component_id="api",
                    version="5.7.1",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="local-runner-01",
                ),
                _execution_item(
                    component_id="worker",
                    version="5.7.0",
                    requested_action=RequestedAction.SKIP,
                    status=ItemStatus.SKIPPED,
                    requested_reason=RequestedReason.LATEST_EXECUTION_ALREADY_SUCCEEDED,
                    reported_action=ReportedAction.SKIP,
                    reported_by="local-runner-01",
                    adapter_reason="worker already matched the desired version",
                ),
                _execution_item(
                    component_id="auth",
                    version="2.15.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="local-runner-01",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="local",
            deployset_id="local-default",
            status=ExecutionStatus.SUCCEEDED,
            last_deployment_execution_id="exec-local-20260615-001",
            updated_at="2026-06-15T09:18:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-dev-20260612-001",
            environment_id="dev",
            deployset_id="dev-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="ci:release-bot",
            force=False,
            started_at="2026-06-12T14:02:00Z",
            completed_at="2026-06-12T14:11:00Z",
            claimed_by="dev-runner-01",
            items=[
                _execution_item(
                    component_id="web",
                    version="3.19.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="dev-runner-01",
                ),
                _execution_item(
                    component_id="api",
                    version="5.7.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="dev-runner-01",
                ),
                _execution_item(
                    component_id="worker",
                    version="5.7.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="dev-runner-01",
                ),
                _execution_item(
                    component_id="auth",
                    version="2.15.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="dev-runner-01",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="dev",
            deployset_id="dev-default",
            status=ExecutionStatus.SUCCEEDED,
            last_deployment_execution_id="exec-dev-20260612-001",
            updated_at="2026-06-12T14:11:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-staging-20260613-001",
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.FAILED,
            requested_by="release-manager",
            force=False,
            started_at="2026-06-13T10:55:00Z",
            completed_at="2026-06-13T11:07:00Z",
            claimed_by="staging-runner-01",
            items=[
                _execution_item(
                    component_id="web",
                    version="3.18.1",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="staging-runner-01",
                ),
                _execution_item(
                    component_id="api",
                    version="5.7.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.FAILED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="staging-runner-01",
                    message="Deployment started but smoke tests failed.",
                    error="Checkout API readiness probe never returned healthy.",
                ),
                _execution_item(
                    component_id="worker",
                    version="5.7.0",
                    requested_action=RequestedAction.SKIP,
                    status=ItemStatus.SKIPPED,
                    requested_reason=RequestedReason.LATEST_EXECUTION_ALREADY_SUCCEEDED,
                    reported_action=ReportedAction.SKIP,
                    reported_by="staging-runner-01",
                    adapter_reason="no worker changes in this change set",
                ),
                _execution_item(
                    component_id="auth",
                    version="2.15.0",
                    requested_action=RequestedAction.SKIP,
                    status=ItemStatus.SKIPPED,
                    requested_reason=RequestedReason.LATEST_EXECUTION_ALREADY_SUCCEEDED,
                    reported_action=ReportedAction.SKIP,
                    reported_by="staging-runner-01",
                    adapter_reason="auth already matched the requested version",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.FAILED,
            last_deployment_execution_id="exec-staging-20260613-001",
            updated_at="2026-06-13T11:07:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-staging-20260616-001",
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.PENDING,
            requested_by="release-manager",
            force=False,
            started_at="2026-06-16T08:30:00Z",
            completed_at=None,
            claimed_by=None,
            items=[
                _execution_item(
                    component_id="web",
                    version="3.18.1",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
                _execution_item(
                    component_id="api",
                    version="5.7.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
                _execution_item(
                    component_id="worker",
                    version="5.7.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
                _execution_item(
                    component_id="auth",
                    version="2.15.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
            ],
        ),
        EnvironmentState(
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.PENDING,
            last_deployment_execution_id="exec-staging-20260616-001",
            updated_at="2026-06-16T08:30:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-prod-20260610-001",
            environment_id="prod",
            deployset_id="prod-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="change-advisory-board",
            force=False,
            started_at="2026-06-10T22:00:00Z",
            completed_at="2026-06-10T22:19:00Z",
            claimed_by="prod-runner-01",
            items=[
                _execution_item(
                    component_id="web",
                    version="3.18.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="prod-runner-01",
                ),
                _execution_item(
                    component_id="api",
                    version="5.6.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="prod-runner-01",
                ),
                _execution_item(
                    component_id="worker",
                    version="5.6.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="prod-runner-01",
                ),
                _execution_item(
                    component_id="auth",
                    version="2.14.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="prod-runner-01",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="prod",
            deployset_id="prod-default",
            status=ExecutionStatus.SUCCEEDED,
            last_deployment_execution_id="exec-prod-20260610-001",
            updated_at="2026-06-10T22:19:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="exec-data-20260609-001",
            environment_id="shared-data",
            deployset_id="data-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="data-release-manager",
            force=False,
            started_at="2026-06-09T07:40:00Z",
            completed_at="2026-06-09T07:52:00Z",
            claimed_by="data-runner-01",
            items=[
                _execution_item(
                    component_id="postgres",
                    version="14.11.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="data-runner-01",
                ),
                _execution_item(
                    component_id="redis",
                    version="7.0.12",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.SUCCEEDED,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                    reported_action=ReportedAction.DEPLOY,
                    reported_by="data-runner-01",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="shared-data",
            deployset_id="data-default",
            status=ExecutionStatus.SUCCEEDED,
            last_deployment_execution_id="exec-data-20260609-001",
            updated_at="2026-06-09T07:52:00Z",
        ),
    )


