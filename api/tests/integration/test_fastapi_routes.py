import re

from fastapi.testclient import TestClient
from src.domain.enums import Permission, PrincipalType
from src.domain.models import AuthContext
from src.interfaces.fastapi.app import app
from src.interfaces.fastapi.dependencies import get_auth_context, get_container

WORKSPACE = "/workspaces/default"


def admin_context() -> AuthContext:
    return AuthContext(
        principalId="user:test-admin",
        principalType=PrincipalType.USER,
        authMethod="oidc",
        roles=["admin"],
        permissions=list(Permission),
        claims={},
    )


def client() -> TestClient:
    get_container.cache_clear()
    app.dependency_overrides[get_auth_context] = admin_context
    return TestClient(app)


def test_fastapi_component_round_trip() -> None:
    client_instance = client()

    response = client_instance.put(f"{WORKSPACE}/components/api", json={"componentId": "ignored", "type": "ecs", "active": True})
    assert response.status_code == 200
    assert response.json()["componentId"] == "api"

    response = client_instance.get(f"{WORKSPACE}/components/api")
    assert response.status_code == 200
    assert response.json()["type"] == "ecs"


def test_fastapi_organization_workspace_and_scoped_components() -> None:
    client_instance = client()

    response = client_instance.get("/organizations")
    assert response.status_code == 200
    assert response.json()[0]["organizationId"] == "default"

    response = client_instance.post(
        "/organizations/default/workspaces",
        json={
            "workspaceId": "tenant-a",
            "organizationId": "ignored",
            "displayName": "Tenant A",
            "active": True,
            "tags": {"team": "a"},
            "createdAt": "2026-06-18T12:00:00Z",
            "createdBy": "ignored",
        },
    )
    assert response.status_code == 200
    assert response.json()["organizationId"] == "default"

    response = client_instance.put(
        "/workspaces/tenant-a/components/api",
        json={"componentId": "ignored", "type": "lambda", "active": True},
    )
    assert response.status_code == 200
    assert response.json()["workspaceId"] == "tenant-a"

    response = client_instance.get("/workspaces/tenant-a/components/api")
    assert response.status_code == 200
    assert response.json()["type"] == "lambda"

    response = client_instance.get("/components/api")
    assert response.status_code == 404


def test_fastapi_whoami_includes_memberships() -> None:
    client_instance = client()

    response = client_instance.post(
        "/principals",
        json={
            "principalId": "user:test-admin",
            "type": "user",
            "displayName": "Test Admin",
            "email": "test-admin@example.local",
            "authMethod": "oidc",
            "externalIssuer": "https://issuer.example",
            "externalSubject": "test-admin",
            "active": True,
            "roles": ["platform-viewer"],
            "tags": {},
            "createdAt": "2026-06-18T12:00:00Z",
            "createdBy": "system:test",
        },
    )
    assert response.status_code == 200

    response = client_instance.get("/whoami")
    assert response.status_code == 200
    assert response.json()["organizations"] == []

    membership = {
        "workspaceId": "default",
        "principalId": "user:test-admin",
        "roles": ["workspace-admin"],
        "active": True,
        "createdAt": "2026-06-18T12:00:00Z",
        "createdBy": "user:test-admin",
    }
    response = client_instance.put("/workspaces/default/memberships/user:test-admin", json=membership)
    assert response.status_code == 200

    response = client_instance.get("/whoami")
    assert response.status_code == 200
    assert response.json()["workspaces"][0]["workspaceId"] == "default"


def test_fastapi_release_and_deployment_notes_round_trip() -> None:
    client_instance = client()

    release_response = client_instance.post(
        f"{WORKSPACE}/releases",
        json={
            "componentId": "api",
            "version": "9.9.9",
            "description": "API release 9.9.9",
            "notes": "Built from commit abc123 and approved by platform.",
            "artifact": {"key": "api:9.9.9", "digest": "sha256:abc123"},
            "source": {"key": "git+https://git.example.com/api.git#9.9.9", "digest": "sha256:src-abc123"},
            "createdAt": "2026-06-16T12:00:00Z",
            "createdBy": "ci",
        },
    )
    assert release_response.status_code == 200
    assert release_response.json()["notes"] == "Built from commit abc123 and approved by platform."

    deployset_response = client_instance.post(
        f"{WORKSPACE}/deploysets",
        json={
            "deploySetId": "notes-ds",
            "componentSetId": "local-platform",
            "notes": "Promote api 9.9.9 while inheriting the current worker release.",
            "baseDeploySetId": "local-default",
            "items": [{"componentId": "api", "version": "9.9.9"}],
            "createdBy": "ci",
        },
    )
    assert deployset_response.status_code == 200
    assert deployset_response.json()["deployset"]["notes"] == "Promote api 9.9.9 while inheriting the current worker release."

    deployment_response = client_instance.post(
        f"{WORKSPACE}/deployments",
        json={
            "environmentId": "prod",
            "deploySetId": "prod-default",
            "requestedBy": "ops",
            "notes": "Production rollout requested after change window opened.",
            "force": False,
        },
    )
    assert deployment_response.status_code == 200

    execution_id = deployment_response.json()["deploymentExecutionId"]
    assert re.fullmatch(r"[0-9a-f]{8}", execution_id)
    execution_response = client_instance.get(f"{WORKSPACE}/deployment-executions/{execution_id}")
    assert execution_response.status_code == 200
    assert execution_response.json()["notes"] == "Production rollout requested after change window opened."

    cancel_response = client_instance.post(f"{WORKSPACE}/deployment-executions/{execution_id}/cancel")
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


def test_fastapi_webhook_round_trip_with_subscriptions() -> None:
    client_instance = client()

    webhook = {
        "webhookId": "ops-events",
        "displayName": "Ops events",
        "url": "https://example.com/settle",
        "active": True,
        "secretRef": "secret/webhooks/ops",
        "retryPolicy": {"maxAttempts": 2, "backoffSeconds": 30},
        "subscriptions": [
            {
                "subscriptionId": "sub-release",
                "eventTypes": ["release.created"],
                "filters": {"resourceTypes": ["release"], "resourceIds": [], "categories": [], "origins": [], "severities": []},
            },
            {
                "subscriptionId": "sub-audit",
                "eventTypes": ["eventlog.created"],
                "filters": {"resourceTypes": [], "resourceIds": [], "categories": ["registry"], "origins": [], "severities": []},
            },
        ],
        "tags": {"team": "ops"},
        "createdAt": "2026-06-18T12:00:00Z",
        "createdBy": "user:test-admin",
    }

    response = client_instance.post(f"{WORKSPACE}/webhooks", json=webhook)
    assert response.status_code == 200
    assert response.json()["webhookId"] == "ops-events"
    assert len(response.json()["subscriptions"]) == 2

    response = client_instance.get(f"{WORKSPACE}/webhooks/ops-events")
    assert response.status_code == 200
    assert response.json()["retryPolicy"]["maxAttempts"] == 2

    response = client_instance.get(f"{WORKSPACE}/webhook-deliveries", params={"webhookId": "ops-events"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)
