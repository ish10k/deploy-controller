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
    DeploymentExecutionItem,
    DeploymentRunner,
    DeploymentRunnerCreateRequest,
    DeploymentRunnerCreateResult,
    DeploymentPlan,
    Environment,
    EnvironmentState,
    EventLogEntry,
    EventLogListResult,
    AuthContext,
    BootstrapState,
    Organization,
    OrganizationMembership,
    Principal,
    Release,
    Publisher,
    PublisherCreateRequest,
    PublisherCreateResult,
    Role,
    RotateTokenResult,
    Webhook,
    WebhookDelivery,
    Workspace,
    WorkspaceMembership,
    WhoAmI,
)
from src.interfaces.fastapi.dependencies import get_auth_context, get_container
from src.interfaces.fastapi.schemas import (
    ClaimExecutionRequest,
    CreateDeploymentRequest,
    CreateDeploymentResponse,
    ErrorResponse,
    PlanDeploymentRequest,
    ReportExecutionItemStatusRequest,
)



def _to_camel_case(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:] if part)


def _generate_operation_id(route: APIRoute) -> str:
    return _to_camel_case(route.name)


router = APIRouter(generate_unique_id_function=_generate_operation_id)
ContainerDep = Annotated[Container, Depends(get_container)]
AuthDep = Annotated[AuthContext, Depends(get_auth_context)]

NOT_FOUND_RESPONSES = {404: {"model": ErrorResponse, "description": "Resource not found"}}
WRITE_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Validation error"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    409: {"model": ErrorResponse, "description": "Conflict"},
}


@router.get(
    "/whoami",
    tags=["Principals"],
    summary="Get the authenticated principal",
    description="Returns the Principal and RBAC permissions resolved from the current OIDC or PAT authentication context.",
    response_model=WhoAmI,
    responses={401: {"model": ErrorResponse, "description": "Authentication required"}},
)
def whoami(context: AuthDep, container: ContainerDep) -> WhoAmI:
    return _handle(lambda: container.principals.whoami(context))


@router.get(
    "/organizations",
    tags=["Organizations"],
    summary="List organizations",
    response_model=list[Organization],
    responses=NOT_FOUND_RESPONSES,
)
def list_organizations(context: AuthDep, container: ContainerDep) -> list[Organization]:
    return _handle(lambda: container.organizations.list(context))


@router.post(
    "/organizations",
    tags=["Organizations"],
    summary="Create an organization",
    response_model=Organization,
    responses=WRITE_RESPONSES,
)
def post_organization(organization: Organization, context: AuthDep, container: ContainerDep) -> Organization:
    return _handle(lambda: container.organizations.put(organization.organization_id, organization, context))


