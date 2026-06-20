# Settle Example Runner Package

This package contains a small custom runner implementation that uses `sdk/python`.

It is designed for local development and the Docker Compose stack in this repository.

## Run locally

```bash
pip install -e sdk/python -e runner-example
SETTLE_API_BASE_URL=http://localhost:8000 \
SETTLE_WORKSPACE_ID=default \
SETTLE_RUNNER_ID=package-runner-01 \
SETTLE_RUNNER_TOKEN=settle_pat_package_runner_01 \
python -m runner_example
```

The docker compose example uses `SETTLE_RUNNER_ID=docker-compose-runner-01` and `SETTLE_RUNNER_TOKEN=settle_pat_docker_compose_runner_01`.

## Environment

- `SETTLE_API_BASE_URL`
- `SETTLE_WORKSPACE_ID`
- `SETTLE_RUNNER_ID`
- `SETTLE_RUNNER_TOKEN`
- `SETTLE_RUNNER_DISPLAY_NAME`
- `SETTLE_RUNNER_POLL_SECONDS`
- `SETTLE_RUNNER_WORK_SECONDS`
