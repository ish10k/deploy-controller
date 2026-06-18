from fastapi.testclient import TestClient
from src.domain.enums import Permission, PrincipalType
from src.domain.models import AuthContext
from src.interfaces.fastapi.app import app
from src.interfaces.fastapi.dependencies import get_auth_context, get_container


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

    response = client_instance.put("/components/api", json={"componentId": "ignored", "type": "ecs", "active": True})
    assert response.status_code == 200
    assert response.json()["componentId"] == "api"

    response = client_instance.get("/components/api")
    assert response.status_code == 200
    assert response.json()["type"] == "ecs"


def test_fastapi_release_and_deployment_notes_round_trip() -> None:
    client_instance = client()

    release_response = client_instance.post(
        "/releases",
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
        "/deploysets",
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
        "/deployments",
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
    execution_response = client_instance.get(f"/deployment-executions/{execution_id}")
    assert execution_response.status_code == 200
    assert execution_response.json()["notes"] == "Production rollout requested after change window opened."


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

    response = client_instance.post("/webhooks", json=webhook)
    assert response.status_code == 200
    assert response.json()["webhookId"] == "ops-events"
    assert len(response.json()["subscriptions"]) == 2

    response = client_instance.get("/webhooks/ops-events")
    assert response.status_code == 200
    assert response.json()["retryPolicy"]["maxAttempts"] == 2

    response = client_instance.get("/webhook-deliveries", params={"webhookId": "ops-events"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)
