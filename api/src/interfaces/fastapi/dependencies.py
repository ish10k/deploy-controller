import os
from functools import lru_cache

from src.composition import Container
from src.composition.aws_container import build_aws_container
from src.composition.memory_container import build_memory_container


@lru_cache(maxsize=1)
def get_container() -> Container:
    backend = os.getenv("DEPLOYSET_BACKEND", "memory")
    if backend == "dynamodb":
        return build_aws_container()
    return build_memory_container()



