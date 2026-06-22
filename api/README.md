# Release Controller

Release Controller is a generic Release control plane for managing desired component versions and deployment execution history.

The core acts as the brain: it stores components, Releases, immutable versions, immutable Releases, generic environments, publishers, deployment runners, deployment executions, and environment state. Provider-specific target resolution, artifact interpretation, infrastructure inspection, and real deployment work belong in external publisher / deployment runner processes.

## Core Invariant

A stored Release is always complete and immutable. A create request may be partial, but missing required Release versions must be inferred from a base Release or from the latest successful deployment state for an environment before the Release is stored.

At deployment request time, no version inference happens. The brain creates execution items from the complete Release and selects either:

- `deploy` when no latest item exists, the latest item did not succeed, the version changed, or `force=true`
- `skip` when the latest successful execution item already matches the requested version and `force=false`

Deployment runners may still report `noop` after inspecting their own target state. A forced same-version redeploy that succeeds is flagged as possible drift.

## Local API

```bash
pip install -e ".[dev]"
DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload
```

The in-memory backend starts with a richer local seed: `local`, `dev`, `staging`, `prod`, and `shared-data` environments; `2026.06.01` and `2026.06.03` Releases; multiple deploy sets (`2026.06.05`, `2026.06.06`, `2026.06.07`, `2026.06.08`, `2026.06.09`, `2026.06.10`); six components; and a realistic mix of successful, failed, and pending deployment history. Only the package runner and docker compose runner are seeded for deployment execution.

## Local OIDC

The repository root includes a Docker Compose stack with Keycloak as `local-oidc` and Postgres backing it:

```bash
docker compose up --build
```

OIDC defaults:

```txt
SETTLE_AUTH_MODE=oidc
SETTLE_OIDC_ISSUER=http://local-oidc:8080/realms/settle
SETTLE_OIDC_AUDIENCE=settle-api
SETTLE_OIDC_CLIENT_ID=settle-ui
SETTLE_OIDC_GROUPS_CLAIM=groups
SETTLE_OIDC_EMAIL_CLAIM=email
SETTLE_OIDC_NAME_CLAIM=name
SETTLE_OIDC_SUBJECT_CLAIM=sub
SETTLE_BOOTSTRAP_ALLOWED_EMAIL=admin@example.local
```

Seeded local OIDC users are `admin@example.local`, `deployer@example.local`, and `viewer@example.local`; each uses password `password`.

## AWS Lambda API

Use `src.interfaces.lambda_api.handler.handler` as the Lambda handler. This router does not use Mangum.

## Shape

- `src/domain/`: pure Pydantic models and planning rules
- `src/application/`: use cases and ports
- `src/infrastructure/`: memory and DynamoDB persistence
- `src/interfaces/`: FastAPI and API Gateway/Lambda entry points
- `../infra/terraform/`: DynamoDB, Lambda, HTTP API, IAM, CloudWatch, and artifact bucket infrastructure


