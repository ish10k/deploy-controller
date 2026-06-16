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
