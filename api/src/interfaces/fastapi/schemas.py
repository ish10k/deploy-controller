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
    notes: str | None = Field(
        default=None,
        description="Optional operator notes for the deployment execution.",
        examples=["Approved under CAB-1421 after staging validation."],
    )
    tags: dict[str, str] = Field(
        default_factory=dict,
        description="Optional deployment execution metadata tags.",
        examples=[{"track": "prod"}],
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
    lease_seconds: int | None = Field(
        default=900,
        alias="leaseSeconds",
        description="Requested claim lease duration in seconds.",
        examples=[900],
    )
    claim_timeout_seconds: int | None = Field(
        default=900,
        alias="claimTimeoutSeconds",
        description="Requested item claim timeout in seconds.",
        examples=[900],
    )


class ReportExecutionItemStatusRequest(ApiSchema):
    status: ItemStatus = Field(
        description="Updated item status reported by the deployment runner.",
        examples=[ItemStatus.RUNNING, ItemStatus.SUCCEEDED, ItemStatus.FAILED],
    )
    reported_action: ReportedAction = Field(
        alias="reportedAction",
        description="Action the deployment runner actually performed.",
        examples=[ReportedAction.DEPLOY, ReportedAction.NOOP, ReportedAction.SKIP],
    )
    reported_by: str | None = Field(
        default=None,
        alias="reportedBy",
        description="Principal or runner reporting the item status.",
        examples=["runner-1"],
    )
    runner_reason: str | None = Field(
        default=None,
        alias="runnerReason",
        description="Optional deployment-runner-specific reason or note.",
        examples=["already up to date"],
    )
    message: str | None = Field(default=None, description="Optional status message from the deployment runner.")
    error: str | None = Field(default=None, description="Optional error details from the deployment runner.")
