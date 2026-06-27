from __future__ import annotations

from typing import TYPE_CHECKING, Any
from onerelease_sdk.models import Artifact, ComponentVersion, Source

if TYPE_CHECKING:
    from onerelease_sdk.client import OneReleaseClient


class PublisherClient:
    def __init__(self, client: "OneReleaseClient", publisher_id: str) -> None:
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
    ) -> ComponentVersion:
        component_version = ComponentVersion(
            workspace_id=self.client.workspace_id,
            component_id=component_id,
            version=version,
            description=description,
            notes=notes,
            artifact=artifact,
            source=source,
            tags=tags or {},
        )
        return self.publish_version(component_version)

    def publish_version(self, component_version: ComponentVersion) -> ComponentVersion:
        data = self.client.post(self.client.workspace_path("/versions"), component_version.to_create_dict())
        return ComponentVersion.from_dict(_dict(data))


def _dict(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError("expected object")
    return value
