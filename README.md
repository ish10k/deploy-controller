# DeploySet Controller

DeploySet Controller is a control-plane MVP for managing desired platform versions and producing deployment plans.

It intentionally does not deploy Lambda, ECS, or EC2/IIS workloads yet. The MVP stores registries/configuration, calculates plans, creates append-only deployment execution records, and updates environment state.

## Core Invariant

A component can noop only when all of these are true:

- latest execution item exists
- latest item status is `succeeded`
- latest item version equals the requested release version
- actual deployed SHA equals `Release.artifactSha256`

Everything else plans as `deploy`. For local MVP testing, `requireActualShaCheck=false` lets planning ignore the actual SHA comparison until real readers are implemented.

## Local API

```bash
pip install -e ".[dev]"
DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload
```

The in-memory backend starts with a small local seed: `local`, `dev`, and `prod` environments, several deploy sets (`local-default`, `local-hotfix`, `dev-default`, `prod-default`), `api` and `worker` components, and multiple releases and targets for each component.

## AWS Lambda API

Use `src.interfaces.lambda_api.handler.handler` as the Lambda handler. This router does not use Mangum.

## Shape

- `src/domain/`: pure Pydantic models and planning rules
- `src/application/`: use cases and ports
- `src/infrastructure/`: memory, DynamoDB, and artifact convention adapters
- `src/interfaces/`: FastAPI and API Gateway/Lambda entry points
- `infra/terraform/`: DynamoDB, Lambda, HTTP API, IAM, CloudWatch, and artifact bucket infrastructure
