import hashlib

from src.domain.enums import (
    DeploySetItemSource,
    ExecutionStatus,
    ItemStatus,
    ReportedAction,
    RequestedAction,
    RequestedReason,
    PrincipalType,
    TagResourceType,
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
    DeploymentRunner,
    DeploymentRunnerScope,
    Environment,
    EnvironmentState,
    Organization,
    Principal,
    Release,
    Publisher,
    PublisherScope,
    Source,
    TagDefinition,
    TagDefinitionSelector,
    Webhook,
    WebhookActor,
    WebhookDelivery,
    WebhookEnvelope,
    WebhookFilter,
    WebhookResource,
    WebhookRetryPolicy,
    WebhookSubscription,
    Workspace,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def _sha256(label: str) -> str:
    return hashlib.sha256(label.encode("utf-8")).hexdigest()


def _digest(label: str) -> str:
    return f"sha256:{_sha256(label)}"


def _pat_fields(token: str) -> dict[str, str]:
    return {"token_hash": _sha256(token), "token_prefix": token[:18]}


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
        notes=f"Release {version} prepared for the {component_id} delivery track.",
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
    runner_reason: str | None = None,
    message: str | None = None,
    error: str | None = None,
    claimed_by: str | None = None,
) -> DeploymentExecutionItem:
    return DeploymentExecutionItem(
        component_id=component_id,
        version=version,
        artifact=_artifact(component_id, version),
        requested_action=requested_action,
        reported_action=reported_action,
        status=status,
        claimed_by=claimed_by or reported_by,
        requested_reason=requested_reason,
        runner_reason=runner_reason,
        reported_by=reported_by,
        message=message,
        error=error,
    )


def _seed_execution(store: MemoryRepositories, execution: DeploymentExecution, state: EnvironmentState) -> None:
    deployset = store.get_deployset(execution.deployset_id, execution.workspace_id)
    component_set_id = deployset.component_set_id if deployset else ""
    execution = execution.model_copy(
        update={
            "items": [
                item.model_copy(
                    update={
                        "workspace_id": execution.workspace_id,
                        "deployment_execution_id": execution.deployment_execution_id,
                        "environment_id": execution.environment_id,
                        "component_set_id": component_set_id,
                    }
                )
                for item in execution.items
            ]
        }
    )
    store.create_deployment_execution(execution)
    store.put_environment_state(state)


