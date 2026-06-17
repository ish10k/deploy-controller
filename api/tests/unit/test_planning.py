from src.domain.models import DeploymentExecutionItem
from src.domain.planning import possible_drift_reason, requested_action_for_item


def artifact(version: str) -> dict[str, object]:
    return {
        "key": f"api:{version}",
        "digest": "sha256:sha-a",
    }


def item(*, version: str = "1.0.0", status: str = "succeeded") -> DeploymentExecutionItem:
    return DeploymentExecutionItem(
        componentId="api",
        version=version,
        artifact=artifact(version),
        requestedAction="deploy",
        reportedAction="deploy",
        status=status,
    )


def test_missing_latest_item_deploys() -> None:
    assert requested_action_for_item(requested_version="1.0.0", latest_item=None) == (
        "deploy",
        "pending",
        "missing_latest_execution_item",
    )


def test_latest_failed_deploys() -> None:
    assert requested_action_for_item(requested_version="1.0.0", latest_item=item(status="failed")) == (
        "deploy",
        "pending",
        "latest_status_not_succeeded",
    )


def test_same_version_succeeded_skips() -> None:
    assert requested_action_for_item(requested_version="1.0.0", latest_item=item()) == (
        "skip",
        "skipped",
        "latest_execution_already_succeeded",
    )


def test_different_version_deploys() -> None:
    assert requested_action_for_item(requested_version="2.0.0", latest_item=item(version="1.0.0")) == (
        "deploy",
        "pending",
        "version_changed",
    )


def test_force_deploys_even_when_latest_succeeded() -> None:
    assert requested_action_for_item(requested_version="1.0.0", latest_item=item(), force=True) == (
        "deploy",
        "pending",
        "force",
    )


def test_possible_drift_when_force_redeploys_same_successful_version() -> None:
    assert (
        possible_drift_reason(
            requested_version="1.0.0",
            latest_item=item(),
            force=True,
            reported_action="deploy",
            status="succeeded",
        )
        == "same_version_redeployed"
    )


