from pydantic import BaseModel, ConfigDict, Field

from src.domain.enums import ExecutionStatus, ItemStatus, ReportedAction


class ApiSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ErrorResponse(ApiSchema):
    detail: str = Field(description="Human-readable error message.")


class PlanDeploymentRequest(ApiSchema):
    environment_id: str = Field(
        alias="environmentId",
        description="Target environment to plan against.",
        examples=["prod"],
    )
    deployset_id: str = Field(
        alias="deploySetId",
        description="DeploySet to plan.",
        examples=["prod-default"],
    )
    force: bool = Field(
        default=False,
        description="Force a redeploy even when the latest successful execution already matches.",
    )


class CreateDeploymentRequest(PlanDeploymentRequest):
    requested_by: str = Field(
        alias="requestedBy",
        description="Principal requesting the deployment.",
        examples=["ops@company.com"],
    )


class CreateDeploymentResponse(ApiSchema):
    deployment_execution_id: str = Field(
        alias="deploymentExecutionId",
        description="Identifier of the created deployment execution.",
        examples=["dep_exec_123"],
    )
    status: ExecutionStatus = Field(
        default=ExecutionStatus.PENDING,
        description="Initial deployment execution status.",
        examples=[ExecutionStatus.PENDING],
    )


class ClaimExecutionRequest(ApiSchema):
    claimed_by: str = Field(
        alias="claimedBy",
        description="Principal claiming the execution.",
        examples=["runner-1"],
    )


class ReportExecutionStatusRequest(ApiSchema):
    status: ExecutionStatus = Field(
        description="Updated execution status reported by the adapter.",
        examples=[ExecutionStatus.RUNNING, ExecutionStatus.SUCCEEDED, ExecutionStatus.FAILED],
    )


class ReportExecutionItemStatusRequest(ApiSchema):
    status: ItemStatus = Field(
        description="Updated item status reported by the adapter.",
        examples=[ItemStatus.RUNNING, ItemStatus.SUCCEEDED, ItemStatus.FAILED],
    )
    reported_action: ReportedAction = Field(
        alias="reportedAction",
        description="Action the adapter actually performed.",
        examples=[ReportedAction.DEPLOY, ReportedAction.NOOP, ReportedAction.SKIP],
    )
    reported_by: str = Field(
        alias="reportedBy",
        description="Principal or runner reporting the item status.",
        examples=["runner-1"],
    )
    adapter_reason: str | None = Field(
        default=None,
        alias="adapterReason",
        description="Optional adapter-specific reason or note.",
        examples=["already up to date"],
    )
    message: str | None = Field(default=None, description="Optional status message from the adapter.")
    error: str | None = Field(default=None, description="Optional error details from the adapter.")


