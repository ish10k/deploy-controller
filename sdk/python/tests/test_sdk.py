from __future__ import annotations

import unittest

from settle_sdk import Artifact, DeployJob, DeploymentRunnerClient, PublisherClient, Version


class FakeClient:
    workspace_id = "ws-1"

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, object | None]] = []

    def workspace_path(self, path: str) -> str:
        return f"/workspaces/ws-1{path}"

    def get(self, path: str) -> object:
        self.calls.append(("GET", path, None))
        if path.endswith("/executions/pending"):
            return [_component(status="pending")]
        return _execution()

    def post(self, path: str, body: object | None = None) -> object:
        self.calls.append(("POST", path, body))
        if path.endswith("/versions"):
            assert isinstance(body, dict)
            return {
                **body,
                "createdAt": "2026-06-19T10:00:00Z",
                "createdBy": "service:publisher:ci",
            }
        if path.endswith("/claim"):
            return _component(status="claimed", claimed_by="runner-1")
        return _execution(status="in-progress")


class SdkTests(unittest.TestCase):
    def test_publisher_publish_builds_version_payload(self) -> None:
        client = FakeClient()
        publisher = PublisherClient(client, "platform-ci")

        version = publisher.publish(
            component_id="api",
            version="1.2.3",
            artifact=Artifact(key="s3://bucket/api.tgz", digest="sha256:abc"),
            tags={"gitSha": "abc"},
        )

        self.assertEqual(
            version,
            Version(
                workspace_id="ws-1",
                component_id="api",
                version="1.2.3",
                artifact=Artifact(key="s3://bucket/api.tgz", digest="sha256:abc"),
                created_at="2026-06-19T10:00:00Z",
                created_by="service:publisher:ci",
                tags={"gitSha": "abc"},
            ),
        )
        self.assertEqual(
            client.calls,
            [
                (
                    "POST",
                    "/workspaces/ws-1/publishers/platform-ci/versions",
                    {
                        "workspaceId": "ws-1",
                        "componentId": "api",
                        "version": "1.2.3",
                        "artifact": {"key": "s3://bucket/api.tgz", "digest": "sha256:abc"},
                        "tags": {"gitSha": "abc"},
                    },
                )
            ],
        )

    def test_runner_next_and_report_component_status(self) -> None:
        client = FakeClient()
        runner = DeploymentRunnerClient(client, "runner-1")

        job = runner.next()
        self.assertIsInstance(job, DeployJob)
        runner.started(job)
        runner.completed("api")
        runner.failed("api", failure_reason="boom")

        self.assertEqual(client.calls[0], ("GET", "/workspaces/ws-1/deployment-runners/runner-1/executions/pending", None))
        self.assertEqual(client.calls[1], ("POST", "/workspaces/ws-1/deployment-runners/runner-1/executions/exec-1/items/api/claim", {}))
        self.assertEqual(
            client.calls[2],
            (
                "POST",
                "/workspaces/ws-1/deployment-runners/runner-1/executions/exec-1/items/api/status",
                {"status": "in-progress", "reportedAction": "deploy"},
            ),
        )
        self.assertEqual(
            client.calls[3],
            (
                "POST",
                "/workspaces/ws-1/deployment-runners/runner-1/executions/exec-1/items/api/status",
                {"status": "succeeded", "reportedAction": "deploy"},
            ),
        )
        self.assertEqual(
            client.calls[4],
            (
                "POST",
                "/workspaces/ws-1/deployment-runners/runner-1/executions/exec-1/items/api/status",
                {"status": "failed", "reportedAction": "deploy", "failureReason": "boom"},
            ),
        )

    def test_runner_cancel_is_removed(self) -> None:
        runner = DeploymentRunnerClient(FakeClient(), "runner-1")

        self.assertFalse(hasattr(runner, "cancel"))


def _execution(*, status: str = "claimed") -> dict[str, object]:
    return {
        "workspaceId": "ws-1",
        "deploymentId": "exec-1",
        "environmentId": "dev",
        "releaseId": "ds-1",
        "status": status,
        "requestedBy": "user:admin",
        "startedAt": "2026-06-19T10:00:00Z",
        "claimedBy": "runner-1",
        "items": [_component()],
    }


def _component(*, status: str = "pending", claimed_by: str | None = None) -> dict[str, object]:
    return {
        "workspaceId": "ws-1",
        "deploymentId": "exec-1",
        "environmentId": "dev",
        "releaseId": "platform",
        "componentId": "api",
        "version": "1.2.3",
        "artifact": {"key": "s3://bucket/api.tgz", "digest": "sha256:abc"},
        "requestedAction": "deploy",
        "status": status,
        "claimedBy": claimed_by,
    }


if __name__ == "__main__":
    unittest.main()


