import os
from functools import lru_cache
from typing import Any

from src.composition import Container
from src.composition.aws_container import build_aws_container
from src.composition.memory_container import build_memory_container
from src.interfaces.lambda_api.responses import error_response
from src.interfaces.lambda_api.router import route


@lru_cache(maxsize=1)
def _container() -> Container:
    if os.getenv("DEPLOYSET_BACKEND", "dynamodb") == "memory":
        return build_memory_container()
    return build_aws_container()


def handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    try:
        return route(event, _container())
    except Exception as exc:
        return error_response(exc)


