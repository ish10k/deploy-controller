from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ExecutionStatus = Literal["pending", "claimed", "in-progress", "succeeded", "failed", "cancelled"]
ItemStatus = Literal["pending", "claimed", "in-progress", "succeeded", "failed", "skipped"]
ReportedAction = Literal["deploy", "noop", "skip"]
RequestedAction = Literal["deploy", "skip"]


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
class Release:
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

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Release:
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


@dataclass(frozen=True)
class DeploymentExecutionItem:
    workspace_id: str
    deployment_execution_id: str
    environment_id: str
    component_set_id: str
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
    def from_dict(cls, data: dict[str, Any]) -> DeploymentExecutionItem:
        return cls(
            component_id=str(data["componentId"]),
            workspace_id=str(data.get("workspaceId", "default")),
            deployment_execution_id=str(data.get("deploymentExecutionId", "")),
            environment_id=str(data.get("environmentId", "")),
            component_set_id=str(data.get("componentSetId", "")),
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
class DeploymentExecution:
    deployment_execution_id: str
    environment_id: str
    deployset_id: str
    status: ExecutionStatus
    requested_by: str
    started_at: str
    items: list[DeploymentExecutionItem]
    workspace_id: str = "default"
    completed_at: str | None = None
    claimed_by: str | None = None
    notes: str | None = None
    force: bool = False
    tags: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeploymentExecution:
        return cls(
            workspace_id=str(data.get("workspaceId", "default")),
            deployment_execution_id=str(data["deploymentExecutionId"]),
            environment_id=str(data["environmentId"]),
            deployset_id=str(data["deploySetId"]),
            status=_execution_status(data.get("status")),
            requested_by=str(data["requestedBy"]),
            notes=_optional_str(data.get("notes")),
            force=bool(data.get("force", False)),
            started_at=str(data["startedAt"]),
            completed_at=_optional_str(data.get("completedAt")),
            claimed_by=_optional_str(data.get("claimedBy")),
            items=[DeploymentExecutionItem.from_dict(_dict(item)) for item in data.get("items", [])],
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
