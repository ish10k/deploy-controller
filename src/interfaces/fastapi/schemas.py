from pydantic import BaseModel, ConfigDict, Field


class ApiSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class PlanDeploymentRequest(ApiSchema):
    environment_id: str = Field(alias="environmentId")
    deployset_id: str = Field(alias="deploySetId")
    require_actual_sha_check: bool = Field(default=True, alias="requireActualShaCheck")


class CreateDeploymentRequest(PlanDeploymentRequest):
    requested_by: str = Field(alias="requestedBy")

