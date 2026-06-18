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
    Principal,
    Release,
    ReleaseSource,
    ReleaseSourceCreateRequest,
    ReleaseSourceCreateResult,
    Role,
    RotateTokenResult,
    Webhook,
    WebhookDelivery,
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
    ReportExecutionStatusRequest,
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
    "/roles",
    tags=["Roles"],
    summary="List roles",
    description="Returns RBAC role definitions and resolved permissions.",
    response_model=list[Role],
    responses=NOT_FOUND_RESPONSES,
)
def list_roles(context: AuthDep, container: ContainerDep) -> list[Role]:
    return _handle(lambda: container.roles.list(context))


@router.get(
    "/roles/{role_id}",
    tags=["Roles"],
    summary="Get a role",
    description="Returns a single RBAC role definition.",
    response_model=Role,
    responses=NOT_FOUND_RESPONSES,
)
def get_role(
    role_id: Annotated[str, Path(description="Role identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> Role:
    return _handle(lambda: container.roles.get(role_id, context))


@router.put(
    "/roles/{role_id}",
    tags=["Roles"],
    summary="Create or update a role",
    description="Stores a role under the requested ID. System-managed roles cannot be modified.",
    response_model=Role,
    responses=WRITE_RESPONSES,
)
def put_role(
    role_id: Annotated[str, Path(description="Role identifier.")],
    role: Role,
    context: AuthDep,
    container: ContainerDep,
) -> Role:
    return _handle(lambda: container.roles.put(role_id, role, context))


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


@router.get(
    "/webhooks",
    tags=["Webhooks"],
    summary="List webhooks",
    description="Returns configured outbound webhook subscribers.",
    response_model=list[Webhook],
    responses={401: {"model": ErrorResponse, "description": "Authentication required"}, 403: {"model": ErrorResponse, "description": "Permission denied"}},
)
def list_webhooks(context: AuthDep, container: ContainerDep) -> list[Webhook]:
    return _handle(lambda: container.webhooks.list(context))


@router.post(
    "/webhooks",
    tags=["Webhooks"],
    summary="Create a webhook",
    description="Creates or stores a webhook subscriber destination.",
    response_model=Webhook,
    responses=WRITE_RESPONSES,
)
def post_webhook(webhook: Webhook, context: AuthDep, container: ContainerDep) -> Webhook:
    return _handle(lambda: container.webhooks.put(webhook.webhook_id, webhook, context))


@router.get(
    "/webhooks/{webhook_id}",
    tags=["Webhooks"],
    summary="Get a webhook",
    description="Returns a webhook subscriber by ID.",
    response_model=Webhook,
    responses=NOT_FOUND_RESPONSES,
)
def get_webhook(
    webhook_id: Annotated[str, Path(description="Webhook identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> Webhook:
    return _handle(lambda: container.webhooks.get(webhook_id, context))


@router.put(
    "/webhooks/{webhook_id}",
    tags=["Webhooks"],
    summary="Create or update a webhook",
    description="Stores a webhook subscriber under the requested ID.",
    response_model=Webhook,
    responses=WRITE_RESPONSES,
)
def put_webhook(
    webhook_id: Annotated[str, Path(description="Webhook identifier.")],
    webhook: Webhook,
    context: AuthDep,
    container: ContainerDep,
) -> Webhook:
    return _handle(lambda: container.webhooks.put(webhook_id, webhook, context))


@router.get(
    "/webhook-deliveries",
    tags=["Webhooks"],
    summary="List webhook deliveries",
    description="Returns outbound webhook delivery attempts and state.",
    response_model=list[WebhookDelivery],
    responses={401: {"model": ErrorResponse, "description": "Authentication required"}, 403: {"model": ErrorResponse, "description": "Permission denied"}},
)
def list_webhook_deliveries(
    context: AuthDep,
    container: ContainerDep,
    webhookId: Annotated[str | None, Query(description="Webhook ID filter.")] = None,
    eventId: Annotated[str | None, Query(description="Event ID filter.")] = None,
    status: Annotated[str | None, Query(description="Delivery status filter.")] = None,
    resourceType: Annotated[str | None, Query(description="Resource type filter.")] = None,
    resourceId: Annotated[str | None, Query(description="Resource ID filter.")] = None,
) -> list[WebhookDelivery]:
    return _handle(
        lambda: container.webhooks.list_deliveries(
            context,
            webhook_id=webhookId,
            event_id=eventId,
            status=status,
            resource_type=resourceType,
            resource_id=resourceId,
        )
    )


@router.get(
    "/webhook-deliveries/{delivery_id}",
    tags=["Webhooks"],
    summary="Get a webhook delivery",
    description="Returns one webhook delivery by ID.",
    response_model=WebhookDelivery,
    responses=NOT_FOUND_RESPONSES,
)
def get_webhook_delivery(
    delivery_id: Annotated[str, Path(description="Webhook delivery identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> WebhookDelivery:
    return _handle(lambda: container.webhooks.get_delivery(delivery_id, context))


@router.post(
    "/webhook-deliveries/{delivery_id}/retry",
    tags=["Webhooks"],
    summary="Retry a webhook delivery",
    description="Retries one failed or pending webhook delivery immediately.",
    response_model=WebhookDelivery,
    responses=WRITE_RESPONSES,
)
def retry_webhook_delivery(
    delivery_id: Annotated[str, Path(description="Webhook delivery identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> WebhookDelivery:
    return _handle(lambda: container.webhooks.retry_delivery(delivery_id, context))


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
    context: AuthDep,
    container: ContainerDep,
) -> Component:
    return _handle(lambda: container.components.put(component.model_copy(update={"component_id": component_id}), context))


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
    context: AuthDep,
    container: ContainerDep,
) -> ComponentSet:
    updated = component_set.model_copy(update={"component_set_id": component_set_id})
    return _handle(lambda: container.component_sets.put(updated, context))


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
def create_release(release: Release, context: AuthDep, container: ContainerDep) -> Release:
    return _handle(lambda: container.releases.create(release, context))


@router.get(
    "/release-sources",
    tags=["Release Sources"],
    summary="List release sources",
    description="Returns all registered external release publishers.",
    response_model=list[ReleaseSource],
    responses=NOT_FOUND_RESPONSES,
)
def list_release_sources(container: ContainerDep) -> list[ReleaseSource]:
    return _handle(container.release_sources.list)


@router.post(
    "/release-sources",
    tags=["Release Sources"],
    summary="Create a release source",
    description="Registers an external release publisher and automatically creates its service principal and PAT.",
    response_model=ReleaseSourceCreateResult,
    responses=WRITE_RESPONSES,
)
def post_release_source(request: ReleaseSourceCreateRequest, context: AuthDep, container: ContainerDep) -> ReleaseSourceCreateResult:
    return _handle(lambda: container.release_sources.create(request, context))


@router.get(
    "/release-sources/{release_source_id}",
    tags=["Release Sources"],
    summary="Get a release source",
    description="Returns a registered release source by ID.",
    response_model=ReleaseSource,
    responses=NOT_FOUND_RESPONSES,
)
def get_release_source(
    release_source_id: Annotated[str, Path(description="Release source identifier.")],
    container: ContainerDep,
) -> ReleaseSource:
    return _handle(lambda: container.release_sources.get(release_source_id))


@router.put(
    "/release-sources/{release_source_id}",
    tags=["Release Sources"],
    summary="Create or update a release source",
    description="Registers or updates an external actor that can publish releases within its scope.",
    response_model=ReleaseSource,
    responses=WRITE_RESPONSES,
)
def put_release_source(
    release_source_id: Annotated[str, Path(description="Release source identifier.")],
    release_source: ReleaseSource,
    context: AuthDep,
    container: ContainerDep,
) -> ReleaseSource:
    updated = release_source.model_copy(update={"release_source_id": release_source_id})
    return _handle(lambda: container.release_sources.put(updated, context))


@router.post(
    "/release-sources/{release_source_id}/rotate-token",
    tags=["Release Sources"],
    summary="Rotate a release source PAT",
    description="Replaces the release source PAT. The previous token stops working immediately.",
    response_model=RotateTokenResult,
    responses=WRITE_RESPONSES,
)
def rotate_release_source_token(
    release_source_id: Annotated[str, Path(description="Release source identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> RotateTokenResult:
    return _handle(lambda: container.release_sources.rotate_token(release_source_id, context))


@router.post(
    "/release-sources/{release_source_id}/releases",
    tags=["Release Sources"],
    summary="Publish a release from a release source",
    description="Creates the same immutable Release object as POST /releases, scoped to a registered release source.",
    response_model=Release,
    responses=WRITE_RESPONSES,
)
def publish_release_from_source(
    release_source_id: Annotated[str, Path(description="Release source identifier.")],
    release: Release,
    context: AuthDep,
    container: ContainerDep,
) -> Release:
    return _handle(lambda: container.release_sources.publish_release(release_source_id, release, context))


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
def create_deployset(request: DeploySetCreateRequest, context: AuthDep, container: ContainerDep) -> DeploySetCreateResult:
    return _handle(lambda: container.deploysets.create(request, context))


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
    context: AuthDep,
    container: ContainerDep,
) -> Environment:
    updated = environment.model_copy(update={"environment_id": environment_id})
    return _handle(lambda: container.environments.put(updated, context))


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
    "/deployment-executions/{deployment_execution_id}/cancel",
    tags=["Deployments"],
    summary="Cancel a deployment execution",
    description="Marks an active deployment execution as cancelled.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def cancel_deployment_execution(
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.create_deployment.cancel(deployment_execution_id, context))


@router.post(
    "/deployments/plan",
    tags=["Deployments"],
    summary="Plan a deployment",
    description="Generates a deployment plan without creating an execution.",
    response_model=DeploymentPlan,
    responses=WRITE_RESPONSES,
)
def plan_deployment(request: PlanDeploymentRequest, context: AuthDep, container: ContainerDep) -> DeploymentPlan:
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
def create_deployment(request: CreateDeploymentRequest, context: AuthDep, container: ContainerDep) -> CreateDeploymentResponse:
    return _handle(
        lambda: {
            "deploymentExecutionId": container.create_deployment.execute(
                environment_id=request.environment_id,
                deployset_id=request.deployset_id,
                context=context,
                notes=request.notes,
                force=request.force,
                tags=request.tags,
            ).deployment_execution_id,
            "status": "pending",
        }
    )


@router.get(
    "/deployment-runners",
    tags=["Deployment Runners"],
    summary="List deployment runners",
    description="Returns all registered external deployment executors.",
    response_model=list[DeploymentRunner],
    responses=NOT_FOUND_RESPONSES,
)
def list_deployment_runners(container: ContainerDep) -> list[DeploymentRunner]:
    return _handle(container.deployment_runners.list)


@router.post(
    "/deployment-runners",
    tags=["Deployment Runners"],
    summary="Create a deployment runner",
    description="Registers an external executor and automatically creates its service principal and PAT.",
    response_model=DeploymentRunnerCreateResult,
    responses=WRITE_RESPONSES,
)
def post_deployment_runner(request: DeploymentRunnerCreateRequest, context: AuthDep, container: ContainerDep) -> DeploymentRunnerCreateResult:
    return _handle(lambda: container.deployment_runners.create(request, context))


@router.get(
    "/deployment-runners/{runner_id}",
    tags=["Deployment Runners"],
    summary="Get a deployment runner",
    description="Returns a registered deployment runner by ID.",
    response_model=DeploymentRunner,
    responses=NOT_FOUND_RESPONSES,
)
def get_deployment_runner(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    container: ContainerDep,
) -> DeploymentRunner:
    return _handle(lambda: container.deployment_runners.get(runner_id))


@router.put(
    "/deployment-runners/{runner_id}",
    tags=["Deployment Runners"],
    summary="Create or update a deployment runner",
    description="Registers or updates an external actor that can claim and report deployment work within its scope.",
    response_model=DeploymentRunner,
    responses=WRITE_RESPONSES,
)
def put_deployment_runner(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    runner: DeploymentRunner,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentRunner:
    updated = runner.model_copy(update={"runner_id": runner_id})
    return _handle(lambda: container.deployment_runners.put(updated, context))


@router.post(
    "/deployment-runners/{runner_id}/rotate-token",
    tags=["Deployment Runners"],
    summary="Rotate a deployment runner PAT",
    description="Replaces the deployment runner PAT. The previous token stops working immediately.",
    response_model=RotateTokenResult,
    responses=WRITE_RESPONSES,
)
def rotate_deployment_runner_token(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> RotateTokenResult:
    return _handle(lambda: container.deployment_runners.rotate_token(runner_id, context))


@router.post(
    "/deployment-runners/{runner_id}/heartbeat",
    tags=["Deployment Runners"],
    summary="Record a deployment runner heartbeat",
    description="Updates the runner heartbeat timestamp.",
    response_model=DeploymentRunner,
    responses=WRITE_RESPONSES,
)
def heartbeat_deployment_runner(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentRunner:
    return _handle(lambda: container.deployment_runners.heartbeat(runner_id, context))


@router.get(
    "/deployment-runners/{runner_id}/executions/pending",
    tags=["Deployment Runners"],
    summary="List pending runner executions",
    description="Returns deployment executions that are in scope and ready to be claimed by a deployment runner.",
    response_model=list[DeploymentExecution],
    responses=NOT_FOUND_RESPONSES,
)
def list_pending_runner_executions(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    container: ContainerDep,
) -> list[DeploymentExecution]:
    return _handle(lambda: container.deployment_runners.list_pending(runner_id))


@router.post(
    "/deployment-runners/{runner_id}/executions/{deployment_execution_id}/claim",
    tags=["Deployment Runners"],
    summary="Claim a deployment execution",
    description="Marks a pending deployment execution as claimed by the deployment runner.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def claim_runner_execution(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    request: ClaimExecutionRequest,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.deployment_runners.claim(runner_id, deployment_execution_id, context, request.lease_seconds))


@router.post(
    "/deployment-runners/{runner_id}/executions/{deployment_execution_id}/items/{component_id}/status",
    tags=["Deployment Runners"],
    summary="Report execution item status",
    description="Updates a single component item status for a deployment execution.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def report_runner_item_status(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    component_id: Annotated[str, Path(description="Component identifier.")],
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
            runner_reason=request.runner_reason,
            message=request.message,
            error=request.error,
        )
    )


@router.post(
    "/deployment-runners/{runner_id}/executions/{deployment_execution_id}/status",
    tags=["Deployment Runners"],
    summary="Report deployment execution status",
    description="Updates the overall status of a deployment execution.",
    response_model=DeploymentExecution,
    responses=WRITE_RESPONSES,
)
def report_runner_execution_status(
    runner_id: Annotated[str, Path(description="Deployment runner identifier.")],
    deployment_execution_id: Annotated[str, Path(description="Deployment execution identifier.")],
    request: ReportExecutionStatusRequest,
    context: AuthDep,
    container: ContainerDep,
) -> DeploymentExecution:
    return _handle(lambda: container.deployment_runners.report_execution_status(runner_id, deployment_execution_id, request.status, context))
