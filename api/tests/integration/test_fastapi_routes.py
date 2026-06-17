from fastapi.testclient import TestClient
from src.interfaces.fastapi.app import app
from src.interfaces.fastapi.dependencies import get_container


def test_fastapi_component_round_trip() -> None:
    get_container.cache_clear()
    client = TestClient(app)

    response = client.put("/components/api", json={"componentId": "ignored", "type": "ecs", "active": True})
    assert response.status_code == 200
    assert response.json()["componentId"] == "api"

    response = client.get("/components/api")
    assert response.status_code == 200
    assert response.json()["type"] == "ecs"


def test_fastapi_release_and_deployment_notes_round_trip() -> None:
    get_container.cache_clear()
    client = TestClient(app)

    release_response = client.post(
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

    deployset_response = client.post(
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

    deployment_response = client.post(
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
    execution_response = client.get(f"/deployment-executions/{execution_id}")
    assert execution_response.status_code == 200
    assert execution_response.json()["notes"] == "Production rollout requested after change window opened."


