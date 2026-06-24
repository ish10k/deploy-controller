# OneRelease Python SDK

Python SDK for machine actors that integrate with OneRelease.

The first SDK surface focuses on:

- deployment runners claiming work and reporting status
- publishers publishing versions

## Install

From this repository:

```bash
pip install -e sdk/python
```

## Runner

```python
from onerelease_sdk import OneReleaseClient

client = OneReleaseClient(
    base_url="http://localhost:8000",
    token="onerelease_pat_...",
    workspace_id="default",
)

runner = client.runner("local-runner")
components = runner.next()

if not components:
    raise SystemExit(0)

for component in components:
    runner.started(component)
    try:
        # deploy component.component_id at component.version
        runner.completed(component)
    except Exception as exc:
        runner.failed(component, failure_reason=str(exc))
        raise
```

For a complete runnable example that uses this SDK inside a custom package, see `runner-example/` and the matching Docker Compose services in the repo root.

## Publisher

```python
from onerelease_sdk import Artifact, Version, OneReleaseClient

client = OneReleaseClient("http://localhost:8000", token="onerelease_pat_...")
publisher = client.publisher("platform-ci")

version = publisher.publish(
    component_id="api",
    version="1.2.3",
    artifact=Artifact(key="s3://versions/api/1.2.3.tgz", digest="sha256:abc123"),
    description="API version",
    tags={"gitSha": "abc123"},
)

print(version.component_id, version.version)
```

## Notes

The runner SDK reports component statuses. Job status is derived by the control plane from claim state and component status reports. Cancellation is a control-plane action today, so the SDK exposes `cancel` as an explicit unsupported operation rather than pretending the runner can report it.

