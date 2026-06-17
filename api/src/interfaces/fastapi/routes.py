from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.routing import APIRoute

from src.composition import Container
from src.domain.errors import DeploySetControllerError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploySetCreateRequest,
    DeploySet,
    DeploySetCreateResult,
    DeploymentExecution,
    DeploymentPlan,
    Environment,
    EnvironmentState,
    Release,
)
from src.interfaces.fastapi.dependencies import get_container
from src.interfaces.fastapi.schemas import (
    ClaimExecutionRequest,
    CreateDeploymentRequest,
    CreateDeploymentResponse,
    ErrorResponse,
    PlanDeploymentRequest,
    ReportExecutionItemStatusRequest,
    ReportExecutionStatusRequest,
)



def _to_camel_case(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:] if part)


def _generate_operation_id(route: APIRoute) -> str:
    return _to_camel_case(route.name)


router = APIRouter(generate_unique_id_function=_generate_operation_id)
ContainerDep = Annotated[Container, Depends(get_container)]

NOT_FOUND_RESPONSES = {404: {"model": ErrorResponse, "description": "Resource not found"}}
WRITE_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Validation error"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    409: {"model": ErrorResponse, "description": "Conflict"},
}


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


@router.get(
    "/components",
    tags=["Components"],
    summary="List components",
    description="Returns all registered components.",
    response_model=list[Component],
    responses=NOT_FOUND_RESPONSES,
)
def list_components(container: ContainerDep) -> list[Component]:
    return _handle(container.components.list)


@router.get(
    "/components/{component_id}",
    tags=["Components"],
    summary="Get a component",
    description="Returns a single component by component ID.",
    response_model=Component,
    responses=NOT_FOUND_RESPONSES,
)
def get_component(
    component_id: Annotated[str, Path(description="Component identifier.")],
    container: ContainerDep,
) -> Component:
    return _handle(lambda: container.components.get(component_id))


@router.put(
    "/components/{component_id}",
    tags=["Components"],
    summary="Create or update a component",
    description="Stores a component under the requested component ID.",
    response_model=Component,
    responses=WRITE_RESPONSES,
)
def put_component(
    component_id: Annotated[str, Path(description="Component identifier.")],
    component: Component,
    container: ContainerDep,
) -> Component:
    return _handle(lambda: container.components.put(component.model_copy(update={"component_id": component_id})))


@router.get(
    "/component-sets",
    tags=["Components"],
    summary="List component sets",
    description="Returns all registered ComponentSets.",
    response_model=list[ComponentSet],
    responses=NOT_FOUND_RESPONSES,
)
def list_component_sets(container: ContainerDep) -> list[ComponentSet]:
    return _handle(container.component_sets.list)


@router.get(
    "/component-sets/{component_set_id}",
    tags=["Components"],
    summary="Get a component set",
    description="Returns a single ComponentSet by ID.",
    response_model=ComponentSet,
    responses=NOT_FOUND_RESPONSES,
)
def get_component_set(
    component_set_id: Annotated[str, Path(description="ComponentSet identifier.")],
    container: ContainerDep,
) -> ComponentSet:
    return _handle(lambda: container.component_sets.get(component_set_id))


@router.put(
    "/component-sets/{component_set_id}",
    tags=["Components"],
    summary="Create or update a component set",
    description="Stores a ComponentSet under the requested ID.",
    response_model=ComponentSet,
    responses=WRITE_RESPONSES,
)
def put_component_set(
    component_set_id: Annotated[str, Path(description="ComponentSet identifier.")],
    component_set: ComponentSet,
    container: ContainerDep,
) -> ComponentSet:
    updated = component_set.model_copy(update={"component_set_id": component_set_id})
    return _handle(lambda: container.component_sets.put(updated))


