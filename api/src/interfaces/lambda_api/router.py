import json
from typing import Any

from pydantic import BaseModel

from src.composition import Container
from src.application.use_cases.auth import require_pat_context
from src.domain.errors import NotFoundError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentRunner,
    DeploymentRunnerCreateRequest,
    DeploySetCreateRequest,
    Environment,
    Principal,
    Release,
    ReleaseSource,
    ReleaseSourceCreateRequest,
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


def _auth_context(event: dict[str, Any], container: Container):
    headers = event.get("headers") or {}
    authorization = headers.get("authorization") or headers.get("Authorization")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        from src.domain.errors import UnauthorizedError
        raise UnauthorizedError("Authorization bearer token is required.")
    if token.startswith("settle_pat_"):
        return require_pat_context(
            token=token,
            principals=container.principals.list(),
            runners=container.deployment_runners.list(),
            release_sources=container.release_sources.list(),
        )
    from src.domain.errors import UnauthorizedError
    raise UnauthorizedError("OIDC authentication is not configured in this runtime.")


def route(event: dict[str, Any], container: Container) -> dict[str, Any]:
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
    path = event.get("rawPath") or event.get("path", "/")
    parts = [part for part in path.strip("/").split("/") if part]

    if method == "GET" and parts == ["whoami"]:
        return response(200, container.principals.whoami(_auth_context(event, container)))
    if method == "GET" and parts == ["bootstrap"]:
        return response(200, container.principals.bootstrap_state())
    if method == "GET" and parts == ["principals"]:
        return response(200, container.principals.list())
    if method == "POST" and parts == ["principals"]:
        return response(200, container.principals.create(_body(event, Principal)))
    if method == "GET" and len(parts) == 2 and parts[0] == "principals":
        return response(200, container.principals.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "principals":
        principal = _body(event, Principal).model_copy(update={"principal_id": parts[1]})
        return response(200, container.principals.put(principal))

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
            notes=deployment_request.notes,
            force=deployment_request.force,
            tags=deployment_request.tags,
        )
        return response(200, {"deploymentExecutionId": execution.deployment_execution_id, "status": "pending"})

    if method == "GET" and parts == ["release-sources"]:
        return response(200, container.release_sources.list())
    if method == "POST" and parts == ["release-sources"]:
        release_source = _body(event, ReleaseSourceCreateRequest)
        return response(200, container.release_sources.create(release_source))
    if method == "GET" and len(parts) == 2 and parts[0] == "release-sources":
        return response(200, container.release_sources.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "release-sources":
        release_source = _body(event, ReleaseSource).model_copy(update={"release_source_id": parts[1]})
        return response(200, container.release_sources.put(release_source))
    if method == "POST" and len(parts) == 3 and parts[0] == "release-sources" and parts[2] == "rotate-token":
        return response(200, container.release_sources.rotate_token(parts[1]))
    if method == "POST" and len(parts) == 3 and parts[0] == "release-sources" and parts[2] == "releases":
        release = _body(event, Release)
        return response(200, container.release_sources.publish_release(parts[1], release))

    if method == "GET" and parts == ["deployment-runners"]:
        return response(200, container.deployment_runners.list())
    if method == "POST" and parts == ["deployment-runners"]:
        runner = _body(event, DeploymentRunnerCreateRequest)
        return response(200, container.deployment_runners.create(runner))
    if method == "GET" and len(parts) == 2 and parts[0] == "deployment-runners":
        return response(200, container.deployment_runners.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "deployment-runners":
        runner = _body(event, DeploymentRunner).model_copy(update={"runner_id": parts[1]})
        return response(200, container.deployment_runners.put(runner))
    if method == "POST" and len(parts) == 3 and parts[0] == "deployment-runners" and parts[2] == "rotate-token":
        return response(200, container.deployment_runners.rotate_token(parts[1]))
    if method == "POST" and len(parts) == 3 and parts[0] == "deployment-runners" and parts[2] == "heartbeat":
        return response(200, container.deployment_runners.heartbeat(parts[1]))
    if method == "GET" and len(parts) == 4 and parts[0] == "deployment-runners" and parts[2:] == ["executions", "pending"]:
        return response(200, container.deployment_runners.list_pending(parts[1]))
    if method == "POST" and len(parts) == 5 and parts[0] == "deployment-runners" and parts[2] == "executions" and parts[4] == "claim":
        claim_request = _body(event, ClaimExecutionRequest)
        return response(200, container.deployment_runners.claim(parts[1], parts[3], claim_request.lease_seconds))
    if (
        method == "POST"
        and len(parts) == 7
        and parts[0] == "deployment-runners"
        and parts[2] == "executions"
        and parts[4] == "items"
        and parts[6] == "status"
    ):
        item_status_request = _body(event, ReportExecutionItemStatusRequest)
        return response(200, container.deployment_runners.report_item_status(
            runner_id=parts[1],
            deployment_execution_id=parts[3],
            component_id=parts[5],
            status=item_status_request.status,
            reported_action=item_status_request.reported_action,
            reported_by=item_status_request.reported_by,
            runner_reason=item_status_request.runner_reason,
            message=item_status_request.message,
            error=item_status_request.error,
        ))
    if method == "POST" and len(parts) == 5 and parts[0] == "deployment-runners" and parts[2] == "executions" and parts[4] == "status":
        execution_status_request = _body(event, ReportExecutionStatusRequest)
        return response(200, container.deployment_runners.report_execution_status(parts[1], parts[3], execution_status_request.status))

    raise NotFoundError(f"Route not found: {method} {path}")


