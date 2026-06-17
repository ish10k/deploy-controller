import json

from src.composition.memory_container import build_memory_container
from src.interfaces.lambda_api.router import route


def event(method: str, path: str, body: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "body": json.dumps(body or {}),
    }


def test_lambda_component_round_trip() -> None:
    container = build_memory_container()

    response = route(
        event("PUT", "/components/api", {"componentId": "ignored", "type": "ecs", "active": True}),
        container,
    )
    assert response["statusCode"] == 200

    response = route(event("GET", "/components/api"), container)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["componentId"] == "api"


def test_lambda_deployment_notes_round_trip() -> None:
    container = build_memory_container()

    release_response = route(
        event(
            "POST",
            "/releases",
            {
                "componentId": "api",
                "version": "9.9.9",
                "description": "API release 9.9.9",
                "notes": "Lambda router release note coverage.",
                "artifact": {"key": "api:9.9.9", "digest": "sha256:abc123"},
                "source": {"key": "git+https://git.example.com/api.git#9.9.9", "digest": "sha256:src-abc123"},
                "createdAt": "2026-06-16T12:00:00Z",
                "createdBy": "ci",
            },
        ),
        container,
    )
    assert release_response["statusCode"] == 200
    assert json.loads(release_response["body"])["notes"] == "Lambda router release note coverage."

    response = route(
        event(
            "POST",
            "/deployments",
            {
                "environmentId": "prod",
                "deploySetId": "prod-default",
                "requestedBy": "ops",
                "notes": "Lambda deployment note coverage.",
                "force": False,
            },
        ),
        container,
    )
    assert response["statusCode"] == 200

    execution_id = json.loads(response["body"])["deploymentExecutionId"]
    detail_response = route(event("GET", f"/deployment-executions/{execution_id}"), container)
    assert detail_response["statusCode"] == 200
    assert json.loads(detail_response["body"])["notes"] == "Lambda deployment note coverage."


