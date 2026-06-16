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
