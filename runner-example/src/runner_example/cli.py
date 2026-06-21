from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass

from settle_sdk import DeploymentRunnerClient, SettleApiError, SettleClient
from settle_sdk.models import DeploymentItem


@dataclass(frozen=True)
class RunnerConfig:
    base_url: str
    workspace_id: str
    runner_id: str
    token: str
    display_name: str
    poll_seconds: float
    work_seconds: float


def load_config() -> RunnerConfig:
    runner_id = os.environ.get("SETTLE_RUNNER_ID", "").strip()
    token = os.environ.get("SETTLE_RUNNER_TOKEN", "").strip()
    base_url = os.environ.get("SETTLE_API_BASE_URL", "http://settle-server:8000").strip() or "http://settle-server:8000"
    if not runner_id:
        raise SystemExit("SETTLE_RUNNER_ID is required")
    if not token:
        raise SystemExit("SETTLE_RUNNER_TOKEN is required")

    return RunnerConfig(
        base_url=base_url,
        workspace_id=os.environ.get("SETTLE_WORKSPACE_ID", "default").strip() or "default",
        runner_id=runner_id,
        token=token,
        display_name=os.environ.get("SETTLE_RUNNER_DISPLAY_NAME", runner_id).strip() or runner_id,
        poll_seconds=_positive_float(os.environ.get("SETTLE_RUNNER_POLL_SECONDS"), default=3.0),
        work_seconds=_positive_float(os.environ.get("SETTLE_RUNNER_WORK_SECONDS"), default=1.0),
    )


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("SETTLE_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    config = load_config()
    client = SettleClient(config.base_url, token=config.token, workspace_id=config.workspace_id)
    runner = client.runner(config.runner_id)
    log = logging.getLogger("runner_example")
    log.info("runner %s starting for workspace %s", config.runner_id, config.workspace_id)

    while True:
        try:
            runner.heartbeat()
            job = runner.next()
        except SettleApiError as exc:
            log.warning("runner %s could not sync with the API: %s", config.runner_id, exc)
            time.sleep(config.poll_seconds)
            continue

        if job is None:
            log.info("runner %s is idle", config.runner_id)
            time.sleep(config.poll_seconds)
            continue

        process_job(log, runner, config, job)

        time.sleep(config.poll_seconds)


def process_job(
    log: logging.Logger,
    runner: DeploymentRunnerClient,
    config: RunnerConfig,
    job: DeploymentItem,
) -> None:
    log.info(
        "runner %s processing execution=%s component=%s version=%s",
        config.runner_id,
        job.deployment_id,
        job.component_id,
        job.version,
    )
    try:
        runner.started(job)
        log.info("runner %s working on %s", config.runner_id, job.component_id)
        time.sleep(config.work_seconds)
        runner.completed(job)
        log.info(
            "runner %s completed execution=%s component=%s",
            config.runner_id,
            job.deployment_id,
            job.component_id,
        )
    except SettleApiError as exc:
        log.exception(
            "runner %s failed while reporting execution=%s component=%s",
            config.runner_id,
            job.deployment_id,
            job.component_id,
        )
        try:
            runner.failed(job, failure_reason=str(exc))
        except SettleApiError as report_exc:
            log.warning(
                "runner %s could not report failure for execution=%s component=%s: %s",
                config.runner_id,
                job.deployment_id,
                job.component_id,
                report_exc,
            )


def _positive_float(raw_value: str | None, *, default: float) -> float:
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise SystemExit(f"invalid numeric value: {raw_value!r}") from exc
    if value <= 0:
        raise SystemExit("poll/work seconds must be greater than zero")
    return value
