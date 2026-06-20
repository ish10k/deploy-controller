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


def test_lambda_tag_definitions_can_be_listed_and_filtered() -> None:
    container = authenticated_container()

    response = route(event("GET", f"{WORKSPACE}/tag-definitions", authenticated=True), container)
    assert response["statusCode"] == 200
    definitions = json.loads(response["body"])
    assert any(definition["key"] == "track" for definition in definitions)

    response = route(
        {
            **event("GET", f"{WORKSPACE}/tag-definitions", authenticated=True),
            "queryStringParameters": {"resourceType": "deployset"},
        },
        container,
    )
    assert response["statusCode"] == 200
    filtered = json.loads(response["body"])
    assert filtered
    assert all("deployset" in definition["selector"]["resourceTypes"] for definition in filtered)


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
                "force": True,
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


def test_lambda_live_runner_warning_is_serialized() -> None:
    container = authenticated_container()

    response = route(
        event("PUT", f"{WORKSPACE}/components/edge-api", {"componentId": "ignored", "type": "bare-metal", "active": True}, authenticated=True),
        container,
    )
    assert response["statusCode"] == 200

    response = route(
        event(
            "PUT",
            f"{WORKSPACE}/component-sets/edge-platform",
            {
                "componentSetId": "ignored",
                "components": [{"componentId": "edge-api"}],
                "createdAt": "2026-06-19T10:00:00Z",
                "createdBy": "test",
            },
            authenticated=True,
        ),
        container,
    )
    assert response["statusCode"] == 200

    response = route(
        event(
            "POST",
            f"{WORKSPACE}/releases",
            {
                "componentId": "edge-api",
                "version": "1.0.0",
                "artifact": {"key": "edge-api:1.0.0", "digest": "sha256:edge"},
                "createdAt": "2026-06-19T10:00:00Z",
                "createdBy": "test",
            },
            authenticated=True,
        ),
        container,
    )
    assert response["statusCode"] == 200

    response = route(
        event(
            "POST",
            f"{WORKSPACE}/deploysets",
            {
                "deploySetId": "edge-ds",
                "componentSetId": "edge-platform",
                "items": [{"componentId": "edge-api", "version": "1.0.0"}],
                "createdBy": "test",
            },
            authenticated=True,
        ),
        container,
    )
    assert response["statusCode"] == 200

    response = route(event("PUT", f"{WORKSPACE}/environments/edge", {"environmentId": "ignored", "active": True}, authenticated=True), container)
    assert response["statusCode"] == 200

    response = route(
        event(
            "POST",
            f"{WORKSPACE}/deployments",
            {
                "environmentId": "edge",
                "deploySetId": "edge-ds",
                "requestedBy": "ops",
                "force": True,
            },
            authenticated=True,
        ),
        container,
    )
    assert response["statusCode"] == 200
    execution_id = json.loads(response["body"])["deploymentExecutionId"]

    response = route(event("GET", f"{WORKSPACE}/deployment-executions/{execution_id}"), container)
    assert response["statusCode"] == 200
    assert any(item["runnerMatchWarning"] for item in json.loads(response["body"])["items"])


def test_lambda_pending_deployment_executions_route_is_not_shadowed() -> None:
    container = authenticated_container()

    response = route(event("GET", f"{WORKSPACE}/deployment-executions/pending"), container)
    assert response["statusCode"] == 200
    assert isinstance(json.loads(response["body"]), list)


def test_lambda_runner_items_include_historical_and_current_work() -> None:
    container = authenticated_container()

    response = route(event("GET", f"{WORKSPACE}/deployment-runners/package-runner-01/executions/items"), container)
    assert response["statusCode"] == 200
    items = json.loads(response["body"])
    assert any(item["status"] == "succeeded" for item in items)
    assert any(item["status"] == "pending" for item in items)
