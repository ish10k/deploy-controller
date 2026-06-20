import re

import pytest
from src.composition.memory_container import build_memory_container
from src.domain.enums import ExecutionStatus, Permission, PrincipalType
from src.domain.errors import ConflictError
from src.domain.models import (
    AuthContext,
    BootstrapState,
    Component,
    ComponentSet,
    DeploymentExecution,
    DeploymentRunner,
    DeploymentRunnerScope,
    DeploySet,
    Environment,
    Principal,
    Release,
    Role,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def artifact(component_id: str, version: str, digest: str) -> dict[str, object]:
    return {
        "key": f"{component_id}:{version}",
        "digest": f"sha256:{digest}",
    }


def admin_context() -> AuthContext:
    return AuthContext(
        principalId="user:test-admin",
        principalType=PrincipalType.USER,
        authMethod="oidc",
        roles=["admin"],
        permissions=list(Permission),
        claims={},
    )


def release(component_id: str, version: str, sha: str) -> Release:
    source_sha = f"src-{sha}" if not sha.startswith("src-") else sha
    return Release(
        componentId=component_id,
        version=version,
        artifact=artifact(component_id, version, sha),
        source={
            "key": f"git+https://git.example.com/{component_id}.git#{version}",
            "digest": f"sha256:{source_sha}",
        },
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
                {"componentId": "api"},
                {"componentId": "worker"},
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
    store.put_environment(Environment(environmentId="prod"))
    store.put_deployment_runner(
        DeploymentRunner(
            runnerId="aws-prod-runner",
            displayName="AWS Prod Runner",
            principalId="service:aws-prod-runner",
            scope=DeploymentRunnerScope(environmentIds=["prod"], componentSetIds=["platform"]),
            createdAt="2026-06-16T12:00:00Z",
            createdBy="ci",
        )
    )


def admin_principal(principal_id: str = "user:admin@example.local") -> Principal:
    return Principal(
        principalId=principal_id,
        type=PrincipalType.USER,
        displayName="Admin User",
        email="admin@example.local",
        authMethod="oidc",
        externalIssuer="http://issuer",
        externalSubject="admin@example.local",
        active=True,
        roles=["admin"],
        tags={},
        createdAt="2026-06-18T12:00:00Z",
        createdBy="system:test",
    )


def test_release_create_is_idempotent_for_same_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    item = release("api", "1.0.0", "sha-a")
    expected = item.model_copy(update={"created_by": admin_context().principal_id})
    container.releases.create(item, admin_context())
    assert container.releases.create(item, admin_context()) == expected


def test_cannot_disable_last_active_admin_user() -> None:
    store = MemoryRepositories()
    store.put_bootstrap_state(BootstrapState(completed=True, completedAt="2026-06-18T12:00:00Z", completedBy="user:admin@example.local"))
    principal = admin_principal()
    store.put_principal(principal)
    container = build_memory_container(store)

    with pytest.raises(ConflictError, match="last active admin"):
        container.principals.put(principal.model_copy(update={"active": False}), admin_context())


def test_admin_role_cannot_be_changed_through_user_management() -> None:
    store = MemoryRepositories()
    store.put_bootstrap_state(BootstrapState(completed=True, completedAt="2026-06-18T12:00:00Z", completedBy="user:admin@example.local"))
    principal = admin_principal()
    store.put_principal(principal)
    store.put_principal(admin_principal("user:other-admin@example.local"))
    container = build_memory_container(store)

    with pytest.raises(ConflictError, match="admin role cannot be changed"):
        container.principals.put(principal.model_copy(update={"roles": ["platform-viewer"]}), admin_context())


def test_roles_are_listed_and_custom_role_permissions_can_be_updated() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)

    roles = container.roles.list(admin_context())
    assert "admin" in {role.role_id for role in roles}

    custom = container.roles.put(
        "release-manager",
        Role(roleId="ignored", description="Release manager", permissions=[Permission.RELEASES_READ]),
        admin_context(),
    )
    assert custom.role_id == "release-manager"
    assert custom.permissions == ["releases:read"]

    updated = container.roles.put(
        "release-manager",
        custom.model_copy(update={"permissions": [Permission.RELEASES_READ, Permission.RELEASES_CREATE]}),
        admin_context(),
    )
    assert updated.permissions == [Permission.RELEASES_READ, Permission.RELEASES_CREATE]


def test_admin_role_permissions_are_system_managed() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)

    with pytest.raises(ConflictError, match="system-managed"):
        container.roles.put("admin", Role(roleId="admin", permissions=[Permission.COMPONENTS_READ]), admin_context())


def test_release_create_conflicts_for_different_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    container.releases.create(release("api", "1.0.0", "sha-a"), admin_context())
    with pytest.raises(ConflictError):
        container.releases.create(release("api", "1.0.0", "sha-b"), admin_context())


