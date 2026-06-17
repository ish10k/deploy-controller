from uuid import uuid4


class UuidIdGenerator:
    def new_id(self) -> str:
        return f"dep-exec-{uuid4()}"



