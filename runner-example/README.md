# OneRelease Example Runner Package

This package contains a small custom runner implementation that uses `sdk/python`.

It is designed for local development and the Docker Compose stack in this repository.

## Run locally

```bash
pip install -e sdk/python -e runner-example
ONERELEASE_API_BASE_URL=http://localhost:8000 \
ONERELEASE_WORKSPACE_ID=default \
ONERELEASE_RUNNER_ID=package-runner-01 \
ONERELEASE_RUNNER_TOKEN=onerelease_pat_package_runner_01 \
python -m runner_example
```

The docker compose example uses `ONERELEASE_RUNNER_ID=docker-compose-runner-01` and `ONERELEASE_RUNNER_TOKEN=onerelease_pat_docker_compose_runner_01`.

## Environment

- `ONERELEASE_API_BASE_URL`
- `ONERELEASE_WORKSPACE_ID`
- `ONERELEASE_RUNNER_ID`
- `ONERELEASE_RUNNER_TOKEN`
- `ONERELEASE_RUNNER_DISPLAY_NAME`
- `ONERELEASE_RUNNER_POLL_SECONDS`
- `ONERELEASE_RUNNER_WORK_SECONDS`
