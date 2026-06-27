from typing import Any, TypeVar, cast

import boto3  # type: ignore[import-untyped]
from boto3.dynamodb.conditions import Key  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from src.domain.enums import ExecutionStatus
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    Release,
    Deployment,
    DeploymentRunner,
    Environment,
    EnvironmentState,
    EventLogEntry,
    BootstrapState,
    Organization,
    OrganizationMembership,
    Principal,
    ComponentVersion,
    Publisher,
    Role,
    TagDefinition,
    Workspace,
    WorkspaceMembership,
    Webhook,
    WebhookDelivery,
)

T = TypeVar("T")


def _table(name: str) -> Any:
    return boto3.resource("dynamodb").Table(name)


def _dump(model: Any) -> dict[str, Any]:
    return cast(dict[str, Any], _strip_transient_fields(model.model_dump(by_alias=True, exclude_none=True, mode="json")))


def _strip_transient_fields(value: Any) -> Any:
    if isinstance(value, list):
        return [_strip_transient_fields(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _strip_transient_fields(item)
            for key, item in value.items()
            if key != "runnerMatchWarning"
        }
    return value


def _create(table: Any, item: dict[str, Any], condition: str) -> None:
    try:
        table.put_item(Item=item, ConditionExpression=condition)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise ConflictError("Item already exists") from exc
        raise


class DynamoOrganizationRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, organization_id: str) -> Organization | None:
        item = self.table.get_item(Key={"organizationId": organization_id}).get("Item")
        return Organization.model_validate(item) if item else None
    def list(self) -> list[Organization]:
        return [Organization.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, organization: Organization) -> None:
        self.table.put_item(Item=_dump(organization))


class DynamoWorkspaceRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, workspace_id: str) -> Workspace | None:
        item = self.table.get_item(Key={"workspaceId": workspace_id}).get("Item")
        return Workspace.model_validate(item) if item else None
    def list(self, organization_id: str | None = None) -> list[Workspace]:
        items = self.table.scan().get("Items", [])
        if organization_id:
            items = [item for item in items if item.get("organizationId") == organization_id]
        return [Workspace.model_validate(item) for item in items]
    def put(self, workspace: Workspace) -> None:
        self.table.put_item(Item=_dump(workspace))


class DynamoTagDefinitionRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, key: str, workspace_id: str = "default") -> TagDefinition | None:
        item = self.table.get_item(Key={"workspaceId": workspace_id, "key": key}).get("Item")
        return TagDefinition.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[TagDefinition]:
        return sorted(
            (TagDefinition.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id),
            key=lambda item: item.key,
        )
    def put(self, tag_definition: TagDefinition) -> None:
        self.table.put_item(Item=_dump(tag_definition))


class DynamoOrganizationMembershipRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, organization_id: str, principal_id: str) -> OrganizationMembership | None:
        item = self.table.get_item(Key={"organizationId": organization_id, "principalId": principal_id}).get("Item")
        return OrganizationMembership.model_validate(item) if item else None
    def list(self, organization_id: str | None = None, principal_id: str | None = None) -> list[OrganizationMembership]:
        items = self.table.scan().get("Items", [])
        if organization_id:
            items = [item for item in items if item.get("organizationId") == organization_id]
        if principal_id:
            items = [item for item in items if item.get("principalId") == principal_id]
        return [OrganizationMembership.model_validate(item) for item in items]
    def put(self, membership: OrganizationMembership) -> None:
        self.table.put_item(Item=_dump(membership))


class DynamoWorkspaceMembershipRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, workspace_id: str, principal_id: str) -> WorkspaceMembership | None:
        item = self.table.get_item(Key={"workspaceId": workspace_id, "principalId": principal_id}).get("Item")
        return WorkspaceMembership.model_validate(item) if item else None
    def list(self, workspace_id: str | None = None, principal_id: str | None = None) -> list[WorkspaceMembership]:
        items = self.table.scan().get("Items", [])
        if workspace_id:
            items = [item for item in items if item.get("workspaceId") == workspace_id]
        if principal_id:
            items = [item for item in items if item.get("principalId") == principal_id]
        return [WorkspaceMembership.model_validate(item) for item in items]
    def put(self, membership: WorkspaceMembership) -> None:
        self.table.put_item(Item=_dump(membership))


class DynamoComponentRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, component_id: str, workspace_id: str = "default") -> Component | None:
        item = self.table.get_item(Key={"componentId": component_id}).get("Item")
        return Component.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[Component]:
        return [Component.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, component: Component) -> None:
        self.table.put_item(Item=_dump(component))


class DynamoReleaseRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, release_id: str, workspace_id: str = "default") -> Release | None:
        item = self.table.get_item(Key={"releaseId": release_id}).get("Item")
        return Release.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[Release]:
        return [Release.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, release: Release) -> None:
        self.table.put_item(Item=_dump(release))


class DynamoComponentVersionRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, component_id: str, version: str, workspace_id: str = "default") -> ComponentVersion | None:
        item = self.table.get_item(Key={"componentId": component_id, "version": version}).get("Item")
        return ComponentVersion.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def create(self, component_version: ComponentVersion) -> None:
        _create(self.table, _dump(component_version), "attribute_not_exists(componentId) AND attribute_not_exists(version)")
    def list_by_component(self, component_id: str | None = None, workspace_id: str = "default") -> list[ComponentVersion]:
        if component_id is None:
            items = self.table.scan().get("Items", [])
        else:
            items = self.table.query(KeyConditionExpression=Key("componentId").eq(component_id)).get("Items", [])
        return [ComponentVersion.model_validate(item) for item in items if item.get("workspaceId", "default") == workspace_id]


class DynamoPublisherRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, publisher_id: str, workspace_id: str = "default") -> Publisher | None:
        item = self.table.get_item(Key={"publisherId": publisher_id}).get("Item")
        return Publisher.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[Publisher]:
        return [Publisher.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, publisher: Publisher) -> None:
        self.table.put_item(Item=_dump(publisher))


class DynamoReleaseRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, release_id: str, workspace_id: str = "default") -> Release | None:
        item = self.table.get_item(Key={"releaseId": release_id}).get("Item")
        return Release.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def create(self, release: Release) -> None:
        _create(self.table, _dump(release), "attribute_not_exists(releaseId)")
    def list(self, workspace_id: str = "default") -> list[Release]:
        return [Release.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]


class DynamoEnvironmentRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, environment_id: str, workspace_id: str = "default") -> Environment | None:
        item = self.table.get_item(Key={"environmentId": environment_id}).get("Item")
        return Environment.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[Environment]:
        return [Environment.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, environment: Environment) -> None:
        self.table.put_item(Item=_dump(environment))


class DynamoDeploymentRunnerRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, runner_id: str, workspace_id: str = "default") -> DeploymentRunner | None:
        item = self.table.get_item(Key={"runnerId": runner_id}).get("Item")
        return DeploymentRunner.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[DeploymentRunner]:
        return [DeploymentRunner.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, runner: DeploymentRunner) -> None:
        self.table.put_item(Item=_dump(runner))


class DynamoPrincipalRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, principal_id: str) -> Principal | None:
        item = self.table.get_item(Key={"principalId": principal_id}).get("Item")
        return Principal.model_validate(item) if item else None
    def get_by_oidc(self, external_issuer: str, external_subject: str) -> Principal | None:
        items = self.table.scan().get("Items", [])
        for item in items:
            if (
                item.get("type") == "user"
                and item.get("externalIssuer") == external_issuer
                and item.get("externalSubject") == external_subject
            ):
                return Principal.model_validate(item)
        return None
    def list(self) -> list[Principal]:
        return [Principal.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, principal: Principal) -> None:
        self.table.put_item(Item=_dump(principal))


class DynamoRoleRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, role_id: str, workspace_id: str = "default") -> Role | None:
        item = self.table.get_item(Key={"roleId": role_id}).get("Item")
        return Role.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[Role]:
        return [Role.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, role: Role) -> None:
        self.table.put_item(Item=_dump(role))


class DynamoBootstrapStateRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self) -> BootstrapState:
        item = self.table.get_item(Key={"id": "bootstrap"}).get("Item")
        return BootstrapState.model_validate(item) if item else BootstrapState()
    def put(self, state: BootstrapState) -> None:
        item = _dump(state)
        item["id"] = "bootstrap"
        self.table.put_item(Item=item)


class DynamoEnvironmentStateRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, environment_id: str, workspace_id: str = "default") -> EnvironmentState | None:
        item = self.table.get_item(Key={"environmentId": environment_id}).get("Item")
        return EnvironmentState.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def list(self, workspace_id: str = "default") -> list[EnvironmentState]:
        return [EnvironmentState.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
    def put(self, state: EnvironmentState) -> None:
        self.table.put_item(Item=_dump(state))


class DynamoDeploymentRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, deployment_id: str, workspace_id: str = "default") -> Deployment | None:
        response = self.table.query(
            IndexName="deploymentId-index",
            KeyConditionExpression=Key("deploymentId").eq(deployment_id),
            Limit=1,
        )
        items = response.get("Items", [])
        item = items[0] if items else None
        return Deployment.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None
    def create(self, execution: Deployment) -> None:
        item = _dump(execution)
        item["executionSortKey"] = f"{execution.started_at}#{execution.deployment_id}"
        _create(self.table, item, "attribute_not_exists(environmentId) AND attribute_not_exists(executionSortKey)")
    def put(self, execution: Deployment) -> None:
        item = _dump(execution)
        item["executionSortKey"] = f"{execution.started_at}#{execution.deployment_id}"
        self.table.put_item(Item=item)
    def list_by_environment(self, environment_id: str | None = None, workspace_id: str = "default") -> list[Deployment]:
        if environment_id is None:
            items = self.table.scan().get("Items", [])
        else:
            items = self.table.query(
                KeyConditionExpression=Key("environmentId").eq(environment_id),
                ScanIndexForward=False,
            ).get("Items", [])
        return [Deployment.model_validate(item) for item in items if item.get("workspaceId", "default") == workspace_id]
    def latest_for_environment(self, environment_id: str, workspace_id: str = "default") -> Deployment | None:
        response = self.table.query(
            KeyConditionExpression=Key("environmentId").eq(environment_id),
            ScanIndexForward=False,
            Limit=1,
        )
        items = response.get("Items", [])
        items = [item for item in items if item.get("workspaceId", "default") == workspace_id]
        return Deployment.model_validate(items[0]) if items else None
    def list_pending(self, workspace_id: str = "default") -> list[Deployment]:
        items = self.table.scan().get("Items", [])
        return [
            Deployment.model_validate(item)
            for item in items
            if item.get("status") in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING} and item.get("workspaceId", "default") == workspace_id
        ]


class DynamoEventLogRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)

    def append(self, event: EventLogEntry) -> None:
        item = _dump(event)
        item["eventBucket"] = "events"
        item["occurredAtEventId"] = f"{event.occurred_at}#{event.event_id}"
        item["resourceKey"] = f"{event.resource_type}#{event.resource_id}"
        self.table.put_item(Item=item, ConditionExpression="attribute_not_exists(eventId)")

    def get(self, event_id: str) -> EventLogEntry | None:
        response = self.table.query(
            IndexName="eventId-index",
            KeyConditionExpression=Key("eventId").eq(event_id),
            Limit=1,
        )
        items = response.get("Items", [])
        return EventLogEntry.model_validate(items[0]) if items else None

    def list(
        self,
        *,
        limit: int = 50,
        cursor: str | None = None,
        actor_principal_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        category: str | None = None,
        action: str | None = None,
        origin: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
    ) -> tuple[list[EventLogEntry], str | None]:
        if resource_type and resource_id:
            items = self.table.query(
                IndexName="resourceKey-index",
                KeyConditionExpression=Key("resourceKey").eq(f"{resource_type}#{resource_id}"),
                ScanIndexForward=False,
            ).get("Items", [])
        elif actor_principal_id:
            items = self.table.query(
                IndexName="actorPrincipalId-index",
                KeyConditionExpression=Key("actorPrincipalId").eq(actor_principal_id),
                ScanIndexForward=False,
            ).get("Items", [])
        else:
            items = self.table.query(
                KeyConditionExpression=Key("eventBucket").eq("events"),
                ScanIndexForward=False,
            ).get("Items", [])

        events = [EventLogEntry.model_validate(item) for item in items]
        if actor_principal_id:
            events = [event for event in events if event.actor_principal_id == actor_principal_id]
        if resource_type:
            events = [event for event in events if event.resource_type == resource_type]
        if resource_id:
            events = [event for event in events if event.resource_id == resource_id]
        if category:
            events = [event for event in events if event.category == category]
        if action:
            events = [event for event in events if event.action == action]
        if origin:
            events = [event for event in events if event.origin == origin]
        if from_time:
            events = [event for event in events if event.occurred_at >= from_time]
        if to_time:
            events = [event for event in events if event.occurred_at <= to_time]

        events = sorted(events, key=lambda item: (item.occurred_at, item.event_id), reverse=True)
        start = int(cursor) if cursor else 0
        window = events[start:start + limit]
        next_cursor = str(start + limit) if start + limit < len(events) else None
        return window, next_cursor


class DynamoWebhookRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)

    def get(self, webhook_id: str, workspace_id: str = "default") -> Webhook | None:
        item = self.table.get_item(Key={"webhookId": webhook_id}).get("Item")
        return Webhook.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None

    def list(self, workspace_id: str = "default") -> list[Webhook]:
        return [Webhook.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]

    def put(self, webhook: Webhook) -> None:
        self.table.put_item(Item=_dump(webhook))


class DynamoWebhookDeliveryRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)

    def get(self, webhook_delivery_id: str, workspace_id: str = "default") -> WebhookDelivery | None:
        item = self.table.get_item(Key={"webhookDeliveryId": webhook_delivery_id}).get("Item")
        return WebhookDelivery.model_validate(item) if item and item.get("workspaceId", "default") == workspace_id else None

    def list(
        self,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        workspace_id: str = "default",
    ) -> list[WebhookDelivery]:
        deliveries = [WebhookDelivery.model_validate(item) for item in self.table.scan().get("Items", []) if item.get("workspaceId", "default") == workspace_id]
        if webhook_id:
            deliveries = [delivery for delivery in deliveries if delivery.webhook_id == webhook_id]
        if event_id:
            deliveries = [delivery for delivery in deliveries if delivery.event_id == event_id]
        if status:
            deliveries = [delivery for delivery in deliveries if delivery.status == status]
        if resource_type:
            deliveries = [delivery for delivery in deliveries if delivery.envelope.resource.type == resource_type]
        if resource_id:
            deliveries = [delivery for delivery in deliveries if delivery.envelope.resource.id == resource_id]
        return sorted(deliveries, key=lambda item: (item.created_at, item.webhook_delivery_id), reverse=True)

    def put(self, delivery: WebhookDelivery) -> None:
        self.table.put_item(Item=_dump(delivery))


