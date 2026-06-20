# Settle Python SDK

Python SDK for machine actors that integrate with Settle.

The first SDK surface focuses on:

- deployment runners claiming work and reporting status
- publishers publishing releases

## Install

From this repository:

```bash
pip install -e sdk/python
```

## Runner

```python
from settle_sdk import SettleClient

client = SettleClient(
    base_url="http://localhost:8000",
    token="pat_...",
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
from settle_sdk import Artifact, Release, SettleClient

client = SettleClient("http://localhost:8000", token="pat_...")
publisher = client.publisher("platform-ci")

release = publisher.publish(
    component_id="api",
    version="1.2.3",
    artifact=Artifact(key="s3://releases/api/1.2.3.tgz", digest="sha256:abc123"),
    description="API release",
    tags={"gitSha": "abc123"},
)

print(release.component_id, release.version)
```

## Notes

The runner SDK reports component statuses. Job status is derived by the control plane from claim state and component status reports. Cancellation is a control-plane action today, so the SDK exposes `cancel` as an explicit unsupported operation rather than pretending the runner can report it.
