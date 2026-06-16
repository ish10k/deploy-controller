from src.domain.models import DeploymentExecutionItem
from src.domain.planning import should_deploy


def item(*, version: str = "1.0.0", status: str = "succeeded") -> DeploymentExecutionItem:
    return DeploymentExecutionItem(
        componentId="api",
        version=version,
        artifactSha256="sha-a",
        actualSha256="sha-a",
        action="noop",
        status=status,
    )


def test_missing_latest_item_deploys() -> None:
    assert should_deploy(
        requested_version="1.0.0",
        release_artifact_sha="sha-a",
        latest_item=None,
        actual_sha="sha-a",
    ) == (True, "missing_latest_execution_item")


def test_latest_failed_deploys() -> None:
    assert should_deploy(
        requested_version="1.0.0",
        release_artifact_sha="sha-a",
        latest_item=item(status="failed"),
        actual_sha="sha-a",
    ) == (True, "latest_status_not_succeeded")


def test_same_version_succeeded_sha_match_noops() -> None:
    assert should_deploy(
        requested_version="1.0.0",
        release_artifact_sha="sha-a",
        latest_item=item(),
        actual_sha="sha-a",
    ) == (False, "already_applied")


def test_same_version_succeeded_sha_mismatch_deploys() -> None:
    assert should_deploy(
        requested_version="1.0.0",
        release_artifact_sha="sha-a",
        latest_item=item(),
        actual_sha="sha-b",
    ) == (True, "artifact_sha_mismatch")


def test_different_version_deploys() -> None:
    assert should_deploy(
        requested_version="2.0.0",
        release_artifact_sha="sha-a",
        latest_item=item(version="1.0.0"),
        actual_sha="sha-a",
    ) == (True, "version_changed")


def test_require_actual_sha_check_false_ignores_mismatch() -> None:
    assert should_deploy(
        requested_version="1.0.0",
        release_artifact_sha="sha-a",
        latest_item=item(),
        actual_sha="sha-b",
        require_actual_sha_check=False,
    ) == (False, "already_applied")

