from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ExecutionStatus = Literal["pending", "claimed", "in-progress", "succeeded", "failed", "cancelled"]
ItemStatus = Literal["pending", "claimed", "in-progress", "succeeded", "failed", "skipped"]
ReportedAction = Literal["deploy", "noop", "skip"]
RequestedAction = Literal["deploy", "skip"]
TagResourceType = Literal[
    "organization",
    "workspace",
    "component",
    "release",
    "version",
    "release",
    "deployment",
    "environment",
    "deployment-runner",
    "publisher",
    "principal",
    "webhook",
]


@dataclass(frozen=True)
class Artifact:
    key: str
    digest: str

    def to_dict(self) -> dict[str, str]:
        return {"key": self.key, "digest": self.digest}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Artifact:
        return cls(key=str(data["key"]), digest=str(data["digest"]))


@dataclass(frozen=True)
class Source:
    key: str
    digest: str

    def to_dict(self) -> dict[str, str]:
        return {"key": self.key, "digest": self.digest}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Source:
        return cls(key=str(data["key"]), digest=str(data["digest"]))


@dataclass(frozen=True)
class ComponentVersion:
    component_id: str
    version: str
    artifact: Artifact
    workspace_id: str = "default"
    created_at: str | None = None
    created_by: str | None = None
    description: str | None = None
    notes: str | None = None
    source: Source | None = None
    tags: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "workspaceId": self.workspace_id,
            "componentId": self.component_id,
            "version": self.version,
            "artifact": self.artifact.to_dict(),
            "tags": dict(self.tags),
        }
        if self.description is not None:
            payload["description"] = self.description
        if self.notes is not None:
            payload["notes"] = self.notes
        if self.source is not None:
            payload["source"] = self.source.to_dict()
        if self.created_at is not None:
            payload["createdAt"] = self.created_at
        if self.created_by is not None:
            payload["createdBy"] = self.created_by
        return payload

    def to_create_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "componentId": self.component_id,
            "version": self.version,
            "artifact": self.artifact.to_dict(),
            "tags": dict(self.tags),
        }
        if self.description is not None:
            payload["description"] = self.description
        if self.notes is not None:
            payload["notes"] = self.notes
        if self.source is not None:
            payload["source"] = self.source.to_dict()
        return payload

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ComponentVersion:
        source = data.get("source")
        return cls(
            workspace_id=str(data.get("workspaceId", "default")),
            component_id=str(data["componentId"]),
            version=str(data["version"]),
            description=_optional_str(data.get("description")),
            notes=_optional_str(data.get("notes")),
            artifact=Artifact.from_dict(_dict(data["artifact"])),
            source=Source.from_dict(_dict(source)) if source else None,
            created_at=_optional_str(data.get("createdAt")),
            created_by=_optional_str(data.get("createdBy")),
            tags=_string_map(data.get("tags")),
        )


Version = ComponentVersion


@dataclass(frozen=True)
class TagDefinitionSelector:
    resource_types: list[TagResourceType] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TagDefinitionSelector":
        resource_types = data.get("resourceTypes", [])
        if not isinstance(resource_types, list):
            raise TypeError("expected resourceTypes list")
        return cls(resource_types=[str(value) for value in resource_types])


@dataclass(frozen=True)
class TagDefinition:
    tag_definition_id: str
    key: str
    selector: TagDefinitionSelector
    workspace_id: str = "default"
    label: str | None = None
    description: str | None = None
    default_value: str | None = None
    allowed_values: list[str] = field(default_factory=list)
    created_at: str | None = None
    created_by: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TagDefinition":
        allowed_values = data.get("allowedValues", [])
        if not isinstance(allowed_values, list):
            raise TypeError("expected allowedValues list")
        return cls(
            workspace_id=str(data.get("workspaceId", "default")),
            tag_definition_id=str(data["tagDefinitionId"]),
            key=str(data["key"]),
            label=_optional_str(data.get("label")),
            description=_optional_str(data.get("description")),
            default_value=_optional_str(data.get("defaultValue")),
            allowed_values=[str(value) for value in allowed_values],
            selector=TagDefinitionSelector.from_dict(_dict(data.get("selector", {}))),
            created_at=_optional_str(data.get("createdAt")),
            created_by=_optional_str(data.get("createdBy")),
            updated_at=_optional_str(data.get("updatedAt")),
        )


