# DeploySet Controller

DeploySet Controller is a generic DeploySet control plane for managing desired component versions and deployment execution history.

The core acts as the brain: it stores components, ComponentSets, immutable releases, immutable DeploySets, generic environments, deployment executions, and environment state. Provider-specific target resolution, artifact interpretation, infrastructure inspection, and real deployment work belong in external adapters/runners.

## Core Invariant

A stored DeploySet is always complete and immutable. A create request may be partial, but missing required ComponentSet versions must be inferred from a base DeploySet or from the latest successful deployment state for an environment before the DeploySet is stored.

At deployment request time, no version inference happens. The brain creates execution items from the complete DeploySet and selects either:

- `deploy` when no latest item exists, the latest item did not succeed, the version changed, or `force=true`
- `skip` when the latest successful execution item already matches the requested version and `force=false`

Adapters may still report `noop` after inspecting their own target state. A forced same-version redeploy that succeeds is flagged as possible drift.

## Local API

```bash
pip install -e ".[dev]"
DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload
```

The in-memory backend starts with a richer local seed: `local`, `dev`, `staging`, `prod`, and `shared-data` environments; `local-platform` and `data-services` ComponentSets; multiple deploy sets (`local-default`, `local-hotfix`, `dev-default`, `staging-default`, `prod-default`, `prod-hotfix`, `data-default`); six components; and a realistic mix of successful, failed, and pending deployment history.

## AWS Lambda API

Use `src.interfaces.lambda_api.handler.handler` as the Lambda handler. This router does not use Mangum.

## Shape

- `src/domain/`: pure Pydantic models and planning rules
- `src/application/`: use cases and ports
- `src/infrastructure/`: memory and DynamoDB persistence
- `src/interfaces/`: FastAPI and API Gateway/Lambda entry points
- `../infra/terraform/`: DynamoDB, Lambda, HTTP API, IAM, CloudWatch, and artifact bucket infrastructure
