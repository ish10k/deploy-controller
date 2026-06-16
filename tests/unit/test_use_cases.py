import pytest
from src.composition.memory_container import build_memory_container
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploySet,
    Environment,
    Release,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def release(component_id: str, version: str, sha: str) -> Release:
    return Release(
        componentId=component_id,
        version=version,
        artifact={"key": f"{component_id}:{version}", "sha256": sha},
        createdAt="2026-06-16T12:00:00Z",
        createdBy="ci",
    )


def seed(store: MemoryRepositories) -> None:
    store.put_component(Component(componentId="api", type="ecs", active=True))
    store.put_component(Component(componentId="worker", type="lambda", active=True))
    store.put_component_set(
        ComponentSet(
            componentSetId="platform",
            components=[
                {"componentId": "api", "required": True},
                {"componentId": "worker", "required": True},
            ],
            createdAt="2026-06-16T12:00:00Z",
            createdBy="ci",
        )
    )
    store.create_release(release("api", "1.0.0", "sha-api-a"))
    store.create_release(release("api", "2.0.0", "sha-api-b"))
    store.create_release(release("worker", "1.0.0", "sha-worker-a"))
    store.create_deployset(
        DeploySet(
            deploySetId="ds-1",
            componentSetId="platform",
            schemaVersion=1,
            items=[
                {"componentId": "api", "version": "1.0.0"},
                {"componentId": "worker", "version": "1.0.0"},
            ],
            createdAt="2026-06-16T12:01:00Z",
            createdBy="ci",
        )
    )
    store.put_environment(Environment(environmentId="prod", providerHint="aws"))


def test_release_create_is_idempotent_for_same_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    item = release("api", "1.0.0", "sha-a")
    container.releases.create(item)
    assert container.releases.create(item) == item


def test_release_create_conflicts_for_different_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    container.releases.create(release("api", "1.0.0", "sha-a"))
    with pytest.raises(ConflictError):
        container.releases.create(release("api", "1.0.0", "sha-b"))


def test_deployset_create_expands_partial_request_from_base_deployset() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    result = container.deploysets.create(
        {
            "deploySetId": "ds-2",
            "componentSetId": "platform",
            "baseDeploySetId": "ds-1",
            "items": [{"componentId": "api", "version": "2.0.0"}],
            "createdBy": "ishina",
        }
    )

    assert [item.component_id for item in result.deployset.items] == ["api", "worker"]
    assert result.deployset.items[0].source == "explicit"
    assert result.deployset.items[1].version == "1.0.0"
    assert result.deployset.items[1].source == "inferred"
    assert result.warnings


def test_plan_deployment_produces_deploy_when_no_latest_execution() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="prod", deployset_id="ds-1")

    assert plan.items[0].requested_action == "deploy"
    assert plan.items[0].status == "pending"
    assert plan.items[0].requested_reason == "missing_latest_execution_item"


def test_plan_deployment_skips_from_latest_success() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        DeploymentExecution(
            deploymentExecutionId="dep-exec-1",
            environmentId="prod",
            deploySetId="ds-1",
            status="succeeded",
            requestedBy="ishina",
            startedAt="2026-06-16T12:02:00Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": {"key": "api:1.0.0", "sha256": "sha-api-a"},
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
                {
                    "componentId": "worker",
                    "version": "1.0.0",
                    "artifact": {"key": "worker:1.0.0", "sha256": "sha-worker-a"},
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
            ],
        )
    )
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="prod", deployset_id="ds-1")

    assert plan.items[0].requested_action == "skip"
    assert plan.items[0].status == "skipped"


def test_create_deployment_writes_pending_execution_and_environment_state() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(environment_id="prod", deployset_id="ds-1", requested_by="ishina")

    assert execution.status == "pending"
    assert store.get_environment_state("prod").last_deployment_execution_id == execution.deployment_execution_id


def test_adapter_report_flags_possible_drift_on_force_redeploy() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        DeploymentExecution(
            deploymentExecutionId="dep-exec-1",
            environmentId="prod",
            deploySetId="ds-1",
            status="succeeded",
            requestedBy="ishina",
            startedAt="2026-06-16T12:02:00Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": {"key": "api:1.0.0", "sha256": "sha-api-a"},
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
                {
                    "componentId": "worker",
                    "version": "1.0.0",
                    "artifact": {"key": "worker:1.0.0", "sha256": "sha-worker-a"},
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
            ],
        )
    )
    container = build_memory_container(store)
    execution = container.create_deployment.execute(
        environment_id="prod",
        deployset_id="ds-1",
        requested_by="ishina",
        force=True,
    )

    updated = container.adapters.report_item_status(
        deployment_execution_id=execution.deployment_execution_id,
        component_id="api",
        status="succeeded",
        reported_action="deploy",
        reported_by="aws-prod-adapter",
        adapter_reason="artifact_mismatch",
    )

    assert updated.items[0].drift_detected is True
    assert updated.items[0].drift_reason == "same_version_redeployed"