@router.get(
    "/releases",
    tags=["Releases"],
    summary="List releases",
    description="Returns all releases, optionally filtered by component.",
    response_model=list[Release],
    responses=NOT_FOUND_RESPONSES,
)
def list_releases(
    container: ContainerDep,
    componentId: Annotated[str | None, Query(description="Optional component ID filter.")] = None,
) -> list[Release]:
    return _handle(lambda: container.releases.list(componentId))


@router.get(
    "/releases/{component_id}/{version}",
    tags=["Releases"],
    summary="Get a release",
    description="Returns a single release by component ID and version.",
    response_model=Release,
    responses=NOT_FOUND_RESPONSES,
)
def get_release(
    component_id: Annotated[str, Path(description="Component identifier.")],
    version: Annotated[str, Path(description="Release version.")],
    container: ContainerDep,
) -> Release:
    return _handle(lambda: container.releases.get(component_id, version))


@router.post(
    "/releases",
    tags=["Releases"],
    summary="Create a release",
    description="Stores a release for a component version.",
    response_model=Release,
    responses=WRITE_RESPONSES,
)
def create_release(release: Release, container: ContainerDep) -> Release:
    return _handle(lambda: container.releases.create(release))


@router.get(
    "/deploysets",
    tags=["DeploySets"],
    summary="List DeploySets",
    description="Returns all stored DeploySets.",
    response_model=list[DeploySet],
    responses=NOT_FOUND_RESPONSES,
)
def list_deploysets(container: ContainerDep) -> list[DeploySet]:
    return _handle(container.deploysets.list)


@router.get(
    "/deploysets/{deployset_id}",
    tags=["DeploySets"],
    summary="Get a DeploySet",
    description="Returns a single DeploySet by ID.",
    response_model=DeploySet,
    responses=NOT_FOUND_RESPONSES,
)
def get_deployset(
    deployset_id: Annotated[str, Path(description="DeploySet identifier.")],
    container: ContainerDep,
) -> DeploySet:
    return _handle(lambda: container.deploysets.get(deployset_id))


@router.post(
    "/deploysets",
    tags=["DeploySets"],
    summary="Create a DeploySet",
    description="Expands and stores a complete DeploySet from the provided request.",
    response_model=DeploySetCreateResult,
    responses=WRITE_RESPONSES,
)
def create_deployset(request: DeploySetCreateRequest, container: ContainerDep) -> DeploySetCreateResult:
    return _handle(lambda: container.deploysets.create(request))


@router.get(
    "/environments",
    tags=["Environments"],
    summary="List environments",
    description="Returns all registered environments.",
    response_model=list[Environment],
    responses=NOT_FOUND_RESPONSES,
)
def list_environments(container: ContainerDep) -> list[Environment]:
    return _handle(container.environments.list)


@router.get(
    "/environments/{environment_id}",
    tags=["Environments"],
    summary="Get an environment",
    description="Returns a single environment by ID.",
    response_model=Environment,
    responses=NOT_FOUND_RESPONSES,
)
def get_environment(
    environment_id: Annotated[str, Path(description="Environment identifier.")],
    container: ContainerDep,
) -> Environment:
    return _handle(lambda: container.environments.get(environment_id))


@router.put(
    "/environments/{environment_id}",
    tags=["Environments"],
    summary="Create or update an environment",
    description="Stores an environment under the requested ID.",
    response_model=Environment,
    responses=WRITE_RESPONSES,
)
def put_environment(
    environment_id: Annotated[str, Path(description="Environment identifier.")],
    environment: Environment,
    container: ContainerDep,
) -> Environment:
    updated = environment.model_copy(update={"environment_id": environment_id})
    return _handle(lambda: container.environments.put(updated))


@router.get(
    "/environment-state",
    tags=["Environments"],
    summary="List environment state",
    description="Returns the latest known state for each environment.",
    response_model=list[EnvironmentState],
    responses=NOT_FOUND_RESPONSES,
)
def list_environment_states(container: ContainerDep) -> list[EnvironmentState]:
    return _handle(container.read_only.list_environment_states)


