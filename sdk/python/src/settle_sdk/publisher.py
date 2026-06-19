from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from settle_sdk.models import Artifact, Release, Source

if TYPE_CHECKING:
    from settle_sdk.client import SettleClient


class PublisherClient:
    def __init__(self, client: "SettleClient", publisher_id: str) -> None:
        self.client = client
        self.publisher_id = publisher_id

    def publish(
        self,
        *,
        component_id: str,
        version: str,
        artifact: Artifact,
        source: Source | None = None,
        description: str | None = None,
        notes: str | None = None,
        tags: dict[str, str] | None = None,
        created_at: str | None = None,
        created_by: str | None = None,
    ) -> Release:
        release = Release(
            workspace_id=self.client.workspace_id,
            component_id=component_id,
            version=version,
            description=description,
            notes=notes,
            artifact=artifact,
            source=source,
            created_at=created_at,
            created_by=created_by,
            tags=tags or {},
        )
        return self.publish_release(release)

    def publish_release(self, release: Release) -> Release:
        data = self.client.post(self._path("/releases"), release.to_dict())
        return Release.from_dict(_dict(data))

    def _path(self, suffix: str = "") -> str:
        return self.client.workspace_path(f"/publishers/{quote(self.publisher_id, safe='')}{suffix}")


def _dict(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError("expected object")
    return value
