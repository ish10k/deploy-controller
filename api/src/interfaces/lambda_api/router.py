import json
from typing import Any

from pydantic import BaseModel

from src.composition import Container
from src.application.use_cases.auth import require_pat_context
from src.domain.errors import NotFoundError
from src.domain.models import (
    Component,
    Release,
    DeploymentRunner,
    DeploymentRunnerCreateRequest,
    ReleaseCreateRequest,
    Environment,
    Organization,
    OrganizationMembership,
    Principal,
    Version,
    Publisher,
    PublisherCreateRequest,
    Role,
    TagDefinition,
    Webhook,
    Workspace,
    WorkspaceMembership,
)
from src.domain.enums import TagResourceType
from src.interfaces.fastapi.schemas import (
    ClaimExecutionRequest,
    CreateDeploymentRequest,
    PlanDeploymentRequest,
    ReportExecutionItemStatusRequest,
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
    if token.startswith("onerelease_pat_"):
        return require_pat_context(
            token=token,
            principals=container.principals.list(),
            runners=container.deployment_runners.list(),
            publishers=container.publishers.list(),
            roles=container.roles.list_unchecked(),
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
        return response(200, container.principals.create(_body(event, Principal), _auth_context(event, container)))
    if method == "GET" and len(parts) == 2 and parts[0] == "principals":
        return response(200, container.principals.get(parts[1]))
    if method == "PUT" and len(parts) == 2 and parts[0] == "principals":
        principal = _body(event, Principal).model_copy(update={"principal_id": parts[1]})
        return response(200, container.principals.put(principal, _auth_context(event, container)))

    if method == "GET" and parts == ["organizations"]:
        return response(200, container.organizations.list(_auth_context(event, container)))
    if method == "POST" and parts == ["organizations"]:
        organization = _body(event, Organization)
        return response(200, container.organizations.put(organization.organization_id, organization, _auth_context(event, container)))
    if method == "GET" and len(parts) == 2 and parts[0] == "organizations":
        return response(200, container.organizations.get(parts[1], _auth_context(event, container)))
    if method == "PUT" and len(parts) == 2 and parts[0] == "organizations":
        return response(200, container.organizations.put(parts[1], _body(event, Organization), _auth_context(event, container)))
    if method == "GET" and len(parts) == 3 and parts[0] == "organizations" and parts[2] == "workspaces":
        return response(200, container.organizations.list_workspaces(parts[1], _auth_context(event, container)))
    if method == "POST" and len(parts) == 3 and parts[0] == "organizations" and parts[2] == "workspaces":
        return response(200, container.organizations.create_workspace(parts[1], _body(event, Workspace), _auth_context(event, container)))
    if method == "GET" and len(parts) == 3 and parts[0] == "organizations" and parts[2] == "memberships":
        return response(200, container.organizations.list_memberships(parts[1], _auth_context(event, container)))
    if method == "PUT" and len(parts) == 4 and parts[0] == "organizations" and parts[2] == "memberships":
        return response(200, container.organizations.put_membership(parts[1], parts[3], _body(event, OrganizationMembership), _auth_context(event, container)))

    if method == "GET" and len(parts) == 2 and parts[0] == "workspaces":
        return response(200, container.workspaces.get(parts[1], _auth_context(event, container)))
    if method == "PUT" and len(parts) == 2 and parts[0] == "workspaces":
        return response(200, container.workspaces.put(parts[1], _body(event, Workspace), _auth_context(event, container)))
    if method == "GET" and len(parts) == 3 and parts[0] == "workspaces" and parts[2] == "memberships":
        return response(200, container.workspaces.list_memberships(parts[1], _auth_context(event, container)))
    if method == "GET" and len(parts) == 4 and parts[0] == "workspaces" and parts[2] == "memberships":
        return response(200, container.workspaces.get_membership(parts[1], parts[3], _auth_context(event, container)))
    if method == "PUT" and len(parts) == 4 and parts[0] == "workspaces" and parts[2] == "memberships":
        return response(200, container.workspaces.put_membership(parts[1], parts[3], _body(event, WorkspaceMembership), _auth_context(event, container)))

    if len(parts) >= 3 and parts[0] == "workspaces":
        workspace_id = parts[1]
        scoped = parts[2:]
        if method == "GET" and scoped == ["components"]:
            return response(200, container.components.list(workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "components":
            return response(200, container.components.get(scoped[1], workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "components":
            component = _body(event, Component).model_copy(update={"workspace_id": workspace_id, "component_id": scoped[1]})
            return response(200, container.components.put(component, _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["releases"]:
            return response(200, container.releases.list(workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "releases":
            return response(200, container.releases.get(scoped[1], workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "releases":
            release = _body(event, Release).model_copy(update={"workspace_id": workspace_id, "release_id": scoped[1]})
            return response(200, container.releases.put(release, _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["versions"]:
            return response(200, container.versions.list(_query(event, "componentId"), workspace_id))
        if method == "GET" and len(scoped) == 3 and scoped[0] == "versions":
            return response(200, container.versions.get(scoped[1], scoped[2], workspace_id))
        if method == "POST" and scoped == ["versions"]:
            return response(200, container.versions.create(_body(event, Version), _auth_context(event, container), workspace_id))
        if method == "POST" and scoped == ["releases"]:
            return response(200, container.releases.create(_body(event, ReleaseCreateRequest), _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["environments"]:
            return response(200, container.environments.list(workspace_id))
        if method == "GET" and scoped == ["tag-definitions"]:
            resource_type = _query(event, "resourceType")
            return response(
                200,
                container.tag_definitions.list(
                    _auth_context(event, container),
                    workspace_id,
                    TagResourceType(resource_type) if resource_type else None,
                ),
            )
        if method == "GET" and len(scoped) == 2 and scoped[0] == "environments":
            return response(200, container.environments.get(scoped[1], workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "environments":
            environment = _body(event, Environment).model_copy(update={"workspace_id": workspace_id, "environment_id": scoped[1]})
            return response(200, container.environments.put(environment, _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["environment-state"]:
            return response(200, container.read_only.list_environment_states(workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "environment-state":
            return response(200, container.read_only.get_environment_state(scoped[1], workspace_id))
        if method == "GET" and scoped == ["deployments"]:
            return response(200, container.read_only.list_deployment_executions(_query(event, "environmentId"), workspace_id))
        if method == "GET" and scoped == ["deployments", "pending"]:
            return response(200, container.read_only.list_pending_deployment_executions(workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "deployments":
            return response(200, container.read_only.get_deployment_execution(scoped[1], workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "deployments" and scoped[2] == "cancel":
            return response(200, container.create_deployment.cancel(scoped[1], _auth_context(event, container), workspace_id))
        if method == "POST" and scoped == ["deployments", "plan"]:
            plan_request = _body(event, PlanDeploymentRequest)
            return response(200, container.plan_deployment.execute(
                environment_id=plan_request.environment_id,
                release_id=plan_request.release_id,
                workspace_id=workspace_id,
                force=plan_request.force,
            ))
        if method == "POST" and scoped == ["deployments"]:
            deployment_request = _body(event, CreateDeploymentRequest)
            execution = container.create_deployment.execute(
                environment_id=deployment_request.environment_id,
                release_id=deployment_request.release_id,
                context=_auth_context(event, container),
                workspace_id=workspace_id,
                notes=deployment_request.notes,
                force=deployment_request.force,
                tags=deployment_request.tags,
            )
            return response(200, {"deploymentId": execution.deployment_id, "status": "pending"})
        if method == "GET" and scoped == ["publishers"]:
            return response(200, container.publishers.list(workspace_id))
        if method == "POST" and scoped == ["publishers"]:
            return response(200, container.publishers.create(_body(event, PublisherCreateRequest), _auth_context(event, container), workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "publishers":
            return response(200, container.publishers.get(scoped[1], workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "publishers":
            publisher = _body(event, Publisher).model_copy(update={"workspace_id": workspace_id, "publisher_id": scoped[1]})
            return response(200, container.publishers.put(publisher, _auth_context(event, container), workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "publishers" and scoped[2] == "rotate-token":
            return response(200, container.publishers.rotate_token(scoped[1], _auth_context(event, container), workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "publishers" and scoped[2] == "versions":
            return response(200, container.publishers.publish_version(scoped[1], _body(event, Version), _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["deployment-runners"]:
            return response(200, container.deployment_runners.list(workspace_id))
        if method == "POST" and scoped == ["deployment-runners"]:
            return response(200, container.deployment_runners.create(_body(event, DeploymentRunnerCreateRequest), _auth_context(event, container), workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "deployment-runners":
            return response(200, container.deployment_runners.get(scoped[1], workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "deployment-runners":
            runner = _body(event, DeploymentRunner).model_copy(update={"workspace_id": workspace_id, "runner_id": scoped[1]})
            return response(200, container.deployment_runners.put(runner, _auth_context(event, container), workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "deployment-runners" and scoped[2] == "rotate-token":
            return response(200, container.deployment_runners.rotate_token(scoped[1], _auth_context(event, container), workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "deployment-runners" and scoped[2] == "heartbeat":
            return response(200, container.deployment_runners.heartbeat(scoped[1], _auth_context(event, container), workspace_id))
        if method == "GET" and len(scoped) == 4 and scoped[0] == "deployment-runners" and scoped[2:] == ["executions", "pending"]:
            return response(200, container.deployment_runners.list_pending(scoped[1], workspace_id))
        if method == "GET" and len(scoped) == 4 and scoped[0] == "deployment-runners" and scoped[2:] == ["executions", "items"]:
            return response(200, container.deployment_runners.list_items(scoped[1], workspace_id))
        if (
            method == "POST"
            and len(scoped) == 7
            and scoped[0] == "deployment-runners"
            and scoped[2] == "executions"
            and scoped[4] == "items"
            and scoped[6] == "claim"
        ):
            claim_request = _body(event, ClaimExecutionRequest)
            claim_timeout_seconds = claim_request.claim_timeout_seconds if claim_request.claim_timeout_seconds is not None else claim_request.lease_seconds
            return response(200, container.deployment_runners.claim_item(scoped[1], scoped[3], scoped[5], _auth_context(event, container), claim_timeout_seconds, workspace_id))
        if (
            method == "POST"
            and len(scoped) == 7
            and scoped[0] == "deployment-runners"
            and scoped[2] == "executions"
            and scoped[4] == "items"
            and scoped[6] == "status"
        ):
            item_status_request = _body(event, ReportExecutionItemStatusRequest)
            return response(200, container.deployment_runners.report_item_status(
                runner_id=scoped[1],
                deployment_id=scoped[3],
                component_id=scoped[5],
                status=item_status_request.status,
                reported_action=item_status_request.reported_action,
                context=_auth_context(event, container),
                reported_by=item_status_request.reported_by,
                failure_reason=item_status_request.failure_reason,
                workspace_id=workspace_id,
            ))
        if method == "GET" and scoped == ["roles"]:
            return response(200, container.roles.list(_auth_context(event, container), workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "roles":
            return response(200, container.roles.get(scoped[1], _auth_context(event, container), workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "roles":
            return response(200, container.roles.put(scoped[1], _body(event, Role), _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["webhooks"]:
            return response(200, container.webhooks.list(_auth_context(event, container), workspace_id))
        if method == "POST" and scoped == ["webhooks"]:
            webhook = _body(event, Webhook)
            return response(200, container.webhooks.put(webhook.webhook_id, webhook, _auth_context(event, container), workspace_id))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "webhooks":
            return response(200, container.webhooks.get(scoped[1], _auth_context(event, container), workspace_id))
        if method == "PUT" and len(scoped) == 2 and scoped[0] == "webhooks":
            return response(200, container.webhooks.put(scoped[1], _body(event, Webhook), _auth_context(event, container), workspace_id))
        if method == "GET" and scoped == ["webhook-deliveries"]:
            return response(200, container.webhooks.list_deliveries(
                _auth_context(event, container),
                webhook_id=_query(event, "webhookId"),
                event_id=_query(event, "eventId"),
                status=_query(event, "status"),
                resource_type=_query(event, "resourceType"),
                resource_id=_query(event, "resourceId"),
                workspace_id=workspace_id,
            ))
        if method == "GET" and len(scoped) == 2 and scoped[0] == "webhook-deliveries":
            return response(200, container.webhooks.get_delivery(scoped[1], _auth_context(event, container), workspace_id))
        if method == "POST" and len(scoped) == 3 and scoped[0] == "webhook-deliveries" and scoped[2] == "retry":
            return response(200, container.webhooks.retry_delivery(scoped[1], _auth_context(event, container), workspace_id))

    if method == "GET" and parts == ["events"]:
        context = _auth_context(event, container)
        limit = int(_query(event, "limit") or "50")
        return response(200, container.events.list(
            context,
            limit=limit,
            cursor=_query(event, "cursor"),
            actor_principal_id=_query(event, "actorPrincipalId"),
            resource_type=_query(event, "resourceType"),
            resource_id=_query(event, "resourceId"),
            category=_query(event, "category"),
            action=_query(event, "action"),
            origin=_query(event, "origin"),
            from_time=_query(event, "from"),
            to_time=_query(event, "to"),
        ))
    if method == "GET" and len(parts) == 2 and parts[0] == "events":
        return response(200, container.events.get(_auth_context(event, container), parts[1]))

    raise NotFoundError(f"Route not found: {method} {path}")



