from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ComponentType = Literal["lambda", "ecs", "ec2-iis"]
EnvironmentStatus = Literal["idle", "planned", "applying", "succeeded", "failed", "rejected"]
ExecutionStatus = Literal["planned", "applying", "succeeded", "failed", "rejected"]
ItemAction = Literal["deploy", "noop", "skip"]
ItemStatus = Literal["pending", "running", "succeeded", "failed", "skipped"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class Component(ApiModel):
    component_id: str = Field(alias="componentId")
    type: ComponentType
    active: bool = True


class Release(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str
    artifact_sha256: str = Field(alias="artifactSha256")
    source_sha256: str | None = Field(default=None, alias="sourceSha256")
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


class DeploySetItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str


class DeploySet(ApiModel):
    deployset_id: str = Field(alias="deploySetId")
    schema_version: int = Field(alias="schemaVersion")
    items: list[DeploySetItem]
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")


class Environment(ApiModel):
    environment_id: str = Field(alias="environmentId")
    aws_account_id: str = Field(alias="awsAccountId")
    region: str
    active: bool = True


class EnvironmentTarget(ApiModel):
    environment_id: str = Field(alias="environmentId")
    component_id: str = Field(alias="componentId")
    type: ComponentType
    target_key: str = Field(alias="targetKey")


class TargetResolution(ApiModel):
    type: ComponentType
    target_key: str = Field(alias="targetKey")
    target: dict[str, Any]


class EnvironmentState(ApiModel):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str | None = Field(default=None, alias="deploySetId")
    status: EnvironmentStatus = "idle"
    last_deployment_execution_id: str | None = Field(default=None, alias="lastDeploymentExecutionId")
    updated_at: str = Field(alias="updatedAt")


class DeploymentExecutionItem(ApiModel):
    component_id: str = Field(alias="componentId")
    version: str
    artifact_sha256: str | None = Field(default=None, alias="artifactSha256")
    actual_sha256: str | None = Field(default=None, alias="actualSha256")
    action: ItemAction
    status: ItemStatus
    reason: str | None = None
    error: str | None = None


class DeploymentExecution(ApiModel):
    deployment_execution_id: str = Field(alias="deploymentExecutionId")
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    status: ExecutionStatus
    requested_by: str = Field(alias="requestedBy")
    started_at: str = Field(alias="startedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    items: list[DeploymentExecutionItem]


class DeploymentPlan(ApiModel):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    items: list[DeploymentExecutionItem]
