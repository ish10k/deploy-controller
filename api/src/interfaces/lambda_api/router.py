import json
from typing import Any

from pydantic import BaseModel

from src.composition import Container
from src.domain.errors import NotFoundError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploySetCreateRequest,
    Environment,
    Release,
)
from src.interfaces.fastapi.schemas import (
    ClaimExecutionRequest,
    CreateDeploymentRequest,
    PlanDeploymentRequest,
    ReportExecutionItemStatusRequest,
    ReportExecutionStatusRequest,
)
from src.interfaces.lambda_api.responses import response


def _body[T: BaseModel](event: dict[str, Any], model: type[T]) -> T:
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

    if method == "GET" and parts == ["component-sets"]:
        return response(200, container.component_sets.list())
    if method == "GET" and len(parts) == 2 and parts[0] == "component-sets":
        return response(200, container.component_sets.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "component-sets":
        component_set = _body(event, ComponentSet).model_copy(update={"component_set_id": parts[1]})
        return response(200, container.component_sets.put(component_set))

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
        return response(200, container.deploysets.create(_body(event, DeploySetCreateRequest)))

    if method == "GET" and parts == ["environments"]:
        return response(200, container.environments.list())
    if method == "GET" and len(parts) == 2 and parts[0] == "environments":
        return response(200, container.environments.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "environments":
        environment = _body(event, Environment).model_copy(update={"environment_id": parts[1]})
        return response(200, container.environments.put(environment))

    if method == "GET" and parts == ["environment-state"]:
        return response(200, container.read_only.list_environment_states())
    if method == "GET" and len(parts) == 2 and parts[0] == "environment-state":
        return response(200, container.read_only.get_environment_state(parts[1]))

    if method == "GET" and parts == ["deployment-executions"]:
        return response(200, container.read_only.list_deployment_executions(_query(event, "environmentId")))
    if method == "GET" and len(parts) == 2 and parts[0] == "deployment-executions":
        return response(200, container.read_only.get_deployment_execution(parts[1]))

    if method == "POST" and parts == ["deployments", "plan"]:
        plan_request = _body(event, PlanDeploymentRequest)
        return response(200, container.plan_deployment.execute(
            environment_id=plan_request.environment_id,
            deployset_id=plan_request.deployset_id,
            force=plan_request.force,
        ))
    if method == "POST" and parts == ["deployments"]:
        deployment_request = _body(event, CreateDeploymentRequest)
        execution = container.create_deployment.execute(
            environment_id=deployment_request.environment_id,
            deployset_id=deployment_request.deployset_id,
            requested_by=deployment_request.requested_by,
            force=deployment_request.force,
        )
        return response(200, {"deploymentExecutionId": execution.deployment_execution_id, "status": "pending"})

    if method == "GET" and parts == ["adapter", "executions", "pending"]:
        return response(200, container.adapters.list_pending())
    if method == "POST" and len(parts) == 4 and parts[:2] == ["adapter", "executions"] and parts[3] == "claim":
        claim_request = _body(event, ClaimExecutionRequest)
        return response(200, container.adapters.claim(parts[2], claim_request.claimed_by))
    if (
        method == "POST"
        and len(parts) == 6
        and parts[:2] == ["adapter", "executions"]
        and parts[3] == "items"
        and parts[5] == "status"
    ):
        item_status_request = _body(event, ReportExecutionItemStatusRequest)
        return response(200, container.adapters.report_item_status(
            deployment_execution_id=parts[2],
            component_id=parts[4],
            status=item_status_request.status,
            reported_action=item_status_request.reported_action,
            reported_by=item_status_request.reported_by,
            adapter_reason=item_status_request.adapter_reason,
            message=item_status_request.message,
            error=item_status_request.error,
        ))
    if method == "POST" and len(parts) == 4 and parts[:2] == ["adapter", "executions"] and parts[3] == "status":
        execution_status_request = _body(event, ReportExecutionStatusRequest)
        return response(200, container.adapters.report_execution_status(parts[2], execution_status_request.status))

    raise NotFoundError(f"Route not found: {method} {path}")


