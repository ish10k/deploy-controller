import json
import re

from src.application.use_cases.auth import hash_token
from src.composition.local_seed import seed_local_data
from src.composition.memory_container import build_memory_container
from src.infrastructure.memory.repositories import MemoryRepositories
from src.interfaces.lambda_api.router import route

TOKEN = "settle_pat_test_admin"
WORKSPACE = "/workspaces/default"


def event(method: str, path: str, body: dict[str, object] | None = None, authenticated: bool = False) -> dict[str, object]:
    return {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": {"Authorization": f"Bearer {TOKEN}"} if authenticated else {},
        "body": json.dumps(body or {}),
    }


def authenticated_container():
    store = MemoryRepositories()
    seed_local_data(store)
    container = build_memory_container(store)
    runner = store.get_deployment_runner("local-runner-01")
    assert runner is not None
    store.put_deployment_runner(runner.model_copy(update={"token_hash": hash_token(TOKEN)}))
    principal = store.get_principal(runner.principal_id)
    assert principal is not None
    store.put_principal(principal.model_copy(update={"roles": ["admin"]}))
    return container


def test_lambda_component_round_trip() -> None:
    container = authenticated_container()

    response = route(
        event("PUT", f"{WORKSPACE}/components/api", {"componentId": "ignored", "type": "ecs", "active": True}, authenticated=True),
        container,
    )
    assert response["statusCode"] == 200

    response = route(event("GET", f"{WORKSPACE}/components/api"), container)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["componentId"] == "api"


def test_lambda_deployment_notes_round_trip() -> None:
    container = authenticated_container()

    release_response = route(
        event(
            "POST",
            f"{WORKSPACE}/releases",
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
            authenticated=True,
        ),
        container,
    )
    assert release_response["statusCode"] == 200
    assert json.loads(release_response["body"])["notes"] == "Lambda router release note coverage."

    response = route(
        event(
            "POST",
            f"{WORKSPACE}/deployments",
            {
                "environmentId": "prod",
                "deploySetId": "prod-default",
                "requestedBy": "ops",
                "notes": "Lambda deployment note coverage.",
                "force": False,
            },
            authenticated=True,
        ),
        container,
    )
    assert response["statusCode"] == 200

    execution_id = json.loads(response["body"])["deploymentExecutionId"]
    assert re.fullmatch(r"[0-9a-f]{8}", execution_id)
    detail_response = route(event("GET", f"{WORKSPACE}/deployment-executions/{execution_id}"), container)
    assert detail_response["statusCode"] == 200
    assert json.loads(detail_response["body"])["notes"] == "Lambda deployment note coverage."

    cancel_response = route(event("POST", f"{WORKSPACE}/deployment-executions/{execution_id}/cancel", authenticated=True), container)
    assert cancel_response["statusCode"] == 200
    assert json.loads(cancel_response["body"])["status"] == "cancelled"
