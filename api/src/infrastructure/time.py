from datetime import UTC, datetime


class SystemClock:
    def now(self) -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")




