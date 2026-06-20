from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from settle_sdk.errors import SettleApiError


class SettleClient:
    def __init__(
        self,
        base_url: str,
        *,
        token: str | None = None,
        workspace_id: str = "default",
        timeout: float = 30.0,
        user_agent: str = "settle-sdk-python/0.1.0",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.workspace_id = workspace_id
        self.timeout = timeout
        self.user_agent = user_agent

    def runner(self, runner_id: str) -> "DeploymentRunnerClient":
        from settle_sdk.runner import DeploymentRunnerClient

        return DeploymentRunnerClient(self, runner_id)

    def publisher(self, publisher_id: str) -> "PublisherClient":
        from settle_sdk.publisher import PublisherClient

        return PublisherClient(self, publisher_id)

    def workspace_path(self, path: str) -> str:
        path = path if path.startswith("/") else f"/{path}"
        return f"/workspaces/{quote(self.workspace_id, safe='')}{path}"

    def get(self, path: str) -> Any:
        return self.request("GET", path)

    def post(self, path: str, body: Mapping[str, Any] | None = None) -> Any:
        return self.request("POST", path, body=body)

    def put(self, path: str, body: Mapping[str, Any] | None = None) -> Any:
        return self.request("PUT", path, body=body)

    def request(self, method: str, path: str, *, body: Mapping[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path if path.startswith('/') else f'/{path}'}"
        data = None
        headers = {
            "Accept": "application/json",
            "User-Agent": self.user_agent,
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        request = Request(url, data=data, headers=headers, method=method.upper())
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = response.read()
                if not payload:
                    return None
                return json.loads(payload.decode("utf-8"))
        except (HTTPError, URLError) as exc:
            raise self._api_error(exc) from exc

    def _api_error(self, exc: HTTPError | URLError) -> SettleApiError:
        if isinstance(exc, URLError):
            reason = exc.reason
            if isinstance(reason, Exception):
                return SettleApiError(503, str(reason))
            return SettleApiError(503, str(reason))

        raw = exc.read()
        if not raw:
            return SettleApiError(exc.code, exc.reason)
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            text = raw.decode("utf-8", errors="replace")
            return SettleApiError(exc.code, text, response_body=text)
        if isinstance(body, dict):
            message = body.get("message") or body.get("detail") or exc.reason
            return SettleApiError(exc.code, str(message), response_body=body)
        return SettleApiError(exc.code, exc.reason, response_body=body)
