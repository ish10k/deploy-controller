from pydantic import BaseModel, ConfigDict, Field

from src.domain.enums import (
    ReleaseSetItemSource,
    DriftReason,
    EnvironmentStatus,
    EventOrigin,
    EventSeverity,
    ExecutionStatus,
    ItemStatus,
    Permission,
    PrincipalType,
    ReportedAction,
    RequestedAction,
    RequestedReason,
    TagResourceType,
    WebhookDeliveryStatus,
    WebhookEvent,
)


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


DEFAULT_ORGANIZATION_ID = "default"
DEFAULT_WORKSPACE_ID = "default"


class Organization(ApiModel):
    organization_id: str = Field(alias="organizationId")
    display_name: str = Field(alias="displayName")
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class Workspace(ApiModel):
    workspace_id: str = Field(alias="workspaceId")
    organization_id: str = Field(alias="organizationId")
    display_name: str = Field(alias="displayName")
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class TagDefinitionSelector(ApiModel):
    resource_types: list[TagResourceType] = Field(default_factory=list, alias="resourceTypes")


class TagDefinition(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    key: str = Field(frozen=True)
    description: str | None = None
    default_value: str | None = Field(default=None, alias="defaultValue")
    allowed_values: list[str] = Field(default_factory=list, alias="allowedValues")
    selector: TagDefinitionSelector = Field(default_factory=TagDefinitionSelector)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class OrganizationMembership(ApiModel):
    organization_id: str = Field(alias="organizationId")
    principal_id: str = Field(alias="principalId")
    roles: list[str] = Field(default_factory=list)
    active: bool = True
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class WorkspaceMembership(ApiModel):
    workspace_id: str = Field(alias="workspaceId")
    principal_id: str = Field(alias="principalId")
    roles: list[str] = Field(default_factory=list)
    active: bool = True
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class Component(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    component_id: str = Field(alias="componentId")
    type: str | None = None
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)


class Source(ApiModel):
    key: str = Field(description="Source object key or URI.")
    digest: str = Field(
        description="Self-describing source digest such as sha256:abc123.",
        examples=["sha256:0123456789abcdef"],
    )


class Artifact(ApiModel):
    key: str = Field(description="Artifact object key or URI.")
    digest: str = Field(
        description="Self-describing artifact digest such as sha256:abc123.",
        examples=["sha256:0123456789abcdef"],
    )


class Release(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    component_id: str = Field(alias="componentId")
    version: str
    description: str | None = None
    notes: str | None = None
    artifact: Artifact
    source: Source | None = Field(
        default=None,
        description="Optional source object that produced the release.",
    )
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class PublisherScope(ApiModel):
    component_ids: list[str] = Field(default_factory=list, alias="componentIds")


class Publisher(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    publisher_id: str = Field(alias="publisherId")
    display_name: str = Field(alias="displayName")
    principal_id: str = Field(alias="principalId")
    auth_method: str = Field(default="pat", alias="authMethod")
    token_hash: str | None = Field(default=None, alias="tokenHash")
    token_prefix: str | None = Field(default=None, alias="tokenPrefix")
    token_created_at: str | None = Field(default=None, alias="tokenCreatedAt")
    token_rotated_at: str | None = Field(default=None, alias="tokenRotatedAt")
    last_used_at: str | None = Field(default=None, alias="lastUsedAt")
    active: bool = True
    scope: PublisherScope = Field(default_factory=PublisherScope)
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


class PublisherCreateRequest(ApiModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    publisher_id: str = Field(alias="publisherId")
    display_name: str = Field(alias="displayName")
    active: bool = True
    scope: PublisherScope = Field(default_factory=PublisherScope)
    tags: dict[str, str] = Field(default_factory=dict)


class PublisherCreateResult(ApiModel):
    publisher: Publisher = Field(alias="publisher")
    token: str


class ReleaseSetItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str
    source: ReleaseSetItemSource = ReleaseSetItemSource.EXPLICIT


class ReleaseSet(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    release_set_id: str = Field(alias="releaseSetId")
    schema_version: int = Field(alias="schemaVersion")
    description: str | None = None
    notes: str | None = None
    base_environment_id: str | None = Field(default=None, alias="baseEnvironmentId")
    base_release_set_id: str | None = Field(default=None, alias="baseReleaseSetId")
    items: list[ReleaseSetItem]
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class ReleaseSetCreateItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str


class ReleaseSetCreateRequest(ApiModel):
    release_set_id: str = Field(alias="releaseSetId")
    base_environment_id: str | None = Field(default=None, alias="baseEnvironmentId")
    base_release_set_id: str | None = Field(default=None, alias="baseReleaseSetId")
    notes: str | None = None
    items: list[ReleaseSetCreateItem]
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class ReleaseSetCreateResult(ApiModel):
    release_set: ReleaseSet
    warnings: list[str] = Field(default_factory=list)


class Environment(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    environment_id: str = Field(alias="environmentId")
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)


class DeploymentRunnerScope(ApiModel):
    environment_ids: list[str] = Field(default_factory=list, alias="environmentIds")
    component_ids: list[str] = Field(default_factory=list, alias="componentIds")
    component_types: list[str] = Field(default_factory=list, alias="componentTypes")
    component_tags: dict[str, str] = Field(default_factory=dict, alias="componentTags")
    environment_tags: dict[str, str] = Field(default_factory=dict, alias="environmentTags")
    max_concurrent_claims: int = Field(default=1, alias="maxConcurrentClaims", ge=1)


class DeploymentRunner(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    runner_id: str = Field(alias="runnerId")
    display_name: str = Field(alias="displayName")
    principal_id: str = Field(alias="principalId")
    auth_method: str = Field(default="pat", alias="authMethod")
    token_hash: str | None = Field(default=None, alias="tokenHash")
    token_prefix: str | None = Field(default=None, alias="tokenPrefix")
    token_created_at: str | None = Field(default=None, alias="tokenCreatedAt")
    token_rotated_at: str | None = Field(default=None, alias="tokenRotatedAt")
    last_used_at: str | None = Field(default=None, alias="lastUsedAt")
    active: bool = True
    scope: DeploymentRunnerScope = Field(default_factory=DeploymentRunnerScope)
    webhook_id: str | None = Field(default=None, alias="webhookId")
    last_heartbeat_at: str | None = Field(default=None, alias="lastHeartbeatAt")
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


class DeploymentRunnerCreateRequest(ApiModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    runner_id: str = Field(alias="runnerId")
    display_name: str = Field(alias="displayName")
    active: bool = True
    scope: DeploymentRunnerScope = Field(default_factory=DeploymentRunnerScope)
    webhook_id: str | None = Field(default=None, alias="webhookId")
    tags: dict[str, str] = Field(default_factory=dict)


class DeploymentRunnerCreateResult(ApiModel):
    runner: DeploymentRunner
    token: str


class RotateTokenResult(ApiModel):
    token: str


class Principal(ApiModel):
    principal_id: str = Field(alias="principalId")
    type: PrincipalType
    display_name: str = Field(alias="displayName")
    email: str | None = None
    auth_method: str = Field(alias="authMethod")
    external_issuer: str | None = Field(default=None, alias="externalIssuer")
    external_subject: str | None = Field(default=None, alias="externalSubject")
    active: bool = True
    roles: list[str] = Field(default_factory=list)
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    last_seen_at: str | None = Field(default=None, alias="lastSeenAt")


class BootstrapState(ApiModel):
    completed: bool = False
    completed_at: str | None = Field(default=None, alias="completedAt")
    completed_by: str | None = Field(default=None, alias="completedBy")


class Role(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    role_id: str = Field(alias="roleId")
    permissions: list[Permission]
    description: str | None = None
    system: bool = False
    permissions_editable: bool = Field(default=True, alias="permissionsEditable")


class AuthContext(ApiModel):
    principal_id: str = Field(alias="principalId")
    principal_type: PrincipalType = Field(alias="principalType")
    auth_method: str = Field(alias="authMethod")
    roles: list[str] = Field(default_factory=list)
    permissions: list[Permission] = Field(default_factory=list)
    claims: dict[str, object] = Field(default_factory=dict)


class WhoAmI(ApiModel):
    principal_id: str = Field(alias="principalId")
    type: PrincipalType
    auth_method: str = Field(alias="authMethod")
    display_name: str = Field(alias="displayName")
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[Permission] = Field(default_factory=list)
    organizations: list["WhoAmIOrganization"] = Field(default_factory=list)
    workspaces: list["WhoAmIWorkspace"] = Field(default_factory=list)


class WhoAmIOrganization(ApiModel):
    organization_id: str = Field(alias="organizationId")
    display_name: str = Field(alias="displayName")
    roles: list[str] = Field(default_factory=list)


class WhoAmIWorkspace(ApiModel):
    workspace_id: str = Field(alias="workspaceId")
    organization_id: str = Field(alias="organizationId")
    display_name: str = Field(alias="displayName")
    roles: list[str] = Field(default_factory=list)


class EventResourceRef(ApiModel):
    resource_type: str = Field(alias="resourceType")
    resource_id: str = Field(alias="resourceId")


class EventChange(ApiModel):
    field: str
    before: object | None = None
    after: object | None = None


class EventLogEntry(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    event_id: str = Field(alias="eventId")
    occurred_at: str = Field(alias="occurredAt")
    actor_principal_id: str = Field(alias="actorPrincipalId")
    actor_type: str = Field(alias="actorType")
    origin: EventOrigin
    action: str
    category: str
    severity: EventSeverity = EventSeverity.INFO
    summary: str
    resource_type: str = Field(alias="resourceType")
    resource_id: str = Field(alias="resourceId")
    related_resources: list[EventResourceRef] = Field(default_factory=list, alias="relatedResources")
    correlation_id: str | None = Field(default=None, alias="correlationId")
    request_id: str | None = Field(default=None, alias="requestId")
    changes: list[EventChange] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class EventLogListResult(ApiModel):
    events: list[EventLogEntry]
    next_cursor: str | None = Field(default=None, alias="nextCursor")


class WebhookRetryPolicy(ApiModel):
    max_attempts: int = Field(default=3, alias="maxAttempts", ge=1, le=20)
    backoff_seconds: int = Field(default=60, alias="backoffSeconds", ge=0, le=86400)


class WebhookFilter(ApiModel):
    resource_types: list[str] = Field(default_factory=list, alias="resourceTypes")
    resource_ids: list[str] = Field(default_factory=list, alias="resourceIds")
    categories: list[str] = Field(default_factory=list)
    origins: list[str] = Field(default_factory=list)
    severities: list[str] = Field(default_factory=list)


class WebhookSubscription(ApiModel):
    subscription_id: str = Field(alias="subscriptionId")
    event_types: list[str] = Field(default_factory=list, alias="eventTypes")
    filters: WebhookFilter = Field(default_factory=WebhookFilter)


class Webhook(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    webhook_id: str = Field(alias="webhookId")
    display_name: str = Field(alias="displayName")
    url: str
    active: bool = True
    retry_policy: WebhookRetryPolicy = Field(default_factory=WebhookRetryPolicy, alias="retryPolicy")
    subscriptions: list[WebhookSubscription] = Field(default_factory=list)
    secret_ref: str | None = Field(default=None, alias="secretRef")
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    updated_at: str | None = Field(default=None, alias="updatedAt")


class WebhookActor(ApiModel):
    principal_id: str = Field(alias="principalId")
    type: str
    origin: str


class WebhookResource(ApiModel):
    type: str
    id: str


class WebhookEnvelope(ApiModel):
    schema_version: str = Field(default="webhook.v1", alias="schemaVersion")
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    delivery_id: str = Field(alias="deliveryId")
    webhook_id: str = Field(alias="webhookId")
    subscription_id: str = Field(alias="subscriptionId")
    event_id: str = Field(alias="eventId")
    event_type: str = Field(alias="eventType")
    occurred_at: str = Field(alias="occurredAt")
    sent_at: str | None = Field(default=None, alias="sentAt")
    attempt: int = 1
    actor: WebhookActor
    resource: WebhookResource
    related_resources: list[EventResourceRef] = Field(default_factory=list, alias="relatedResources")
    data: dict[str, object] = Field(default_factory=dict)
    changes: list[EventChange] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class WebhookDelivery(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    webhook_delivery_id: str = Field(alias="webhookDeliveryId")
    webhook_id: str = Field(alias="webhookId")
    subscription_id: str = Field(alias="subscriptionId")
    event_id: str = Field(alias="eventId")
    event_type: str = Field(alias="eventType")
    status: WebhookDeliveryStatus
    envelope: WebhookEnvelope
    attempts: int = 0
    next_attempt_at: str | None = Field(default=None, alias="nextAttemptAt")
    last_response_status: int | None = Field(default=None, alias="lastResponseStatus")
    last_response_body: str | None = Field(default=None, alias="lastResponseBody")
    last_error: str | None = Field(default=None, alias="lastError")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class EnvironmentState(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    environment_id: str = Field(alias="environmentId")
    release_set_id: str | None = Field(default=None, alias="releaseSetId")
    status: EnvironmentStatus = EnvironmentStatus.IDLE
    last_deployment_id: str | None = Field(default=None, alias="lastDeploymentId")
    updated_at: str = Field(alias="updatedAt")


class DeploymentItem(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    deployment_id: str = Field(default="", alias="deploymentId")
    environment_id: str = Field(default="", alias="environmentId")
    release_set_id: str = Field(default="", alias="releaseSetId")
    component_id: str = Field(alias="componentId")
    version: str
    artifact: Artifact
    requested_action: RequestedAction = Field(alias="requestedAction")
    reported_action: ReportedAction | None = Field(default=None, alias="reportedAction")
    status: ItemStatus
    claimed_by: str | None = Field(default=None, alias="claimedBy")
    claimed_at: str | None = Field(default=None, alias="claimedAt")
    claim_expires_at: str | None = Field(default=None, alias="claimExpiresAt")
    claim_eligibility: dict[str, object] = Field(default_factory=dict, alias="claimEligibility")
    requested_reason: RequestedReason | None = Field(default=None, alias="requestedReason")
    runner_reason: str | None = Field(default=None, alias="runnerReason")
    failure_reason: str | None = Field(default=None, alias="failureReason")
    runner_match_warning: bool = Field(default=False, alias="runnerMatchWarning")
    drift_detected: bool = Field(default=False, alias="driftDetected")
    drift_reason: DriftReason | None = Field(default=None, alias="driftReason")
    reported_by: str | None = Field(default=None, alias="reportedBy")
    message: str | None = None
    error: str | None = None


class Deployment(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    deployment_id: str = Field(alias="deploymentId")
    environment_id: str = Field(alias="environmentId")
    release_set_id: str = Field(alias="releaseSetId")
    status: ExecutionStatus
    requested_by: str = Field(alias="requestedBy")
    notes: str | None = None
    force: bool = False
    started_at: str = Field(alias="startedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    items: list[DeploymentItem]
    tags: dict[str, str] = Field(default_factory=dict)


class DeploymentPlan(ApiModel):
    workspace_id: str = Field(default=DEFAULT_WORKSPACE_ID, alias="workspaceId")
    environment_id: str = Field(alias="environmentId")
    release_set_id: str = Field(alias="releaseSetId")
    items: list[DeploymentItem]