@router.get(
    "/organizations/{organization_id}",
    tags=["Organizations"],
    summary="Get an organization",
    response_model=Organization,
    responses=NOT_FOUND_RESPONSES,
)
def get_organization(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> Organization:
    return _handle(lambda: container.organizations.get(organization_id, context))


@router.put(
    "/organizations/{organization_id}",
    tags=["Organizations"],
    summary="Create or update an organization",
    response_model=Organization,
    responses=WRITE_RESPONSES,
)
def put_organization(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    organization: Organization,
    context: AuthDep,
    container: ContainerDep,
) -> Organization:
    return _handle(lambda: container.organizations.put(organization_id, organization, context))


@router.get(
    "/organizations/{organization_id}/workspaces",
    tags=["Workspaces"],
    summary="List workspaces for an organization",
    response_model=list[Workspace],
    responses=NOT_FOUND_RESPONSES,
)
def list_organization_workspaces(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> list[Workspace]:
    return _handle(lambda: container.organizations.list_workspaces(organization_id, context))


@router.post(
    "/organizations/{organization_id}/workspaces",
    tags=["Workspaces"],
    summary="Create a workspace in an organization",
    response_model=Workspace,
    responses=WRITE_RESPONSES,
)
def post_organization_workspace(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    workspace: Workspace,
    context: AuthDep,
    container: ContainerDep,
) -> Workspace:
    return _handle(lambda: container.organizations.create_workspace(organization_id, workspace, context))


@router.get(
    "/organizations/{organization_id}/memberships",
    tags=["Organizations"],
    summary="List organization memberships",
    response_model=list[OrganizationMembership],
    responses=NOT_FOUND_RESPONSES,
)
def list_organization_memberships(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> list[OrganizationMembership]:
    return _handle(lambda: container.organizations.list_memberships(organization_id, context))


@router.put(
    "/organizations/{organization_id}/memberships/{principal_id}",
    tags=["Organizations"],
    summary="Create or update an organization membership",
    response_model=OrganizationMembership,
    responses=WRITE_RESPONSES,
)
def put_organization_membership(
    organization_id: Annotated[str, Path(description="Organization identifier.")],
    principal_id: Annotated[str, Path(description="Principal identifier.")],
    membership: OrganizationMembership,
    context: AuthDep,
    container: ContainerDep,
) -> OrganizationMembership:
    return _handle(lambda: container.organizations.put_membership(organization_id, principal_id, membership, context))


@router.get(
    "/workspaces/{workspace_id}",
    tags=["Workspaces"],
    summary="Get a workspace",
    response_model=Workspace,
    responses=NOT_FOUND_RESPONSES,
)
def get_workspace(
    workspace_id: Annotated[str, Path(description="Workspace identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> Workspace:
    return _handle(lambda: container.workspaces.get(workspace_id, context))


@router.put(
    "/workspaces/{workspace_id}",
    tags=["Workspaces"],
    summary="Update a workspace",
    response_model=Workspace,
    responses=WRITE_RESPONSES,
)
def put_workspace(
    workspace_id: Annotated[str, Path(description="Workspace identifier.")],
    workspace: Workspace,
    context: AuthDep,
    container: ContainerDep,
) -> Workspace:
    return _handle(lambda: container.workspaces.put(workspace_id, workspace, context))


@router.get(
    "/workspaces/{workspace_id}/memberships",
    tags=["Workspaces"],
    summary="List workspace memberships",
    response_model=list[WorkspaceMembership],
    responses=NOT_FOUND_RESPONSES,
)
def list_workspace_memberships(
    workspace_id: Annotated[str, Path(description="Workspace identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> list[WorkspaceMembership]:
    return _handle(lambda: container.workspaces.list_memberships(workspace_id, context))


@router.get(
    "/workspaces/{workspace_id}/memberships/{principal_id}",
    tags=["Workspaces"],
    summary="Get a workspace membership",
    response_model=WorkspaceMembership,
    responses=NOT_FOUND_RESPONSES,
)
def get_workspace_membership(
    workspace_id: Annotated[str, Path(description="Workspace identifier.")],
    principal_id: Annotated[str, Path(description="Principal identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> WorkspaceMembership:
    return _handle(lambda: container.workspaces.get_membership(workspace_id, principal_id, context))


@router.put(
    "/workspaces/{workspace_id}/memberships/{principal_id}",
    tags=["Workspaces"],
    summary="Create or update a workspace membership",
    response_model=WorkspaceMembership,
    responses=WRITE_RESPONSES,
)
def put_workspace_membership(
    workspace_id: Annotated[str, Path(description="Workspace identifier.")],
    principal_id: Annotated[str, Path(description="Principal identifier.")],
    membership: WorkspaceMembership,
    context: AuthDep,
    container: ContainerDep,
) -> WorkspaceMembership:
    return _handle(lambda: container.workspaces.put_membership(workspace_id, principal_id, membership, context))


@router.get(
    "/bootstrap",
    tags=["Principals"],
    summary="Get bootstrap state",
    description="Returns whether first-user bootstrap has completed.",
    response_model=BootstrapState,
)
def get_bootstrap(container: ContainerDep) -> BootstrapState:
    return _handle(container.principals.bootstrap_state)


@router.get(
    "/principals",
    tags=["Principals"],
    summary="List principals",
    description="Returns all registered human and service principals.",
    response_model=list[Principal],
    responses=NOT_FOUND_RESPONSES,
)
def list_principals(container: ContainerDep) -> list[Principal]:
    return _handle(container.principals.list)


@router.post(
    "/principals",
    tags=["Principals"],
    summary="Create a principal",
    description="Creates a Settle Principal. Human principals use OIDC; service principals use PAT and are normally created by product-object workflows.",
    response_model=Principal,
    responses=WRITE_RESPONSES,
)
def post_principal(principal: Principal, context: AuthDep, container: ContainerDep) -> Principal:
    return _handle(lambda: container.principals.create(principal, context))


@router.get(
    "/principals/{principal_id}",
    tags=["Principals"],
    summary="Get a principal",
    description="Returns a registered principal by ID.",
    response_model=Principal,
    responses=NOT_FOUND_RESPONSES,
)
def get_principal(
    principal_id: Annotated[str, Path(description="Principal identifier.")],
    container: ContainerDep,
) -> Principal:
    return _handle(lambda: container.principals.get(principal_id))


@router.put(
    "/principals/{principal_id}",
    tags=["Principals"],
    summary="Create or update a principal",
    description="Stores a principal under the requested ID while enforcing the active human admin invariant.",
    response_model=Principal,
    responses=WRITE_RESPONSES,
)
def put_principal(
    principal_id: Annotated[str, Path(description="Principal identifier.")],
    principal: Principal,
    context: AuthDep,
    container: ContainerDep,
) -> Principal:
    updated = principal.model_copy(update={"principal_id": principal_id})
    return _handle(lambda: container.principals.put(updated, context))


@router.get(
    "/events",
    tags=["Events"],
    summary="List event log entries",
    description="Returns durable audit events newest-first, optionally filtered by actor, resource, category, action, origin, or time range.",
    response_model=EventLogListResult,
    responses={401: {"model": ErrorResponse, "description": "Authentication required"}, 403: {"model": ErrorResponse, "description": "Permission denied"}},
)
def list_events(
    context: AuthDep,
    container: ContainerDep,
    limit: Annotated[int, Query(description="Maximum event count, clamped to 1-200.")] = 50,
    cursor: Annotated[str | None, Query(description="Pagination cursor returned by a previous call.")] = None,
    actorPrincipalId: Annotated[str | None, Query(description="Actor principal filter.")] = None,
    resourceType: Annotated[str | None, Query(description="Resource type filter.")] = None,
    resourceId: Annotated[str | None, Query(description="Resource ID filter.")] = None,
    category: Annotated[str | None, Query(description="Event category filter.")] = None,
    action: Annotated[str | None, Query(description="Event action filter.")] = None,
    origin: Annotated[str | None, Query(description="Event origin filter.")] = None,
    from_: Annotated[str | None, Query(alias="from", description="Inclusive lower occurredAt bound.")] = None,
    to: Annotated[str | None, Query(description="Inclusive upper occurredAt bound.")] = None,
) -> EventLogListResult:
    return _handle(
        lambda: container.events.list(
            context,
            limit=limit,
            cursor=cursor,
            actor_principal_id=actorPrincipalId,
            resource_type=resourceType,
            resource_id=resourceId,
            category=category,
            action=action,
            origin=origin,
            from_time=from_,
            to_time=to,
        )
    )


@router.get(
    "/events/{event_id}",
    tags=["Events"],
    summary="Get an event log entry",
    description="Returns a single audit event by event ID.",
    response_model=EventLogEntry,
    responses={**NOT_FOUND_RESPONSES, 401: {"model": ErrorResponse, "description": "Authentication required"}, 403: {"model": ErrorResponse, "description": "Permission denied"}},
)
def get_event(
    event_id: Annotated[str, Path(description="Event identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> EventLogEntry:
    return _handle(lambda: container.events.get(context, event_id))


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


@router.get("/workspaces/{workspace_id}/roles", tags=["Roles"], response_model=list[Role], responses=NOT_FOUND_RESPONSES)
def list_workspace_roles(workspace_id: str, context: AuthDep, container: ContainerDep) -> list[Role]:
    return _handle(lambda: container.roles.list(context, workspace_id))


@router.get("/workspaces/{workspace_id}/roles/{role_id}", tags=["Roles"], response_model=Role, responses=NOT_FOUND_RESPONSES)
def get_workspace_role(workspace_id: str, role_id: str, context: AuthDep, container: ContainerDep) -> Role:
    return _handle(lambda: container.roles.get(role_id, context, workspace_id))


@router.put("/workspaces/{workspace_id}/roles/{role_id}", tags=["Roles"], response_model=Role, responses=WRITE_RESPONSES)
def put_workspace_role(workspace_id: str, role_id: str, role: Role, context: AuthDep, container: ContainerDep) -> Role:
    return _handle(lambda: container.roles.put(role_id, role.model_copy(update={"workspace_id": workspace_id}), context, workspace_id))


@router.get("/workspaces/{workspace_id}/webhooks", tags=["Webhooks"], response_model=list[Webhook], responses=NOT_FOUND_RESPONSES)
def list_workspace_webhooks(workspace_id: str, context: AuthDep, container: ContainerDep) -> list[Webhook]:
    return _handle(lambda: container.webhooks.list(context, workspace_id))


@router.post("/workspaces/{workspace_id}/webhooks", tags=["Webhooks"], response_model=Webhook, responses=WRITE_RESPONSES)
def post_workspace_webhook(workspace_id: str, webhook: Webhook, context: AuthDep, container: ContainerDep) -> Webhook:
    return _handle(lambda: container.webhooks.put(webhook.webhook_id, webhook, context, workspace_id))


@router.get("/workspaces/{workspace_id}/webhooks/{webhook_id}", tags=["Webhooks"], response_model=Webhook, responses=NOT_FOUND_RESPONSES)
def get_workspace_webhook(workspace_id: str, webhook_id: str, context: AuthDep, container: ContainerDep) -> Webhook:
    return _handle(lambda: container.webhooks.get(webhook_id, context, workspace_id))


@router.put("/workspaces/{workspace_id}/webhooks/{webhook_id}", tags=["Webhooks"], response_model=Webhook, responses=WRITE_RESPONSES)
def put_workspace_webhook(workspace_id: str, webhook_id: str, webhook: Webhook, context: AuthDep, container: ContainerDep) -> Webhook:
    return _handle(lambda: container.webhooks.put(webhook_id, webhook, context, workspace_id))


@router.get("/workspaces/{workspace_id}/webhook-deliveries", tags=["Webhooks"], response_model=list[WebhookDelivery], responses=NOT_FOUND_RESPONSES)
def list_workspace_webhook_deliveries(
    workspace_id: str,
    context: AuthDep,
    container: ContainerDep,
    webhookId: Annotated[str | None, Query(description="Webhook ID filter.")] = None,
    eventId: Annotated[str | None, Query(description="Event ID filter.")] = None,
    status: Annotated[str | None, Query(description="Delivery status filter.")] = None,
    resourceType: Annotated[str | None, Query(description="Envelope resource type filter.")] = None,
    resourceId: Annotated[str | None, Query(description="Envelope resource ID filter.")] = None,
) -> list[WebhookDelivery]:
    return _handle(
        lambda: container.webhooks.list_deliveries(
            context,
            webhook_id=webhookId,
            event_id=eventId,
            status=status,
            resource_type=resourceType,
            resource_id=resourceId,
            workspace_id=workspace_id,
        )
    )


@router.get("/workspaces/{workspace_id}/webhook-deliveries/{delivery_id}", tags=["Webhooks"], response_model=WebhookDelivery, responses=NOT_FOUND_RESPONSES)
def get_workspace_webhook_delivery(workspace_id: str, delivery_id: str, context: AuthDep, container: ContainerDep) -> WebhookDelivery:
    return _handle(lambda: container.webhooks.get_delivery(delivery_id, context, workspace_id))


@router.post("/workspaces/{workspace_id}/webhook-deliveries/{delivery_id}/retry", tags=["Webhooks"], response_model=WebhookDelivery, responses=WRITE_RESPONSES)
def retry_workspace_webhook_delivery(workspace_id: str, delivery_id: str, context: AuthDep, container: ContainerDep) -> WebhookDelivery:
    return _handle(lambda: container.webhooks.retry_delivery(delivery_id, context, workspace_id))


@router.get("/workspaces/{workspace_id}/components", tags=["Components"], response_model=list[Component], responses=NOT_FOUND_RESPONSES)
def list_workspace_components(workspace_id: str, container: ContainerDep) -> list[Component]:
    return _handle(lambda: container.components.list(workspace_id))


@router.get("/workspaces/{workspace_id}/components/{component_id}", tags=["Components"], response_model=Component, responses=NOT_FOUND_RESPONSES)
def get_workspace_component(workspace_id: str, component_id: str, container: ContainerDep) -> Component:
    return _handle(lambda: container.components.get(component_id, workspace_id))


@router.put("/workspaces/{workspace_id}/components/{component_id}", tags=["Components"], response_model=Component, responses=WRITE_RESPONSES)
def put_workspace_component(workspace_id: str, component_id: str, component: Component, context: AuthDep, container: ContainerDep) -> Component:
    updated = component.model_copy(update={"workspace_id": workspace_id, "component_id": component_id})
    return _handle(lambda: container.components.put(updated, context, workspace_id))


@router.get("/workspaces/{workspace_id}/component-sets", tags=["Components"], response_model=list[ComponentSet], responses=NOT_FOUND_RESPONSES)
def list_workspace_component_sets(workspace_id: str, container: ContainerDep) -> list[ComponentSet]:
    return _handle(lambda: container.component_sets.list(workspace_id))


@router.get("/workspaces/{workspace_id}/component-sets/{component_set_id}", tags=["Components"], response_model=ComponentSet, responses=NOT_FOUND_RESPONSES)
def get_workspace_component_set(workspace_id: str, component_set_id: str, container: ContainerDep) -> ComponentSet:
    return _handle(lambda: container.component_sets.get(component_set_id, workspace_id))


@router.put("/workspaces/{workspace_id}/component-sets/{component_set_id}", tags=["Components"], response_model=ComponentSet, responses=WRITE_RESPONSES)
def put_workspace_component_set(
    workspace_id: str,
    component_set_id: str,
    component_set: ComponentSet,
    context: AuthDep,
    container: ContainerDep,
) -> ComponentSet:
    updated = component_set.model_copy(update={"workspace_id": workspace_id, "component_set_id": component_set_id})
    return _handle(lambda: container.component_sets.put(updated, context, workspace_id))


@router.get("/workspaces/{workspace_id}/releases", tags=["Releases"], response_model=list[Release], responses=NOT_FOUND_RESPONSES)
def list_workspace_releases(
    workspace_id: str,
    container: ContainerDep,
    componentId: Annotated[str | None, Query(description="Optional component ID filter.")] = None,
) -> list[Release]:
    return _handle(lambda: container.releases.list(componentId, workspace_id))


@router.get("/workspaces/{workspace_id}/releases/{component_id}/{version}", tags=["Releases"], response_model=Release, responses=NOT_FOUND_RESPONSES)
def get_workspace_release(workspace_id: str, component_id: str, version: str, container: ContainerDep) -> Release:
    return _handle(lambda: container.releases.get(component_id, version, workspace_id))


@router.post("/workspaces/{workspace_id}/releases", tags=["Releases"], response_model=Release, responses=WRITE_RESPONSES)
def create_workspace_release(workspace_id: str, release: Release, context: AuthDep, container: ContainerDep) -> Release:
    return _handle(lambda: container.releases.create(release, context, workspace_id))


@router.get("/workspaces/{workspace_id}/deploysets", tags=["DeploySets"], response_model=list[DeploySet], responses=NOT_FOUND_RESPONSES)
def list_workspace_deploysets(workspace_id: str, container: ContainerDep) -> list[DeploySet]:
    return _handle(lambda: container.deploysets.list(workspace_id))


@router.get("/workspaces/{workspace_id}/deploysets/{deployset_id}", tags=["DeploySets"], response_model=DeploySet, responses=NOT_FOUND_RESPONSES)
def get_workspace_deployset(workspace_id: str, deployset_id: str, container: ContainerDep) -> DeploySet:
    return _handle(lambda: container.deploysets.get(deployset_id, workspace_id))


@router.post("/workspaces/{workspace_id}/deploysets", tags=["DeploySets"], response_model=DeploySetCreateResult, responses=WRITE_RESPONSES)
def create_workspace_deployset(workspace_id: str, request: DeploySetCreateRequest, context: AuthDep, container: ContainerDep) -> DeploySetCreateResult:
    return _handle(lambda: container.deploysets.create(request, context, workspace_id))


@router.get("/workspaces/{workspace_id}/environments", tags=["Environments"], response_model=list[Environment], responses=NOT_FOUND_RESPONSES)
def list_workspace_environments(workspace_id: str, container: ContainerDep) -> list[Environment]:
    return _handle(lambda: container.environments.list(workspace_id))


@router.get("/workspaces/{workspace_id}/environments/{environment_id}", tags=["Environments"], response_model=Environment, responses=NOT_FOUND_RESPONSES)
def get_workspace_environment(workspace_id: str, environment_id: str, container: ContainerDep) -> Environment:
    return _handle(lambda: container.environments.get(environment_id, workspace_id))


@router.put("/workspaces/{workspace_id}/environments/{environment_id}", tags=["Environments"], response_model=Environment, responses=WRITE_RESPONSES)
def put_workspace_environment(workspace_id: str, environment_id: str, environment: Environment, context: AuthDep, container: ContainerDep) -> Environment:
    updated = environment.model_copy(update={"workspace_id": workspace_id, "environment_id": environment_id})
    return _handle(lambda: container.environments.put(updated, context, workspace_id))


@router.get("/workspaces/{workspace_id}/environment-state", tags=["Environments"], response_model=list[EnvironmentState], responses=NOT_FOUND_RESPONSES)
def list_workspace_environment_states(workspace_id: str, container: ContainerDep) -> list[EnvironmentState]:
    return _handle(lambda: container.read_only.list_environment_states(workspace_id))


@router.get("/workspaces/{workspace_id}/environment-state/{environment_id}", tags=["Environments"], response_model=EnvironmentState, responses=NOT_FOUND_RESPONSES)
def get_workspace_environment_state(workspace_id: str, environment_id: str, container: ContainerDep) -> EnvironmentState:
    return _handle(lambda: container.read_only.get_environment_state(environment_id, workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-executions", tags=["Deployments"], response_model=list[DeploymentExecution], responses=NOT_FOUND_RESPONSES)
def list_workspace_deployment_executions(
    workspace_id: str,
    container: ContainerDep,
    environmentId: Annotated[str | None, Query(description="Optional environment ID filter.")] = None,
) -> list[DeploymentExecution]:
    return _handle(lambda: container.read_only.list_deployment_executions(environmentId, workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-executions/pending", tags=["Deployments"], response_model=list[DeploymentExecution], responses=NOT_FOUND_RESPONSES)
def list_workspace_pending_deployment_executions(workspace_id: str, container: ContainerDep) -> list[DeploymentExecution]:
    return _handle(lambda: container.read_only.list_pending_deployment_executions(workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-executions/{deployment_execution_id}", tags=["Deployments"], response_model=DeploymentExecution, responses=NOT_FOUND_RESPONSES)
def get_workspace_deployment_execution(workspace_id: str, deployment_execution_id: str, container: ContainerDep) -> DeploymentExecution:
    return _handle(lambda: container.read_only.get_deployment_execution(deployment_execution_id, workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-executions/{deployment_execution_id}/cancel", tags=["Deployments"], response_model=DeploymentExecution, responses=WRITE_RESPONSES)
def cancel_workspace_deployment_execution(
    workspace_id: str,
    deployment_execution_id: str,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.create_deployment.cancel(deployment_execution_id, context, workspace_id))


@router.post("/workspaces/{workspace_id}/deployments/plan", tags=["Deployments"], response_model=DeploymentPlan, responses=WRITE_RESPONSES)
def plan_workspace_deployment(workspace_id: str, request: PlanDeploymentRequest, context: AuthDep, container: ContainerDep) -> DeploymentPlan:
    return _handle(lambda: container.plan_deployment.execute(environment_id=request.environment_id, deployset_id=request.deployset_id, workspace_id=workspace_id, force=request.force))


@router.post("/workspaces/{workspace_id}/deployments", tags=["Deployments"], response_model=CreateDeploymentResponse, responses=WRITE_RESPONSES)
def create_workspace_deployment(workspace_id: str, request: CreateDeploymentRequest, context: AuthDep, container: ContainerDep) -> CreateDeploymentResponse:
    return _handle(
        lambda: {
            "deploymentExecutionId": container.create_deployment.execute(
                environment_id=request.environment_id,
                deployset_id=request.deployset_id,
                context=context,
                workspace_id=workspace_id,
                notes=request.notes,
                force=request.force,
                tags=request.tags,
            ).deployment_execution_id,
            "status": "pending",
        }
    )


@router.get("/workspaces/{workspace_id}/deployment-runners", tags=["Deployment Runners"], response_model=list[DeploymentRunner], responses=NOT_FOUND_RESPONSES)
def list_workspace_deployment_runners(workspace_id: str, container: ContainerDep) -> list[DeploymentRunner]:
    return _handle(lambda: container.deployment_runners.list(workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-runners", tags=["Deployment Runners"], response_model=DeploymentRunnerCreateResult, responses=WRITE_RESPONSES)
def post_workspace_deployment_runner(workspace_id: str, request: DeploymentRunnerCreateRequest, context: AuthDep, container: ContainerDep) -> DeploymentRunnerCreateResult:
    return _handle(lambda: container.deployment_runners.create(request, context, workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-runners/{runner_id}", tags=["Deployment Runners"], response_model=DeploymentRunner, responses=NOT_FOUND_RESPONSES)
def get_workspace_deployment_runner(workspace_id: str, runner_id: str, container: ContainerDep) -> DeploymentRunner:
    return _handle(lambda: container.deployment_runners.get(runner_id, workspace_id))


@router.put("/workspaces/{workspace_id}/deployment-runners/{runner_id}", tags=["Deployment Runners"], response_model=DeploymentRunner, responses=WRITE_RESPONSES)
def put_workspace_deployment_runner(workspace_id: str, runner_id: str, runner: DeploymentRunner, context: AuthDep, container: ContainerDep) -> DeploymentRunner:
    updated = runner.model_copy(update={"workspace_id": workspace_id, "runner_id": runner_id})
    return _handle(lambda: container.deployment_runners.put(updated, context, workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-runners/{runner_id}/rotate-token", tags=["Deployment Runners"], response_model=RotateTokenResult, responses=WRITE_RESPONSES)
def rotate_workspace_deployment_runner_token(workspace_id: str, runner_id: str, context: AuthDep, container: ContainerDep) -> RotateTokenResult:
    return _handle(lambda: container.deployment_runners.rotate_token(runner_id, context, workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-runners/{runner_id}/heartbeat", tags=["Deployment Runners"], response_model=DeploymentRunner, responses=WRITE_RESPONSES)
def heartbeat_workspace_deployment_runner(workspace_id: str, runner_id: str, context: AuthDep, container: ContainerDep) -> DeploymentRunner:
    return _handle(lambda: container.deployment_runners.heartbeat(runner_id, context, workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-runners/{runner_id}/executions/pending", tags=["Deployment Runners"], response_model=list[DeploymentExecutionItem], responses=NOT_FOUND_RESPONSES)
def list_workspace_pending_runner_executions(workspace_id: str, runner_id: str, container: ContainerDep) -> list[DeploymentExecutionItem]:
    return _handle(lambda: container.deployment_runners.list_pending(runner_id, workspace_id))


@router.get("/workspaces/{workspace_id}/deployment-runners/{runner_id}/executions/items", tags=["Deployment Runners"], response_model=list[DeploymentExecutionItem], responses=NOT_FOUND_RESPONSES)
def list_workspace_runner_deployment_items(workspace_id: str, runner_id: str, container: ContainerDep) -> list[DeploymentExecutionItem]:
    return _handle(lambda: container.deployment_runners.list_items(runner_id, workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-runners/{runner_id}/executions/{deployment_execution_id}/items/{component_id}/claim", tags=["Deployment Runners"], response_model=DeploymentExecutionItem, responses=WRITE_RESPONSES)
def claim_workspace_runner_execution_item(
    workspace_id: str,
    runner_id: str,
    deployment_execution_id: str,
    component_id: str,
    request: ClaimExecutionRequest,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecutionItem:
    claim_timeout_seconds = request.claim_timeout_seconds if request.claim_timeout_seconds is not None else request.lease_seconds
    return _handle(lambda: container.deployment_runners.claim_item(runner_id, deployment_execution_id, component_id, context, claim_timeout_seconds, workspace_id))


@router.post("/workspaces/{workspace_id}/deployment-runners/{runner_id}/executions/{deployment_execution_id}/items/{component_id}/status", tags=["Deployment Runners"], response_model=DeploymentExecution, responses=WRITE_RESPONSES)
def report_workspace_runner_item_status(
    workspace_id: str,
    runner_id: str,
    deployment_execution_id: str,
    component_id: str,
    request: ReportExecutionItemStatusRequest,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(
        lambda: container.deployment_runners.report_item_status(
            runner_id=runner_id,
            deployment_execution_id=deployment_execution_id,
            component_id=component_id,
            status=request.status,
            reported_action=request.reported_action,
            context=context,
            reported_by=request.reported_by,
            failure_reason=request.failure_reason,
            workspace_id=workspace_id,
        )
    )


@router.get("/workspaces/{workspace_id}/publishers", tags=["Publishers"], response_model=list[Publisher], responses=NOT_FOUND_RESPONSES)
def list_workspace_publishers(workspace_id: str, container: ContainerDep) -> list[Publisher]:
    return _handle(lambda: container.publishers.list(workspace_id))


@router.post("/workspaces/{workspace_id}/publishers", tags=["Publishers"], response_model=PublisherCreateResult, responses=WRITE_RESPONSES)
def post_workspace_publisher(workspace_id: str, request: PublisherCreateRequest, context: AuthDep, container: ContainerDep) -> PublisherCreateResult:
    return _handle(lambda: container.publishers.create(request, context, workspace_id))


@router.get("/workspaces/{workspace_id}/publishers/{publisher_id}", tags=["Publishers"], response_model=Publisher, responses=NOT_FOUND_RESPONSES)
def get_workspace_publisher(workspace_id: str, publisher_id: str, container: ContainerDep) -> Publisher:
    return _handle(lambda: container.publishers.get(publisher_id, workspace_id))


@router.put("/workspaces/{workspace_id}/publishers/{publisher_id}", tags=["Publishers"], response_model=Publisher, responses=WRITE_RESPONSES)
def put_workspace_publisher(
    workspace_id: str,
    publisher_id: str,
    publisher: Publisher,
    context: AuthDep,
    container: ContainerDep,
) -> Publisher:
    updated = publisher.model_copy(update={"workspace_id": workspace_id, "publisher_id": publisher_id})
    return _handle(lambda: container.publishers.put(updated, context, workspace_id))


@router.post("/workspaces/{workspace_id}/publishers/{publisher_id}/rotate-token", tags=["Publishers"], response_model=RotateTokenResult, responses=WRITE_RESPONSES)
def rotate_workspace_publisher_token(workspace_id: str, publisher_id: str, context: AuthDep, container: ContainerDep) -> RotateTokenResult:
    return _handle(lambda: container.publishers.rotate_token(publisher_id, context, workspace_id))


@router.post("/workspaces/{workspace_id}/publishers/{publisher_id}/releases", tags=["Publishers"], response_model=Release, responses=WRITE_RESPONSES)
def publish_workspace_release_from_publisher(
    workspace_id: str,
    publisher_id: str,
    release: Release,
    context: AuthDep,
    container: ContainerDep,
) -> Release:
    return _handle(lambda: container.publishers.publish_release(publisher_id, release, context, workspace_id))