@router.get(
    "/environment-state/{environment_id}",
    tags=["Environments"],
    summary="Get environment state",
    description="Returns the latest known state for a single environment.",
    response_model=EnvironmentState,
    responses=NOT_FOUND_RESPONSES,
)
def get_environment_state(
    environment_id: Annotated[str, Path(description="Environment identifier.")],
    container: ContainerDep,
) -> EnvironmentState:
    return _handle(lambda: container.read_only.get_environment_state(environment_id))


@router.get(
    "/deployment-executions",
    tags=["Deployments"],
    summary="List deployment executions",
    description="Returns deployment executions, optionally filtered by environment.",
    response_model=list[DeploymentExecution],
    responses=NOT_FOUND_RESPONSES,
)
def list_deployment_executions(
    container: ContainerDep,
    environmentId: Annotated[str | None, Query(description="Optional environment ID filter.")] = None,
) -> list[DeploymentExecution]:
    return _handle(lambda: container.read_only.list_deployment_executions(environmentId))


@router.get(
    "/deployment-executions/{deployment_execution_id}",
    tags=["Deployments"],
    summary="Get a deployment execution",
    description="Returns a single deployment execution by ID.",
    response_model=DeploymentExecution,
    responses=NOT_FOUND_RESPONSES,
)
def get_deployment_execution(
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.read_only.get_deployment_execution(deployment_execution_id))


@router.post(
    "/deployments/plan",
    tags=["Deployments"],
    summary="Plan a deployment",
    description="Generates a deployment plan without creating an execution.",
    response_model=DeploymentPlan,
    responses=WRITE_RESPONSES,
)
def plan_deployment(request: PlanDeploymentRequest, container: ContainerDep) -> DeploymentPlan:
    return _handle(
        lambda: container.plan_deployment.execute(
            environment_id=request.environment_id,
            deployset_id=request.deployset_id,
            force=request.force,
        )
    )


@router.post(
    "/deployments",
    tags=["Deployments"],
    summary="Create a deployment",
    description="Creates a deployment execution from a planned DeploySet.",
    response_model=CreateDeploymentResponse,
    responses=WRITE_RESPONSES,
)
def create_deployment(request: CreateDeploymentRequest, container: ContainerDep) -> CreateDeploymentResponse:
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


@router.get(
    "/adapter/executions/pending",
    tags=["Adapters"],
    summary="List pending adapter executions",
    description="Returns deployment executions that are ready to be claimed by an adapter.",
    response_model=list[DeploymentExecution],
    responses=NOT_FOUND_RESPONSES,
)
def list_pending_adapter_executions(container: ContainerDep) -> list[DeploymentExecution]:
    return _handle(container.adapters.list_pending)


@router.post(
    "/adapter/executions/{deployment_execution_id}/claim",
    tags=["Adapters"],
    summary="Claim a deployment execution",
    description="Marks a pending deployment execution as claimed.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def claim_adapter_execution(
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    request: ClaimExecutionRequest,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.adapters.claim(deployment_execution_id, request.claimed_by))


@router.post(
    "/adapter/executions/{deployment_execution_id}/items/{component_id}/status",
    tags=["Adapters"],
    summary="Report execution item status",
    description="Updates a single component item status for a deployment execution.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def report_adapter_item_status(
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    component_id: Annotated[str, Path(description="Component identifier.")],
    request: ReportExecutionItemStatusRequest,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(
        lambda: container.adapters.report_item_status(
            deployment_execution_id=deployment_execution_id,
            component_id=component_id,
            status=request.status,
            reported_action=request.reported_action,
            reported_by=request.reported_by,
            adapter_reason=request.adapter_reason,
            message=request.message,
            error=request.error,
        )
    )


@router.post(
    "/adapter/executions/{deployment_execution_id}/status",
    tags=["Adapters"],
    summary="Report deployment execution status",
    description="Updates the overall status of a deployment execution.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def report_adapter_execution_status(
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    request: ReportExecutionStatusRequest,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.adapters.report_execution_status(deployment_execution_id, request.status))


