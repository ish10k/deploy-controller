from pydantic import BaseModel, ConfigDict, Field

from src.domain.enums import ExecutionStatus, ItemStatus, ReportedAction


class ApiSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class PlanDeploymentRequest(ApiSchema):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    force: bool = False


class CreateDeploymentRequest(PlanDeploymentRequest):
    requested_by: str = Field(alias="requestedBy")


class ClaimExecutionRequest(ApiSchema):
    claimed_by: str = Field(alias="claimedBy")


class ReportExecutionStatusRequest(ApiSchema):
    status: ExecutionStatus


class ReportExecutionItemStatusRequest(ApiSchema):
    status: ItemStatus
    reported_action: ReportedAction = Field(alias="reportedAction")
    reported_by: str = Field(alias="reportedBy")
    adapter_reason: str | None = Field(default=None, alias="adapterReason")
    observed_artifact_sha256: str | None = Field(default=None, alias="observedArtifactSha256")
    message: str | None = None
    error: str | None = None
