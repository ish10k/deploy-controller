import json
from typing import Any

from src.domain.errors import DeploySetControllerError


def to_json(value: Any) -> Any:
    if isinstance(value, list):
        return [to_json(item) for item in value]
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
    return value


def response(status_code: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(to_json(body)),
    }


def error_response(exc: Exception) -> dict[str, Any]:
    if isinstance(exc, DeploySetControllerError):
        return response(exc.status_code, {"detail": str(exc)})
    return response(500, {"detail": "Internal server error"})

