import json
from typing import Any

from src.domain.errors import ReleaseControllerError


def to_json(value: Any) -> Any:
    if isinstance(value, list):
        return [to_json(item) for item in value]
    if hasattr(value, "model_dump"):
        payload = value.model_dump(by_alias=True, mode="json")
        if hasattr(value, "items") and isinstance(payload.get("items"), list):
            payload["items"] = [to_json(item) for item in getattr(value, "items")]
        if hasattr(value, "runner_match_warning"):
            payload["runnerMatchWarning"] = getattr(value, "runner_match_warning")
        return payload
    return value


def response(status_code: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(to_json(body)),
    }


def error_response(exc: Exception) -> dict[str, Any]:
    if isinstance(exc, ReleaseControllerError):
        return response(exc.status_code, {"detail": str(exc)})
    return response(500, {"detail": "Internal server error"})





