class MemoryActualShaReader:
    def __init__(self, values: dict[tuple[str, str], str] | None = None) -> None:
        self.values = values or {}

    def read_actual_sha256(self, *, component_type: str, target_key: str) -> str | None:
        return self.values.get((component_type, target_key))

