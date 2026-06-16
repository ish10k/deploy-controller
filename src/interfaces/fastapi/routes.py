from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from src.composition import Container
from src.domain.errors import DeploySetControllerError
from src.domain.models import (
    Component,
    DeploySet,
    Environment,
    EnvironmentTarget,
    Release,
    TargetResolution,
)
from src.interfaces.fastapi.dependencies import get_container
from src.interfaces.fastapi.schemas import CreateDeploymentRequest, PlanDeploymentRequest

router = APIRouter()
ContainerDep = Annotated[Container, Depends(get_container)]


def _json(value: Any) -> Any:
    if isinstance(value, list):
        return [_json(item) for item in value]
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
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
def create_deployset(deployset: DeploySet, container: ContainerDep) -> Any:
    return _handle(lambda: container.deploysets.create(deployset))


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


@router.get("/environment-targets")
def list_environment_targets(container: ContainerDep, environmentId: str | None = None) -> Any:
    return _handle(lambda: container.environment_targets.list(environmentId))


@router.get("/environment-targets/{environment_id}/{component_id}")
def get_environment_target(environment_id: str, component_id: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.environment_targets.get(environment_id, component_id))


@router.put("/environment-targets/{environment_id}/{component_id}")
def put_environment_target(
    environment_id: str,
    component_id: str,
    target: EnvironmentTarget,
    container: ContainerDep,
) -> Any:
    updated = target.model_copy(update={"environment_id": environment_id, "component_id": component_id})
    return _handle(lambda: container.environment_targets.put(updated))


@router.get("/target-resolutions")
def list_target_resolutions(container: ContainerDep, type: str | None = None) -> Any:
    return _handle(lambda: container.target_resolutions.list(type))


@router.get("/target-resolutions/{component_type}/{target_key:path}")
def get_target_resolution(component_type: str, target_key: str, container: ContainerDep) -> Any:
    return _handle(lambda: container.target_resolutions.get(component_type, target_key))


@router.put("/target-resolutions/{component_type}/{target_key:path}")
def put_target_resolution(
    component_type: str,
    target_key: str,
    resolution: TargetResolution,
    container: ContainerDep,
) -> Any:
    updated = resolution.model_copy(update={"type": component_type, "target_key": target_key})
    return _handle(lambda: container.target_resolutions.put(updated))


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
            require_actual_sha_check=request.require_actual_sha_check,
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
                require_actual_sha_check=request.require_actual_sha_check,
            ).deployment_execution_id,
            "status": "planned",
        }
    )
