import json
from typing import Any

from pydantic import BaseModel

from src.composition import Container
from src.domain.errors import NotFoundError
from src.domain.models import (
    Component,
    DeploySet,
    Environment,
    EnvironmentTarget,
    Release,
    TargetResolution,
)
from src.interfaces.fastapi.schemas import CreateDeploymentRequest, PlanDeploymentRequest
from src.interfaces.lambda_api.responses import response


def _body(event: dict[str, Any], model: type[BaseModel]) -> BaseModel:
    raw = event.get("body") or "{}"
    data = json.loads(raw) if isinstance(raw, str) else raw
    return model.model_validate(data)


def _query(event: dict[str, Any], key: str) -> str | None:
    params = event.get("queryStringParameters") or {}
    return params.get(key)


def route(event: dict[str, Any], container: Container) -> dict[str, Any]:
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
    path = event.get("rawPath") or event.get("path", "/")
    parts = [part for part in path.strip("/").split("/") if part]

    if method == "GET" and parts == ["components"]:
        return response(200, container.components.list())
    if method == "GET" and len(parts) == 2 and parts[0] == "components":
        return response(200, container.components.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "components":
        component = _body(event, Component).model_copy(update={"component_id": parts[1]})
        return response(200, container.components.put(component))

    if method == "GET" and parts == ["releases"]:
        return response(200, container.releases.list(_query(event, "componentId")))
    if method == "GET" and len(parts) == 3 and parts[0] == "releases":
        return response(200, container.releases.get(parts[1], parts[2]))
    if method == "POST" and parts == ["releases"]:
        return response(200, container.releases.create(_body(event, Release)))

    if method == "GET" and parts == ["deploysets"]:
        return response(200, container.deploysets.list())
    if method == "GET" and len(parts) == 2 and parts[0] == "deploysets":
        return response(200, container.deploysets.get(parts[1]))
    if method == "POST" and parts == ["deploysets"]:
        return response(200, container.deploysets.create(_body(event, DeploySet)))

    if method == "GET" and parts == ["environments"]:
        return response(200, container.environments.list())
    if method == "GET" and len(parts) == 2 and parts[0] == "environments":
        return response(200, container.environments.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "environments":
        environment = _body(event, Environment).model_copy(update={"environment_id": parts[1]})
        return response(200, container.environments.put(environment))

    if method == "GET" and parts == ["environment-targets"]:
        return response(200, container.environment_targets.list(_query(event, "environmentId")))
    if method == "GET" and len(parts) == 3 and parts[0] == "environment-targets":
        return response(200, container.environment_targets.get(parts[1], parts[2]))
    if method == "PUT" and len(parts) == 3 and parts[0] == "environment-targets":
        target = _body(event, EnvironmentTarget).model_copy(
            update={"environment_id": parts[1], "component_id": parts[2]}
        )
        return response(200, container.environment_targets.put(target))

    if method == "GET" and parts == ["target-resolutions"]:
        return response(200, container.target_resolutions.list(_query(event, "type")))
    if len(parts) >= 3 and parts[0] == "target-resolutions":
        component_type = parts[1]
        target_key = "/".join(parts[2:])
        if method == "GET":
            return response(200, container.target_resolutions.get(component_type, target_key))
        if method == "PUT":
            resolution = _body(event, TargetResolution).model_copy(
                update={"type": component_type, "target_key": target_key}
            )
            return response(200, container.target_resolutions.put(resolution))

    if method == "GET" and parts == ["environment-state"]:
        return response(200, container.read_only.list_environment_states())
    if method == "GET" and len(parts) == 2 and parts[0] == "environment-state":
        return response(200, container.read_only.get_environment_state(parts[1]))

    if method == "GET" and parts == ["deployment-executions"]:
        return response(200, container.read_only.list_deployment_executions(_query(event, "environmentId")))
    if method == "GET" and len(parts) == 2 and parts[0] == "deployment-executions":
        return response(200, container.read_only.get_deployment_execution(parts[1]))

    if method == "POST" and parts == ["deployments", "plan"]:
        request = _body(event, PlanDeploymentRequest)
        return response(200, container.plan_deployment.execute(
            environment_id=request.environment_id,
            deployset_id=request.deployset_id,
            require_actual_sha_check=request.require_actual_sha_check,
        ))
    if method == "POST" and parts == ["deployments"]:
        request = _body(event, CreateDeploymentRequest)
        execution = container.create_deployment.execute(
            environment_id=request.environment_id,
            deployset_id=request.deployset_id,
            requested_by=request.requested_by,
            require_actual_sha_check=request.require_actual_sha_check,
        )
        return response(200, {"deploymentExecutionId": execution.deployment_execution_id, "status": "planned"})

    raise NotFoundError(f"Route not found: {method} {path}")
