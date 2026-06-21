from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from settle_sdk.errors import UnsupportedOperationError
from settle_sdk.models import Deployment, DeploymentItem, ReportedAction

if TYPE_CHECKING:
    from settle_sdk.client import SettleClient


DeployJob = DeploymentItem
DeployJobRef = str | DeployJob


class DeploymentRunnerClient:
    def __init__(self, client: "SettleClient", runner_id: str) -> None:
        self.client = client
        self.runner_id = runner_id
        self.current_execution_id: str | None = None

    def heartbeat(self) -> dict[str, Any]:
        data = self.client.post(self._path("/heartbeat"))
        return data if isinstance(data, dict) else {}

    def pending(self) -> list[DeployJob]:
        data = self.client.get(self._path("/executions/pending"))
        if not isinstance(data, list):
            return []
        return [DeployJob.from_dict(item) for item in data if isinstance(item, dict)]

    def claim(self, execution_id: str, component_id: str, *, claim_timeout_seconds: int | None = None) -> DeployJob:
        body: dict[str, Any] = {}
        if claim_timeout_seconds is not None:
            body["claimTimeoutSeconds"] = claim_timeout_seconds
        data = self.client.post(
            self._path(f"/executions/{quote(execution_id, safe='')}/items/{quote(component_id, safe='')}/claim"),
            body,
        )
        item = DeployJob.from_dict(_dict(data))
        self.current_execution_id = item.deployment_id
        return item

    def next(self, *, claim_timeout_seconds: int | None = None) -> DeployJob | None:
        pending = self.pending()
        if not pending:
            return None
        item = pending[0]
        return self.claim(item.deployment_id, item.component_id, claim_timeout_seconds=claim_timeout_seconds)

    def started(
        self,
        job: DeployJobRef,
        *,
        execution_id: str | None = None,
        reported_by: str | None = None,
    ) -> Deployment:
        return self.report_item(
            job,
            status="in-progress",
            reported_action=_reported_action_for(job),
            execution_id=execution_id,
            reported_by=reported_by,
        )

    def completed(
        self,
        job: DeployJobRef,
        *,
        execution_id: str | None = None,
        reported_by: str | None = None,
    ) -> Deployment:
        return self.report_item(
            job,
            status="succeeded",
            reported_action=_reported_action_for(job),
            execution_id=execution_id,
            reported_by=reported_by,
        )

    def failed(
        self,
        job: DeployJobRef,
        *,
        execution_id: str | None = None,
        failure_reason: str | None = None,
        reported_by: str | None = None,
    ) -> Deployment:
        return self.report_item(
            job,
            status="failed",
            reported_action=_reported_action_for(job),
            execution_id=execution_id,
            failure_reason=failure_reason,
            reported_by=reported_by,
        )

    def skipped(
        self,
        job: DeployJobRef,
        *,
        execution_id: str | None = None,
        reported_by: str | None = None,
    ) -> Deployment:
        return self.report_item(
            job,
            status="skipped",
            reported_action="skip",
            execution_id=execution_id,
            reported_by=reported_by,
        )

    def report_item(
        self,
        job: DeployJobRef,
        *,
        status: str,
        reported_action: ReportedAction,
        execution_id: str | None = None,
        reported_by: str | None = None,
        failure_reason: str | None = None,
    ) -> Deployment:
        resolved_execution_id = execution_id or _component_execution_id(job) or self.current_execution_id
        if not resolved_execution_id:
            raise ValueError("execution_id is required before work has been claimed")

        body: dict[str, Any] = {
            "status": status,
            "reportedAction": reported_action,
        }
        if reported_by is not None:
            body["reportedBy"] = reported_by
        if failure_reason is not None:
            body["failureReason"] = failure_reason

        component_id = _component_id(job)
        data = self.client.post(
            self._path(
                f"/executions/{quote(resolved_execution_id, safe='')}/items/{quote(component_id, safe='')}/status"
            ),
            body,
        )
        execution = Deployment.from_dict(_dict(data))
        self.current_execution_id = execution.deployment_id
        return execution

    def _path(self, suffix: str = "") -> str:
        return self.client.workspace_path(f"/deployment-runners/{quote(self.runner_id, safe='')}{suffix}")


def _component_id(job: DeployJobRef) -> str:
    if isinstance(job, DeploymentItem):
        return job.component_id
    return job


def _component_execution_id(job: DeployJobRef) -> str | None:
    if isinstance(job, DeploymentItem):
        return job.deployment_id or None
    return None


def _reported_action_for(job: DeployJobRef) -> ReportedAction:
    if isinstance(job, DeploymentItem) and job.requested_action == "skip":
        return "skip"
    return "deploy"


def _dict(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError("expected object")
    return value
