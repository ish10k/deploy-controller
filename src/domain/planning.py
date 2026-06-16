from src.domain.models import DeploymentExecutionItem


def should_deploy(
    *,
    requested_version: str,
    release_artifact_sha: str,
    latest_item: DeploymentExecutionItem | None,
    actual_sha: str | None,
    require_actual_sha_check: bool = True,
) -> tuple[bool, str]:
    if latest_item is None:
        return True, "missing_latest_execution_item"

    if latest_item.status != "succeeded":
        return True, "latest_status_not_succeeded"

    if latest_item.version != requested_version:
        return True, "version_changed"

    if require_actual_sha_check and actual_sha != release_artifact_sha:
        return True, "artifact_sha_mismatch"

    return False, "already_applied"
