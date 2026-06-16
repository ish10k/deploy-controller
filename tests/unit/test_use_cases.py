import pytest
from src.composition.memory_container import build_memory_container
from src.domain.errors import ConflictError
from src.domain.models import (
    Component,
    DeploymentExecution,
    DeploySet,
    Environment,
    EnvironmentTarget,
    Release,
    TargetResolution,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def seed(store: MemoryRepositories) -> None:
    store.put_component(Component(componentId="api", type="ecs", active=True))
    store.create_release(Release(
        componentId="api",
        version="1.0.0",
        artifactSha256="sha-a",
        createdAt="2026-06-16T12:00:00Z",
        createdBy="ci",
    ))
    store.create_deployset(DeploySet(
        deploySetId="ds-1",
        schemaVersion=1,
        items=[{"componentId": "api", "version": "1.0.0"}],
        createdAt="2026-06-16T12:01:00Z",
        createdBy="ci",
    ))
    store.put_environment(Environment(environmentId="prod", awsAccountId="123", region="eu-west-2"))
    store.put_environment_target(
        EnvironmentTarget(environmentId="prod", componentId="api", type="ecs", targetKey="prod/api")
    )
    store.put_target_resolution(
        TargetResolution(type="ecs", targetKey="prod/api", target={"cluster": "c", "service": "s"})
    )


def test_release_create_is_idempotent_for_same_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    release = Release(
        componentId="api",
        version="1.0.0",
        artifactSha256="sha-a",
        createdAt="2026-06-16T12:00:00Z",
        createdBy="ci",
    )
    container.releases.create(release)
    assert container.releases.create(release) == release


def test_release_create_conflicts_for_different_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    container.releases.create(Release(
        componentId="api",
        version="1.0.0",
        artifactSha256="sha-a",
        createdAt="2026-06-16T12:00:00Z",
        createdBy="ci",
    ))
    with pytest.raises(ConflictError):
        container.releases.create(Release(
            componentId="api",
            version="1.0.0",
            artifactSha256="sha-b",
            createdAt="2026-06-16T12:00:00Z",
            createdBy="ci",
        ))


def test_plan_deployment_produces_deploy_when_no_latest_execution() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="prod", deployset_id="ds-1", require_actual_sha_check=False)

    assert plan.items[0].action == "deploy"
    assert plan.items[0].status == "pending"
    assert plan.items[0].reason == "missing_latest_execution_item"


def test_plan_deployment_can_noop_from_latest_success_when_sha_check_disabled() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(DeploymentExecution(
        deploymentExecutionId="dep-exec-1",
        environmentId="prod",
        deploySetId="ds-1",
        status="planned",
        requestedBy="ishina",
        startedAt="2026-06-16T12:02:00Z",
        items=[{
            "componentId": "api",
            "version": "1.0.0",
            "artifactSha256": "sha-a",
            "action": "noop",
            "status": "succeeded",
        }],
    ))
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="prod", deployset_id="ds-1", require_actual_sha_check=False)

    assert plan.items[0].action == "noop"
    assert plan.items[0].status == "succeeded"


def test_create_deployment_writes_execution_and_environment_state() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        deployset_id="ds-1",
        requested_by="ishina",
        require_actual_sha_check=False,
    )

    assert execution.status == "planned"
    assert store.get_environment_state("prod").last_deployment_execution_id == execution.deployment_execution_id
