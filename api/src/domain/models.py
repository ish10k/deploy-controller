from pydantic import BaseModel, ConfigDict, Field

from src.domain.enums import (
    DeploySetItemSource,
    DriftReason,
    EnvironmentStatus,
    ExecutionStatus,
    ItemStatus,
    Permission,
    PrincipalType,
    ReportedAction,
    RequestedAction,
    RequestedReason,
    WebhookDeliveryStatus,
    WebhookEvent,
)


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class Component(ApiModel):
    component_id: str = Field(alias="componentId")
    type: str | None = None
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)


class ComponentSetItem(ApiModel):
    component_id: str = Field(alias="componentId")
    required: bool = True


class ComponentSet(ApiModel):
    component_set_id: str = Field(alias="componentSetId")
    description: str | None = None
    components: list[ComponentSetItem]
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


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
    component_id: str = Field(alias="componentId")
    version: str
    description: str | None = None
    artifact: Artifact
    source: Source | None = Field(
        default=None,
        description="Optional source object that produced the release.",
    )
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class DeploySetItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str
    source: DeploySetItemSource = DeploySetItemSource.EXPLICIT


class DeploySet(ApiModel):
    deployset_id: str = Field(alias="deploySetId")
    component_set_id: str = Field(alias="componentSetId")
    schema_version: int = Field(alias="schemaVersion")
    description: str | None = None
    base_environment_id: str | None = Field(default=None, alias="baseEnvironmentId")
    base_deployset_id: str | None = Field(default=None, alias="baseDeploySetId")
    items: list[DeploySetItem]
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class DeploySetCreateItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str


class DeploySetCreateRequest(ApiModel):
    deployset_id: str = Field(alias="deploySetId")
    component_set_id: str = Field(alias="componentSetId")
    base_environment_id: str | None = Field(default=None, alias="baseEnvironmentId")
    base_deployset_id: str | None = Field(default=None, alias="baseDeploySetId")
    items: list[DeploySetCreateItem]
    created_by: str = Field(alias="createdBy")
    tags: dict[str, str] = Field(default_factory=dict)


class DeploySetCreateResult(ApiModel):
    deployset: DeploySet
    warnings: list[str] = Field(default_factory=list)


class Environment(ApiModel):
    environment_id: str = Field(alias="environmentId")
    active: bool = True
    tags: dict[str, str] = Field(default_factory=dict)


class Principal(ApiModel):
    principal_id: str = Field(alias="principalId")
    type: PrincipalType
    active: bool = True
    role_ids: list[str] = Field(default_factory=list, alias="roleIds")
    tags: dict[str, str] = Field(default_factory=dict)


class Role(ApiModel):
    role_id: str = Field(alias="roleId")
    permissions: list[Permission]
    description: str | None = None


class AuthContext(ApiModel):
    principal_id: str = Field(alias="principalId")
    permissions: list[Permission]


class Webhook(ApiModel):
    webhook_id: str = Field(alias="webhookId")
    url: str
    events: list[WebhookEvent]
    active: bool = True
    secret_ref: str | None = Field(default=None, alias="secretRef")
    tags: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


class WebhookDelivery(ApiModel):
    webhook_delivery_id: str = Field(alias="webhookDeliveryId")
    webhook_id: str = Field(alias="webhookId")
    event: WebhookEvent
    status: WebhookDeliveryStatus
    payload: dict[str, object]
    attempts: int = 0
    last_error: str | None = Field(default=None, alias="lastError")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class EnvironmentState(ApiModel):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str | None = Field(default=None, alias="deploySetId")
    status: EnvironmentStatus = EnvironmentStatus.IDLE
    last_deployment_execution_id: str | None = Field(default=None, alias="lastDeploymentExecutionId")
    updated_at: str = Field(alias="updatedAt")


class DeploymentExecutionItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str
    artifact: Artifact
    requested_action: RequestedAction = Field(alias="requestedAction")
    reported_action: ReportedAction | None = Field(default=None, alias="reportedAction")
    status: ItemStatus
    requested_reason: RequestedReason | None = Field(default=None, alias="requestedReason")
    adapter_reason: str | None = Field(default=None, alias="adapterReason")
    drift_detected: bool = Field(default=False, alias="driftDetected")
    drift_reason: DriftReason | None = Field(default=None, alias="driftReason")
    reported_by: str | None = Field(default=None, alias="reportedBy")
    message: str | None = None
    error: str | None = None


class DeploymentExecution(ApiModel):
    deployment_execution_id: str = Field(alias="deploymentExecutionId")
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    status: ExecutionStatus
    requested_by: str = Field(alias="requestedBy")
    force: bool = False
    started_at: str = Field(alias="startedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    claimed_by: str | None = Field(default=None, alias="claimedBy")
    items: list[DeploymentExecutionItem]


class DeploymentPlan(ApiModel):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    items: list[DeploymentExecutionItem]


