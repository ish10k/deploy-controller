from src.domain.enums import DriftReason, ItemStatus, ReportedAction, RequestedAction, RequestedReason
from src.domain.models import DeploymentItem


def requested_action_for_item(
    *,
    requested_version: str,
    latest_item: DeploymentItem | None,
    force: bool = False,
) -> tuple[RequestedAction, ItemStatus, RequestedReason]:
    if force:
        return RequestedAction.DEPLOY, ItemStatus.PENDING, RequestedReason.FORCE

    if latest_item is None:
        return RequestedAction.DEPLOY, ItemStatus.PENDING, RequestedReason.MISSING_LATEST_EXECUTION_ITEM

    if latest_item.status not in {ItemStatus.SUCCEEDED, ItemStatus.SKIPPED}:
        return RequestedAction.DEPLOY, ItemStatus.PENDING, RequestedReason.LATEST_STATUS_NOT_SUCCEEDED

    if latest_item.version != requested_version:
        return RequestedAction.DEPLOY, ItemStatus.PENDING, RequestedReason.VERSION_CHANGED

    return RequestedAction.SKIP, ItemStatus.SKIPPED, RequestedReason.LATEST_EXECUTION_ALREADY_SUCCEEDED


def possible_drift_reason(
    *,
    requested_version: str,
    latest_item: DeploymentItem | None,
    force: bool,
    reported_action: ReportedAction | None,
    status: ItemStatus,
) -> DriftReason | None:
    if (
        force
        and latest_item is not None
        and latest_item.status == ItemStatus.SUCCEEDED
        and latest_item.version == requested_version
        and reported_action == ReportedAction.DEPLOY
        and status == ItemStatus.SUCCEEDED
    ):
        return DriftReason.SAME_VERSION_REDEPLOYED
    return None