def test_deployset_create_expands_partial_request_from_base_deployset() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    result = container.deploysets.create(
        {
            "deploySetId": "ds-2",
            "componentSetId": "platform",
            "baseDeploySetId": "ds-1",
            "notes": "Promote API v2 while inheriting the current worker release.",
            "items": [{"componentId": "api", "version": "2.0.0"}],
            "createdBy": "ishina",
        },
        admin_context(),
    )

    assert [item.component_id for item in result.deployset.items] == ["api", "worker"]
    assert result.deployset.items[0].source == "explicit"
    assert result.deployset.items[1].version == "1.0.0"
    assert result.deployset.items[1].source == "inferred"
    assert result.deployset.notes == "Promote API v2 while inheriting the current worker release."
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
            deploymentExecutionId="abc123ef",
            environmentId="prod",
            deploySetId="ds-1",
            status="succeeded",
            requestedBy="ishina",
            startedAt="2026-06-16T12:02:00Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": artifact("api", "1.0.0", "sha-api-a"),
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
                {
                    "componentId": "worker",
                    "version": "1.0.0",
                    "artifact": artifact("worker", "1.0.0", "sha-worker-a"),
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

    execution = container.create_deployment.execute(
        environment_id="prod",
        deployset_id="ds-1",
        context=admin_context(),
        notes="Approved for rollout after verification in staging.",
    )

    assert execution.status == "pending"
    assert re.fullmatch(r"[0-9a-f]{8}", execution.deployment_execution_id)
    assert execution.notes == "Approved for rollout after verification in staging."
    assert store.get_environment_state("prod").last_deployment_execution_id == execution.deployment_execution_id


def test_runner_warning_is_derived_live_and_ignores_capacity() -> None:
    store = MemoryRepositories()
    seed(store)
    store.put_component(Component(componentId="edge-api", type="bare-metal", active=True))
    store.put_component_set(
        ComponentSet(
            componentSetId="edge-platform",
            components=[{"componentId": "edge-api"}],
            createdAt="2026-06-16T12:00:00Z",
            createdBy="ci",
        )
    )
    store.create_release(release("edge-api", "1.0.0", "sha-edge"))
    store.create_deployset(
        DeploySet(
            deploySetId="edge-ds",
            componentSetId="edge-platform",
            schemaVersion=1,
            items=[{"componentId": "edge-api", "version": "1.0.0"}],
            createdAt="2026-06-16T12:01:00Z",
            createdBy="ci",
        )
    )
    store.put_environment(Environment(environmentId="edge"))
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="edge", deployset_id="edge-ds")
    assert plan.items[0].runner_match_warning is True

    execution = container.create_deployment.execute(environment_id="edge", deployset_id="edge-ds", context=admin_context())
    live = container.read_only.get_deployment_execution(execution.deployment_execution_id)
    assert live.items[0].runner_match_warning is True


def test_runner_warning_stays_false_when_a_match_exists_even_at_capacity() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        deployset_id="ds-1",
        context=admin_context(),
        notes="Capacity should not affect match warnings.",
    )
    container.deployment_runners.claim_item("aws-prod-runner", execution.deployment_execution_id, "api", admin_context())

    live = container.read_only.get_deployment_execution(execution.deployment_execution_id)
    assert all(item.runner_match_warning is False for item in live.items)


def test_create_deployment_marks_environment_state_succeeded_when_plan_is_all_skipped() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        DeploymentExecution(
            deploymentExecutionId="abc123ef",
            environmentId="prod",
            deploySetId="ds-1",
            status="succeeded",
            requestedBy="ishina",
            startedAt="2026-06-16T12:02:00Z",
            completedAt="2026-06-16T12:02:10Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": artifact("api", "1.0.0", "sha-api-a"),
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
                {
                    "componentId": "worker",
                    "version": "1.0.0",
                    "artifact": artifact("worker", "1.0.0", "sha-worker-a"),
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
            ],
        )
    )
    container = build_memory_container(store)

    execution = container.create_deployment.execute(environment_id="prod", deployset_id="ds-1", context=admin_context())

    assert execution.status == "succeeded"
    assert store.get_environment_state("prod").status == ExecutionStatus.SUCCEEDED


def test_create_deployment_rejects_active_execution_for_same_environment_and_component_set() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        DeploymentExecution(
            deploymentExecutionId="busy1234",
            environmentId="prod",
            deploySetId="ds-1",
            status=ExecutionStatus.RUNNING,
            requestedBy="operator",
            startedAt="2026-06-16T12:03:00Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": artifact("api", "1.0.0", "sha-api-a"),
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "in-progress",
                }
            ],
        )
    )
    container = build_memory_container(store)

    with pytest.raises(ConflictError, match="Deployment already in progress"):
        container.create_deployment.execute(environment_id="prod", deployset_id="ds-1", context=admin_context())


def test_cancel_deployment_marks_execution_cancelled() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        deployset_id="ds-1",
        context=admin_context(),
        notes="Cancel me.",
    )

    cancelled = container.create_deployment.cancel(execution.deployment_execution_id, admin_context())

    assert cancelled.status == ExecutionStatus.CANCELLED
    assert cancelled.completed_at is not None
    assert store.get_environment_state("prod").status == ExecutionStatus.CANCELLED


def test_runner_report_flags_possible_drift_on_force_redeploy() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        DeploymentExecution(
            deploymentExecutionId="abc123ef",
            environmentId="prod",
            deploySetId="ds-1",
            status="succeeded",
            requestedBy="ishina",
            startedAt="2026-06-16T12:02:00Z",
            items=[
                {
                    "componentId": "api",
                    "version": "1.0.0",
                    "artifact": artifact("api", "1.0.0", "sha-api-a"),
                    "requestedAction": "deploy",
                    "reportedAction": "deploy",
                    "status": "succeeded",
                },
                {
                    "componentId": "worker",
                    "version": "1.0.0",
                    "artifact": artifact("worker", "1.0.0", "sha-worker-a"),
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
        context=admin_context(),
        force=True,
    )

    claimed = container.deployment_runners.claim_item(
        "aws-prod-runner",
        execution.deployment_execution_id,
        "api",
        admin_context(),
    )

    updated = container.deployment_runners.report_item_status(
        runner_id="aws-prod-runner",
        deployment_execution_id=execution.deployment_execution_id,
        component_id="api",
        status="succeeded",
        reported_action="deploy",
        context=admin_context(),
        reported_by="aws-prod-runner",
        failure_reason="artifact_mismatch",
    )

    assert claimed.claimed_by == "aws-prod-runner"
    assert updated.items[0].drift_detected is True
    assert updated.items[0].drift_reason == "same_version_redeployed"