def seed_local_data(store: MemoryRepositories) -> None:
    if store.components:
        return

    store.put_organization(
        Organization(
            organizationId="default",
            displayName="Default",
            active=True,
            tags={"plan": "local"},
            createdAt="2026-04-01T09:00:00Z",
            createdBy="system:local-seed",
        )
    )
    store.put_workspace(
        Workspace(
            workspaceId="default",
            organizationId="default",
            displayName="Default",
            active=True,
            tags={"team": "platform"},
            createdAt="2026-04-01T09:00:00Z",
            createdBy="system:local-seed",
        )
    )
    store.put_tag_definition(
        TagDefinition(
            tagDefinitionId="deployset-track",
            key="track",
            label="Track",
            description="Release track promoted by this DeploySet.",
            defaultValue="prod",
            allowedValues=["dev", "staging", "prod"],
            selector=TagDefinitionSelector(resourceTypes=[TagResourceType.DEPLOYSET, TagResourceType.RELEASE]),
            createdAt="2026-04-01T09:00:00Z",
            createdBy="system:local-seed",
        )
    )
    store.put_tag_definition(
        TagDefinition(
            tagDefinitionId="component-team",
            key="team",
            label="Team",
            description="Owning team for the resource.",
            defaultValue="platform",
            allowedValues=["frontend", "platform", "identity", "data", "ops", "governance"],
            selector=TagDefinitionSelector(
                resourceTypes=[
                    TagResourceType.COMPONENT,
                    TagResourceType.COMPONENT_SET,
                    TagResourceType.DEPLOYSET,
                    TagResourceType.DEPLOYMENT_RUNNER,
                    TagResourceType.PUBLISHER,
                    TagResourceType.WEBHOOK,
                    TagResourceType.WORKSPACE,
                ]
            ),
            createdAt="2026-04-01T09:00:00Z",
            createdBy="system:local-seed",
        )
    )
    store.put_tag_definition(
        TagDefinition(
            tagDefinitionId="environment-region",
            key="region",
            label="Region",
            description="Primary runtime region for the environment.",
            defaultValue="eu-west-1",
            allowedValues=["local", "eu-west-1"],
            selector=TagDefinitionSelector(resourceTypes=[TagResourceType.ENVIRONMENT]),
            createdAt="2026-04-01T09:00:00Z",
            createdBy="system:local-seed",
        )
    )

    # Components
    store.put_component(
        Component(
            component_id="web",
            type="package",
            active=True,
            tags={"team": "frontend", "tier": "customer-facing", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="api",
            type="package",
            active=True,
            tags={"team": "platform", "tier": "application", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="worker",
            type="package",
            active=True,
            tags={"team": "platform", "tier": "async", "owner": "platform"},
        )
    )
    store.put_component(
        Component(
            component_id="auth",
            type="package",
            active=True,
            tags={"team": "identity", "tier": "shared", "owner": "security"},
        )
    )
    store.put_component(
        Component(
            component_id="postgres",
            type="docker-compose",
            active=True,
            tags={"team": "data", "tier": "database", "owner": "data-platform"},
        )
    )
    store.put_component(
        Component(
            component_id="redis",
            type="docker-compose",
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
                ComponentSetItem(component_id="web"),
                ComponentSetItem(component_id="api"),
                ComponentSetItem(component_id="worker"),
                ComponentSetItem(component_id="auth"),
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
                ComponentSetItem(component_id="postgres"),
                ComponentSetItem(component_id="redis"),
            ],
            tags={"domain": "data-platform", "environment": "shared"},
            created_at="2026-04-03T09:00:00Z",
            created_by="data-platform-bootstrap",
        )
    )

    # External release publishers
    store.put_publisher(
        Publisher(
            publisher_id="platform-ci",
            display_name="Platform CI",
            principal_id="service:publisher:platform-ci",
            active=True,
            scope=PublisherScope(component_set_ids=["local-platform"], component_ids=[]),
            tags={"team": "platform"},
            created_at="2026-04-01T09:05:00Z",
            created_by="platform-bootstrap",
        )
    )
    store.put_principal(
        Principal(
            principal_id="service:publisher:platform-ci",
            type=PrincipalType.SERVICE,
            display_name="Platform CI",
            auth_method="pat",
            roles=["publisher"],
            active=True,
            tags={"team": "platform"},
            created_at="2026-04-01T09:05:00Z",
            created_by="system:local-seed",
        )
    )
    store.put_publisher(
        Publisher(
            publisher_id="data-ci",
            display_name="Data CI",
            principal_id="service:publisher:data-ci",
            active=True,
            scope=PublisherScope(component_set_ids=["data-services"], component_ids=[]),
            tags={"team": "data-platform"},
            created_at="2026-04-03T09:05:00Z",
            created_by="data-platform-bootstrap",
        )
    )
    store.put_principal(
        Principal(
            principal_id="service:publisher:data-ci",
            type=PrincipalType.SERVICE,
            display_name="Data CI",
            auth_method="pat",
            roles=["publisher"],
            active=True,
            tags={"team": "data-platform"},
            created_at="2026-04-03T09:05:00Z",
            created_by="system:local-seed",
        )
    )

    # Webhooks
    store.put_webhook(
        Webhook(
            webhook_id="platform-events",
            display_name="Platform Events",
            url="https://hooks.example.com/settle/platform",
            active=True,
            retry_policy=WebhookRetryPolicy(max_attempts=3, backoff_seconds=60),
            subscriptions=[
                WebhookSubscription(
                    subscription_id="sub-platform-releases",
                    event_types=["release.created", "release.published"],
                    filters=WebhookFilter(resource_types=["release"], categories=["registry"]),
                ),
                WebhookSubscription(
                    subscription_id="sub-platform-deployments",
                    event_types=["deployset.created", "deployment.created", "deployment.status_changed"],
                    filters=WebhookFilter(resource_types=["deployset", "deploymentExecution"], categories=["deployment"]),
                ),
            ],
            secret_ref="secret://webhooks/platform-events",
            tags={"team": "platform", "env": "local"},
            created_at="2026-06-15T09:30:00Z",
            created_by="platform-bootstrap",
            updated_at="2026-06-17T10:00:00Z",
        )
    )
    store.put_webhook(
        Webhook(
            webhook_id="audit-feed",
            display_name="Audit Feed",
            url="https://hooks.example.com/settle/audit",
            active=True,
            retry_policy=WebhookRetryPolicy(max_attempts=5, backoff_seconds=120),
            subscriptions=[
                WebhookSubscription(
                    subscription_id="sub-audit-events",
                    event_types=["eventlog.created", "principal.updated", "role.updated", "webhook.updated"],
                    filters=WebhookFilter(resource_types=["principal", "role", "webhook"]),
                )
            ],
            secret_ref=None,
            tags={"team": "governance", "env": "local"},
            created_at="2026-06-16T08:15:00Z",
            created_by="platform-bootstrap",
            updated_at=None,
        )
    )
    store.put_webhook(
        Webhook(
            webhook_id="ops-deployments",
            display_name="Ops Deployments",
            url="https://hooks.example.com/settle/ops",
            active=False,
            retry_policy=WebhookRetryPolicy(max_attempts=2, backoff_seconds=30),
            subscriptions=[
                WebhookSubscription(
                    subscription_id="sub-ops-deployments",
                    event_types=["deployment.created", "deployment_item.status_changed"],
                    filters=WebhookFilter(resource_types=["deploymentExecution"]),
                )
            ],
            secret_ref="secret://webhooks/ops-deployments",
            tags={"team": "ops", "env": "local"},
            created_at="2026-06-17T07:00:00Z",
            created_by="platform-bootstrap",
            updated_at="2026-06-17T07:20:00Z",
        )
    )

    store.put_webhook_delivery(
        WebhookDelivery(
            webhook_delivery_id="whd-platform-events-001",
            webhook_id="platform-events",
            subscription_id="sub-platform-releases",
            event_id="event-release-001",
            event_type="release.created",
            status="succeeded",
            envelope=WebhookEnvelope(
                deliveryId="whd-platform-events-001",
                webhookId="platform-events",
                subscriptionId="sub-platform-releases",
                eventId="event-release-001",
                eventType="release.created",
                occurredAt="2026-06-17T09:00:00Z",
                sentAt="2026-06-17T09:00:01Z",
                attempt=1,
                actor=WebhookActor(principalId="service:publisher:platform-ci", type="service", origin="service"),
                resource=WebhookResource(type="release", id="api@5.7.1"),
                relatedResources=[],
                data={"componentId": "api", "version": "5.7.1"},
                changes=[],
                metadata={"channel": "registry"},
            ),
            attempts=1,
            next_attempt_at=None,
            last_response_status=204,
            last_response_body=None,
            last_error=None,
            created_at="2026-06-17T09:00:01Z",
            updated_at="2026-06-17T09:00:01Z",
        )
    )
    store.put_webhook_delivery(
        WebhookDelivery(
            webhook_delivery_id="whd-audit-feed-001",
            webhook_id="audit-feed",
            subscription_id="sub-audit-events",
            event_id="event-role-001",
            event_type="role.updated",
            status="failed",
            envelope=WebhookEnvelope(
                deliveryId="whd-audit-feed-001",
                webhookId="audit-feed",
                subscriptionId="sub-audit-events",
                eventId="event-role-001",
                eventType="role.updated",
                occurredAt="2026-06-17T11:15:00Z",
                sentAt="2026-06-17T11:15:01Z",
                attempt=1,
                actor=WebhookActor(principalId="user:admin@example.local", type="user", origin="user"),
                resource=WebhookResource(type="role", id="admin"),
                related_resources=[],
                data={"roleId": "admin"},
                changes=[],
                metadata={"channel": "governance"},
            ),
            attempts=1,
            next_attempt_at="2026-06-17T11:17:01Z",
            last_response_status=500,
            last_response_body="downstream unavailable",
            last_error="downstream unavailable",
            created_at="2026-06-17T11:15:01Z",
            updated_at="2026-06-17T11:15:01Z",
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
            notes="Baseline local stack used for demos, smoke tests, and onboarding.",
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
            notes="Local hotfix track kept close to production while validating urgent fixes.",
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
            notes="Main development baseline used by CI and shared integration testing.",
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
            notes="Staging candidate promoted after integration sign-off and before CAB review.",
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
            notes="Current stable production baseline approved for the primary customer ring.",
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
            notes="Emergency production track reserved for tightly scoped, approved hotfixes.",
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
            notes="Shared data baseline coordinated with platform and database maintenance windows.",
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

    # Example deployment runners
    for runner_id, display_name, component_types, team in [
        ("package-runner-01", "Package Runner", ["package"], "platform"),
        ("docker-compose-runner-01", "Docker Compose Runner", ["docker-compose"], "platform"),
    ]:
        principal_id = f"service:deployment-runner:{runner_id}"
        token = f"settle_pat_{runner_id.replace('-', '_')}"
        store.put_deployment_runner(
            DeploymentRunner(
                runner_id=runner_id,
                display_name=display_name,
                principal_id=principal_id,
                active=True,
                scope=DeploymentRunnerScope(component_types=component_types),
                webhook_id=None,
                token_created_at="2026-04-01T09:08:00Z",
                **_pat_fields(token),
                last_heartbeat_at="2026-06-17T10:05:00Z",
                tags={"team": team, "example": "true"},
                created_at="2026-04-01T09:08:00Z",
                created_by="platform-bootstrap",
            )
        )
        store.put_principal(
            Principal(
                principal_id=principal_id,
                type=PrincipalType.SERVICE,
                display_name=display_name,
                auth_method="pat",
                roles=["deployment-runner"],
                active=True,
                tags={"team": team, "example": "true"},
                created_at="2026-04-01T09:08:00Z",
                created_by="system:local-seed",
            )
        )

    # Existing runner history coverage
    for runner_id, display_name, environment_ids, component_set_ids, team in [
        ("local-runner-01", "Local Runner", ["local"], ["local-platform"], "platform"),
        ("dev-runner-01", "Dev Runner", ["dev"], ["local-platform"], "platform"),
        ("staging-runner-01", "Staging Runner", ["staging"], ["local-platform"], "platform"),
        ("prod-runner-01", "Prod Runner", ["prod"], ["local-platform"], "platform"),
        ("data-runner-01", "Data Services Runner", ["shared-data"], ["data-services"], "data-platform"),
    ]:
        principal_id = f"service:deployment-runner:{runner_id}"
        store.put_deployment_runner(
            DeploymentRunner(
                runner_id=runner_id,
                display_name=display_name,
                principal_id=principal_id,
                active=True,
                scope=DeploymentRunnerScope(environment_ids=environment_ids, component_set_ids=component_set_ids),
                webhook_id=None,
                last_heartbeat_at="2026-06-17T10:05:00Z",
                tags={"team": team},
                created_at="2026-04-01T09:10:00Z",
                created_by="platform-bootstrap",
            )
        )
        store.put_principal(
            Principal(
                principal_id=principal_id,
                type=PrincipalType.SERVICE,
                display_name=display_name,
                auth_method="pat",
                roles=["deployment-runner"],
                active=True,
                tags={"team": team},
                created_at="2026-04-01T09:10:00Z",
                created_by="system:local-seed",
            )
        )

    # Deployment history
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="a1b2c3d4",
            environment_id="local",
            deployset_id="local-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="dev@company.com",
            notes="Local smoke deployment requested after frontend and auth updates merged.",
            force=False,
            started_at="2026-06-15T09:05:00Z",
            completed_at="2026-06-15T09:18:00Z",
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
                    runner_reason="worker already matched the desired version",
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
            last_deployment_execution_id="a1b2c3d4",
            updated_at="2026-06-15T09:18:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="b2c3d4e5",
            environment_id="dev",
            deployset_id="dev-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="ci:release-bot",
            notes="Automated dev rollout after the nightly integration promotion completed.",
            force=False,
            started_at="2026-06-12T14:02:00Z",
            completed_at="2026-06-12T14:11:00Z",
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
            last_deployment_execution_id="b2c3d4e5",
            updated_at="2026-06-12T14:11:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="c3d4e5f6",
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.FAILED,
            requested_by="release-manager",
            notes="Staging validation run blocked on checkout API readiness during smoke tests.",
            force=False,
            started_at="2026-06-13T10:55:00Z",
            completed_at="2026-06-13T11:07:00Z",
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
                    runner_reason="no worker changes in this change set",
                ),
                _execution_item(
                    component_id="auth",
                    version="2.15.0",
                    requested_action=RequestedAction.SKIP,
                    status=ItemStatus.SKIPPED,
                    requested_reason=RequestedReason.LATEST_EXECUTION_ALREADY_SUCCEEDED,
                    reported_action=ReportedAction.SKIP,
                    reported_by="staging-runner-01",
                    runner_reason="auth already matched the requested version",
                ),
            ],
        ),
        EnvironmentState(
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.FAILED,
            last_deployment_execution_id="c3d4e5f6",
            updated_at="2026-06-13T11:07:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="d4e5f6a7",
            environment_id="staging",
            deployset_id="staging-default",
            status=ExecutionStatus.PENDING,
            requested_by="release-manager",
            notes="Retry queued after the previous staging failure was triaged and a fix was prepared.",
            force=False,
            started_at="2026-06-16T08:30:00Z",
            completed_at=None,
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
            last_deployment_execution_id="d4e5f6a7",
            updated_at="2026-06-16T08:30:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="e5f6a7b8",
            environment_id="prod",
            deployset_id="prod-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="change-advisory-board",
            notes="CAB-approved production rollout executed during the scheduled evening window.",
            force=False,
            started_at="2026-06-10T22:00:00Z",
            completed_at="2026-06-10T22:19:00Z",
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
            last_deployment_execution_id="e5f6a7b8",
            updated_at="2026-06-10T22:19:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="f6a7b8c9",
            environment_id="shared-data",
            deployset_id="data-default",
            status=ExecutionStatus.SUCCEEDED,
            requested_by="data-release-manager",
            notes="Shared data services rollout coordinated with the weekly platform maintenance window.",
            force=False,
            started_at="2026-06-09T07:40:00Z",
            completed_at="2026-06-09T07:52:00Z",
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
            last_deployment_execution_id="f6a7b8c9",
            updated_at="2026-06-09T07:52:00Z",
        ),
    )
    _seed_execution(
        store,
        DeploymentExecution(
            deployment_execution_id="g7h8i9j0",
            environment_id="shared-data",
            deployset_id="data-default",
            status=ExecutionStatus.PENDING,
            requested_by="data-release-manager",
            notes="Pending docker-compose validation rollout for the example compose runner.",
            force=False,
            started_at="2026-06-18T09:15:00Z",
            completed_at=None,
            items=[
                _execution_item(
                    component_id="postgres",
                    version="14.11.0",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
                _execution_item(
                    component_id="redis",
                    version="7.0.12",
                    requested_action=RequestedAction.DEPLOY,
                    status=ItemStatus.PENDING,
                    requested_reason=RequestedReason.VERSION_CHANGED,
                ),
            ],
        ),
        EnvironmentState(
            environment_id="shared-data",
            deployset_id="data-default",
            status=ExecutionStatus.PENDING,
            last_deployment_execution_id="g7h8i9j0",
            updated_at="2026-06-18T09:15:00Z",
        ),
    )
