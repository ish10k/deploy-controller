from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from src.composition import Container
from src.domain.errors import DeploySetControllerError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploySetCreateRequest,
    Environment,
    Release,
)
from src.interfaces.fastapi.dependencies import get_container
from src.interfaces.fastapi.schemas import (
    ClaimExecutionRequest,
    CreateDeploymentRequest,
    PlanDeploymentRequest,
    ReportExecutionItemStatusRequest,
    ReportExecutionStatusRequest,
)

router = APIRouter()
ContainerDep = Annotated[Container, Depends(get_container)]


def _json(value: Any) -> Any:
    if isinstance(value, list):
        return [_json(item) for item in value]
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True, mode="json")
    return value


def _handle(fn: Any) -> Any:
    try:
        return _json(fn())
    except DeploySetControllerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/components")
def list_components(container: ContainerDep) -> Any:
    return _handle(container.components.list)


@router.get("/components/{component_id}")
def get_component(component_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.components.get(component_id))


@router.put("/components/{component_id}")
def put_component(component_id: str, component: Component, container: ContainerDep) -> Any:
    return _handle(lambda: container.components.put(component.model_copy(update={"component_id": component_id})))


@router.get("/component-sets")
def list_component_sets(container: ContainerDep) -> Any:
    return _handle(container.component_sets.list)


@router.get("/component-sets/{component_set_id}")
def get_component_set(component_set_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.component_sets.get(component_set_id))


@router.put("/component-sets/{component_set_id}")
def put_component_set(component_set_id: str, component_set: ComponentSet, container: ContainerDep) -> Any:
    updated = component_set.model_copy(update={"component_set_id": component_set_id})
    return _handle(lambda: container.component_sets.put(updated))


@router.get("/releases")
def list_releases(container: ContainerDep, componentId: str | None = None) -> Any:
    return _handle(lambda: container.releases.list(componentId))


@router.get("/releases/{component_id}/{version}")
def get_release(component_id: str, version: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.releases.get(component_id, version))


@router.post("/releases")
def create_release(release: Release, container: ContainerDep) -> Any:
    return _handle(lambda: container.releases.create(release))


@router.get("/deploysets")
def list_deploysets(container: ContainerDep) -> Any:
    return _handle(container.deploysets.list)


@router.get("/deploysets/{deployset_id}")
def get_deployset(deployset_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.deploysets.get(deployset_id))


@router.post("/deploysets")
def create_deployset(request: DeploySetCreateRequest, container: ContainerDep) -> Any:
    return _handle(lambda: container.deploysets.create(request))


@router.get("/environments")
def list_environments(container: ContainerDep) -> Any:
    return _handle(container.environments.list)


@router.get("/environments/{environment_id}")
def get_environment(environment_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.environments.get(environment_id))


@router.put("/environments/{environment_id}")
def put_environment(environment_id: str, environment: Environment, container: ContainerDep) -> Any:
    updated = environment.model_copy(update={"environment_id": environment_id})
    return _handle(lambda: container.environments.put(updated))


@router.get("/environment-state")
def list_environment_states(container: ContainerDep) -> Any:
    return _handle(container.read_only.list_environment_states)


@router.get("/environment-state/{environment_id}")
def get_environment_state(environment_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.read_only.get_environment_state(environment_id))


@router.get("/deployment-executions")
def list_deployment_executions(container: ContainerDep, environmentId: str | None = None) -> Any:
    return _handle(lambda: container.read_only.list_deployment_executions(environmentId))


@router.get("/deployment-executions/{deployment_execution_id}")
def get_deployment_execution(deployment_execution_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.read_only.get_deployment_execution(deployment_execution_id))


@router.post("/deployments/plan")
def plan_deployment(request: PlanDeploymentRequest, container: ContainerDep) -> Any:
    return _handle(
        lambda: container.plan_deployment.execute(
            environment_id=request.environment_id,
            deployset_id=request.deployset_id,
            force=request.force,
        )
    )


@router.post("/deployments")
def create_deployment(request: CreateDeploymentRequest, container: ContainerDep) -> Any:
    return _handle(
        lambda: {
            "deploymentExecutionId": container.create_deployment.execute(
                environment_id=request.environment_id,
                deployset_id=request.deployset_id,
                requested_by=request.requested_by,
                force=request.force,
            ).deployment_execution_id,
            "status": "pending",
        }
    )


@router.get("/adapter/executions/pending")
def list_pending_adapter_executions(container: ContainerDep) -> Any:
    return _handle(container.adapters.list_pending)


@router.post("/adapter/executions/{deployment_execution_id}/claim")
def claim_adapter_execution(
    deployment_execution_id: str,
    request: ClaimExecutionRequest,
    container: ContainerDep,
) -> Any:
    return _handle(lambda: container.adapters.claim(deployment_execution_id, request.claimed_by))


@router.post("/adapter/executions/{deployment_execution_id}/items/{component_id}/status")
def report_adapter_item_status(
    deployment_execution_id: str,
    component_id: str,
    request: ReportExecutionItemStatusRequest,
    container: ContainerDep,
) -> Any:
    return _handle(
        lambda: container.adapters.report_item_status(
            deployment_execution_id=deployment_execution_id,
            component_id=component_id,
            status=request.status,
            reported_action=request.reported_action,
            reported_by=request.reported_by,
            adapter_reason=request.adapter_reason,
            observed_artifact_sha256=request.observed_artifact_sha256,
            message=request.message,
            error=request.error,
        )
    )


@router.post("/adapter/executions/{deployment_execution_id}/status")
def report_adapter_execution_status(
    deployment_execution_id: str,
    request: ReportExecutionStatusRequest,
    container: ContainerDep,
) -> Any:
    return _handle(lambda: container.adapters.report_execution_status(deployment_execution_id, request.status))
