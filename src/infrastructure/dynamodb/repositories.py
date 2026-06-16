from typing import Any, TypeVar, cast

import boto3  # type: ignore[import-untyped]
from boto3.dynamodb.conditions import Key  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from src.domain.enums import ExecutionStatus
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploySet,
    Environment,
    EnvironmentState,
    Release,
)

T = TypeVar("T")


def _table(name: str) -> Any:
    return boto3.resource("dynamodb").Table(name)


def _dump(model: Any) -> dict[str, Any]:
    return cast(dict[str, Any], model.model_dump(by_alias=True, exclude_none=True, mode="json"))


def _create(table: Any, item: dict[str, Any], condition: str) -> None:
    try:
        table.put_item(Item=item, ConditionExpression=condition)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise ConflictError("Item already exists") from exc
        raise


class DynamoComponentRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, component_id: str) -> Component | None:
        item = self.table.get_item(Key={"componentId": component_id}).get("Item")
        return Component.model_validate(item) if item else None
    def list(self) -> list[Component]:
        return [Component.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, component: Component) -> None:
        self.table.put_item(Item=_dump(component))


class DynamoComponentSetRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, component_set_id: str) -> ComponentSet | None:
        item = self.table.get_item(Key={"componentSetId": component_set_id}).get("Item")
        return ComponentSet.model_validate(item) if item else None
    def list(self) -> list[ComponentSet]:
        return [ComponentSet.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, component_set: ComponentSet) -> None:
        self.table.put_item(Item=_dump(component_set))


class DynamoReleaseRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, component_id: str, version: str) -> Release | None:
        item = self.table.get_item(Key={"componentId": component_id, "version": version}).get("Item")
        return Release.model_validate(item) if item else None
    def create(self, release: Release) -> None:
        _create(self.table, _dump(release), "attribute_not_exists(componentId) AND attribute_not_exists(version)")
    def list_by_component(self, component_id: str | None = None) -> list[Release]:
        if component_id is None:
            items = self.table.scan().get("Items", [])
        else:
            items = self.table.query(KeyConditionExpression=Key("componentId").eq(component_id)).get("Items", [])
        return [Release.model_validate(item) for item in items]


class DynamoDeploySetRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, deployset_id: str) -> DeploySet | None:
        item = self.table.get_item(Key={"deploySetId": deployset_id}).get("Item")
        return DeploySet.model_validate(item) if item else None
    def create(self, deployset: DeploySet) -> None:
        _create(self.table, _dump(deployset), "attribute_not_exists(deploySetId)")
    def list(self) -> list[DeploySet]:
        return [DeploySet.model_validate(item) for item in self.table.scan().get("Items", [])]


class DynamoEnvironmentRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, environment_id: str) -> Environment | None:
        item = self.table.get_item(Key={"environmentId": environment_id}).get("Item")
        return Environment.model_validate(item) if item else None
    def list(self) -> list[Environment]:
        return [Environment.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, environment: Environment) -> None:
        self.table.put_item(Item=_dump(environment))


class DynamoEnvironmentStateRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, environment_id: str) -> EnvironmentState | None:
        item = self.table.get_item(Key={"environmentId": environment_id}).get("Item")
        return EnvironmentState.model_validate(item) if item else None
    def list(self) -> list[EnvironmentState]:
        return [EnvironmentState.model_validate(item) for item in self.table.scan().get("Items", [])]
    def put(self, state: EnvironmentState) -> None:
        self.table.put_item(Item=_dump(state))


class DynamoDeploymentExecutionRepository:
    def __init__(self, table_name: str) -> None:
        self.table = _table(table_name)
    def get(self, deployment_execution_id: str) -> DeploymentExecution | None:
        response = self.table.query(
            IndexName="deploymentExecutionId-index",
            KeyConditionExpression=Key("deploymentExecutionId").eq(deployment_execution_id),
            Limit=1,
        )
        items = response.get("Items", [])
        return DeploymentExecution.model_validate(items[0]) if items else None
    def create(self, execution: DeploymentExecution) -> None:
        item = _dump(execution)
        item["executionSortKey"] = f"{execution.started_at}#{execution.deployment_execution_id}"
        _create(self.table, item, "attribute_not_exists(environmentId) AND attribute_not_exists(executionSortKey)")
    def put(self, execution: DeploymentExecution) -> None:
        item = _dump(execution)
        item["executionSortKey"] = f"{execution.started_at}#{execution.deployment_execution_id}"
        self.table.put_item(Item=item)
    def list_by_environment(self, environment_id: str | None = None) -> list[DeploymentExecution]:
        if environment_id is None:
            items = self.table.scan().get("Items", [])
        else:
            items = self.table.query(
                KeyConditionExpression=Key("environmentId").eq(environment_id),
                ScanIndexForward=False,
            ).get("Items", [])
        return [DeploymentExecution.model_validate(item) for item in items]
    def latest_for_environment(self, environment_id: str) -> DeploymentExecution | None:
        response = self.table.query(
            KeyConditionExpression=Key("environmentId").eq(environment_id),
            ScanIndexForward=False,
            Limit=1,
        )
        items = response.get("Items", [])
        return DeploymentExecution.model_validate(items[0]) if items else None
    def list_pending(self) -> list[DeploymentExecution]:
        items = self.table.scan().get("Items", [])
        return [
            DeploymentExecution.model_validate(item)
            for item in items
            if item.get("status") == ExecutionStatus.PENDING
        ]
