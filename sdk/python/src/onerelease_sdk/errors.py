from __future__ import annotations


class OneReleaseError(Exception):
    """Base exception for SDK errors."""


class OneReleaseApiError(OneReleaseError):
    def __init__(self, status_code: int, message: str, *, response_body: object | None = None) -> None:
        super().__init__(f"OneRelease API returned {status_code}: {message}")
        self.status_code = status_code
        self.message = message
        self.response_body = response_body


class UnsupportedOperationError(OneReleaseError):
    """Raised when the SDK is asked to perform an action the current API cannot represent."""