@dataclass(frozen=True)
class DeploymentItem:
    workspace_id: str
    deployment_id: str
    environment_id: str
    release_id: str
    component_id: str
    version: str
    artifact: Artifact
    requested_action: RequestedAction
    status: ItemStatus
    reported_action: ReportedAction | None = None
    claimed_by: str | None = None
    claimed_at: str | None = None
    claim_expires_at: str | None = None
    claim_eligibility: dict[str, object] = field(default_factory=dict)
    requested_reason: str | None = None
    runner_reason: str | None = None
    failure_reason: str | None = None
    runner_match_warning: bool = False
    drift_detected: bool = False
    drift_reason: str | None = None
    reported_by: str | None = None
    message: str | None = None
    error: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeploymentItem:
        return cls(
            component_id=str(data["componentId"]),
            workspace_id=str(data.get("workspaceId", "default")),
            deployment_id=str(data.get("deploymentId", "")),
            environment_id=str(data.get("environmentId", "")),
            release_id=str(data.get("releaseId", "")),
            version=str(data["version"]),
            artifact=Artifact.from_dict(_dict(data["artifact"])),
            requested_action=_requested_action(data.get("requestedAction")),
            reported_action=_reported_action(data.get("reportedAction")),
            status=_item_status(data.get("status")),
            claimed_by=_optional_str(data.get("claimedBy")),
            claimed_at=_optional_str(data.get("claimedAt")),
            claim_expires_at=_optional_str(data.get("claimExpiresAt")),
            claim_eligibility=_dict(data.get("claimEligibility", {})),
            requested_reason=_optional_str(data.get("requestedReason")),
            runner_reason=_optional_str(data.get("runnerReason")),
            failure_reason=_optional_str(data.get("failureReason")),
            runner_match_warning=bool(data.get("runnerMatchWarning", False)),
            drift_detected=bool(data.get("driftDetected", False)),
            drift_reason=_optional_str(data.get("driftReason")),
            reported_by=_optional_str(data.get("reportedBy")),
            message=_optional_str(data.get("message")),
            error=_optional_str(data.get("error")),
        )


@dataclass(frozen=True)
class Deployment:
    deployment_id: str
    environment_id: str
    release_id: str
    status: ExecutionStatus
    requested_by: str
    started_at: str
    items: list[DeploymentItem]
    workspace_id: str = "default"
    completed_at: str | None = None
    claimed_by: str | None = None
    notes: str | None = None
    force: bool = False
    tags: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Deployment:
        return cls(
            workspace_id=str(data.get("workspaceId", "default")),
            deployment_id=str(data["deploymentId"]),
            environment_id=str(data["environmentId"]),
            release_id=str(data["releaseId"]),
            status=_execution_status(data.get("status")),
            requested_by=str(data["requestedBy"]),
            notes=_optional_str(data.get("notes")),
            force=bool(data.get("force", False)),
            started_at=str(data["startedAt"]),
            completed_at=_optional_str(data.get("completedAt")),
            claimed_by=_optional_str(data.get("claimedBy")),
            items=[DeploymentItem.from_dict(_dict(item)) for item in data.get("items", [])],
            tags=_string_map(data.get("tags")),
        )


def _dict(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError("expected object")
    return value


def _string_map(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key): str(item) for key, item in value.items()}


def _optional_str(value: object) -> str | None:
    return None if value is None else str(value)


def _execution_status(value: object) -> ExecutionStatus:
    if value in {"pending", "claimed", "in-progress", "succeeded", "failed", "cancelled"}:
        return value
    raise ValueError(f"unsupported execution status: {value!r}")


def _item_status(value: object) -> ItemStatus:
    if value in {"pending", "claimed", "in-progress", "succeeded", "failed", "skipped"}:
        return value
    raise ValueError(f"unsupported item status: {value!r}")


def _reported_action(value: object) -> ReportedAction | None:
    if value is None:
        return None
    if value in {"deploy", "noop", "skip"}:
        return value
    raise ValueError(f"unsupported reported action: {value!r}")


def _requested_action(value: object) -> RequestedAction:
    if value in {"deploy", "skip"}:
        return value
    raise ValueError(f"unsupported requested action: {value!r}")
