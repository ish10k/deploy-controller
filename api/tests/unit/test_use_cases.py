import re

import pytest
from src.composition.memory_container import build_memory_container
from src.domain.enums import ExecutionStatus, Permission, PrincipalType
from src.domain.errors import ConflictError
from src.domain.models import (
    AuthContext,
    BootstrapState,
    Component,
    Release,
    Deployment,
    DeploymentRunner,
    DeploymentRunnerScope,
    Release,
    Environment,
    Principal,
    Version,
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


def version(component_id: str, version: str, sha: str) -> Version:
    source_sha = f"src-{sha}" if not sha.startswith("src-") else sha
    return Version(
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
    store.create_version(version("api", "1.0.0", "sha-api-a"))
    store.create_version(version("api", "2.0.0", "sha-api-b"))
    store.create_version(version("worker", "1.0.0", "sha-worker-a"))
    store.create_release(
        Release(
            releaseId="platform",
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
            scope=DeploymentRunnerScope(environmentIds=["prod"], componentIds=["api", "worker"]),
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


def test_version_create_is_idempotent_for_same_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    item = version("api", "1.0.0", "sha-a")
    expected = item.model_copy(update={"created_by": admin_context().principal_id})
    container.versions.create(item, admin_context())
    assert container.versions.create(item, admin_context()) == expected


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
        "version-manager",
        Role(roleId="ignored", description="Version manager", permissions=[Permission.VERSIONS_READ]),
        admin_context(),
    )
    assert custom.role_id == "version-manager"
    assert custom.permissions == ["versions:read"]

    updated = container.roles.put(
        "version-manager",
        custom.model_copy(update={"permissions": [Permission.VERSIONS_READ, Permission.VERSIONS_CREATE]}),
        admin_context(),
    )
    assert updated.permissions == [Permission.VERSIONS_READ, Permission.VERSIONS_CREATE]


def test_admin_role_permissions_are_system_managed() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)

    with pytest.raises(ConflictError, match="system-managed"):
        container.roles.put("admin", Role(roleId="admin", permissions=[Permission.COMPONENTS_READ]), admin_context())


def test_version_create_conflicts_for_different_content() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    container.versions.create(version("api", "1.0.0", "sha-a"), admin_context())
    with pytest.raises(ConflictError):
        container.versions.create(version("api", "1.0.0", "sha-b"), admin_context())


def test_release_create_expands_partial_request_from_base_release() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    result = container.releases.create(
        {
            "releaseId": "platform-v2",
            "baseReleaseId": "platform",
            "notes": "Promote API v2 while inheriting the current worker version.",
            "items": [{"componentId": "api", "version": "2.0.0"}],
            "createdBy": "ishina",
        },
        admin_context(),
    )

    assert [item.component_id for item in result.release.items] == ["api", "worker"]
    assert result.release.items[0].source == "explicit"
    assert result.release.items[1].version == "1.0.0"
    assert result.release.items[1].source == "inferred"
    assert result.release.notes == "Promote API v2 while inheriting the current worker version."
    assert result.warnings


def test_plan_deployment_produces_deploy_when_no_latest_execution() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="prod", release_id="platform")

    assert plan.items[0].requested_action == "deploy"
    assert plan.items[0].status == "pending"
    assert plan.items[0].requested_reason == "missing_latest_execution_item"


def test_plan_deployment_skips_from_latest_success() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        Deployment(
            deploymentId="abc123ef",
            environmentId="prod",
            releaseId="platform",
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

    plan = container.plan_deployment.execute(environment_id="prod", release_id="platform")

    assert plan.items[0].requested_action == "skip"
    assert plan.items[0].status == "skipped"


def test_create_deployment_writes_pending_execution_and_environment_state() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        release_id="platform",
        context=admin_context(),
        notes="Approved for rollout after verification in staging.",
    )

    assert execution.status == "pending"
    assert re.fullmatch(r"[0-9a-f]{8}", execution.deployment_id)
    assert execution.notes == "Approved for rollout after verification in staging."
    assert store.get_environment_state("prod").last_deployment_id == execution.deployment_id


def test_runner_warning_is_derived_live_and_ignores_capacity() -> None:
    store = MemoryRepositories()
    seed(store)
    store.put_component(Component(componentId="edge-api", type="bare-metal", active=True))
    store.create_version(version("edge-api", "1.0.0", "sha-edge"))
    store.create_release(
        Release(
            releaseId="edge-platform",
            schemaVersion=1,
            items=[{"componentId": "edge-api", "version": "1.0.0"}],
            createdAt="2026-06-16T12:01:00Z",
            createdBy="ci",
        )
    )
    store.put_environment(Environment(environmentId="edge"))
    container = build_memory_container(store)

    plan = container.plan_deployment.execute(environment_id="edge", release_id="edge-platform")
    assert plan.items[0].runner_match_warning is True

    execution = container.create_deployment.execute(environment_id="edge", release_id="edge-platform", context=admin_context())
    live = container.read_only.get_deployment_execution(execution.deployment_id)
    assert live.items[0].runner_match_warning is True


def test_runner_warning_stays_false_when_a_match_exists_even_at_capacity() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        release_id="platform",
        context=admin_context(),
        notes="Capacity should not affect match warnings.",
    )
    container.deployment_runners.claim_item("aws-prod-runner", execution.deployment_id, "api", admin_context())

    live = container.read_only.get_deployment_execution(execution.deployment_id)
    assert all(item.runner_match_warning is False for item in live.items)


def test_create_deployment_marks_environment_state_succeeded_when_plan_is_all_skipped() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        Deployment(
            deploymentId="abc123ef",
            environmentId="prod",
            releaseId="platform",
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

    execution = container.create_deployment.execute(environment_id="prod", release_id="platform", context=admin_context())

    assert execution.status == "succeeded"
    assert store.get_environment_state("prod").status == ExecutionStatus.SUCCEEDED


def test_create_deployment_rejects_active_execution_for_same_environment_and_release() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        Deployment(
            deploymentId="busy1234",
            environmentId="prod",
            releaseId="platform",
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
        container.create_deployment.execute(environment_id="prod", release_id="platform", context=admin_context())


def test_cancel_deployment_marks_execution_cancelled() -> None:
    store = MemoryRepositories()
    seed(store)
    container = build_memory_container(store)

    execution = container.create_deployment.execute(
        environment_id="prod",
        release_id="platform",
        context=admin_context(),
        notes="Cancel me.",
    )

    cancelled = container.create_deployment.cancel(execution.deployment_id, admin_context())

    assert cancelled.status == ExecutionStatus.CANCELLED
    assert cancelled.completed_at is not None
    assert store.get_environment_state("prod").status == ExecutionStatus.CANCELLED


def test_runner_report_flags_possible_drift_on_force_redeploy() -> None:
    store = MemoryRepositories()
    seed(store)
    store.create_deployment_execution(
        Deployment(
            deploymentId="abc123ef",
            environmentId="prod",
            releaseId="platform",
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
        release_id="platform",
        context=admin_context(),
        force=True,
    )

    claimed = container.deployment_runners.claim_item(
        "aws-prod-runner",
        execution.deployment_id,
        "api",
        admin_context(),
    )

    updated = container.deployment_runners.report_item_status(
        runner_id="aws-prod-runner",
        deployment_id=execution.deployment_id,
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








