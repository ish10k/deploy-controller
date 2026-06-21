from __future__ import annotations

from datetime import datetime, timedelta, UTC

from src.application.ports import (
    Clock,
    ComponentRepository,
    DeploymentRepository,
    DeploymentRunnerRepository,
    ReleaseRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    IdGenerator,
    VersionRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.domain.enums import (
    REPORTED_ACTIONS,
    EnvironmentStatus,
    ExecutionStatus,
    ItemStatus,
    Permission,
    PrincipalType,
    ReportedAction,
    RequestedAction,
)
from src.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from src.domain.models import (
    Deployment,
    DeploymentItem,
    DeploymentRunner,
    DeploymentRunnerCreateRequest,
    DeploymentRunnerCreateResult,
    DeploymentPlan,
    EnvironmentState,
    EventResourceRef,
    AuthContext,
    RotateTokenResult,
)
from src.application.use_cases.credentials import issue_pat
from src.application.use_cases.identity import PrincipalUseCases
from src.domain.planning import possible_drift_reason, requested_action_for_item


class RunnerEligibilityUseCases:
    def __init__(
        self,
        *,
        runners: DeploymentRunnerRepository,
        releases: ReleaseRepository,
        components: ComponentRepository,
        environments: EnvironmentRepository,
    ) -> None:
        self.runners = runners
        self.releases = releases
        self.components = components
        self.environments = environments

    def decorate_plan(self, plan: DeploymentPlan, workspace_id: str = "default") -> DeploymentPlan:
        return plan.model_copy(
            update={
                "items": [
                    item.model_copy(update={"runner_match_warning": self._should_warn_for_item(plan.environment_id, plan.release_id, item, workspace_id)})
                    for item in plan.items
                ]
            }
        )

    def decorate_execution(self, execution: Deployment, workspace_id: str = "default") -> Deployment:
        if execution.status in {ExecutionStatus.SUCCEEDED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED}:
            return execution.model_copy(update={"items": [item.model_copy(update={"runner_match_warning": False}) for item in execution.items]})
        return execution.model_copy(
            update={
                "items": [
                    item.model_copy(
                        update={"runner_match_warning": self._should_warn_for_item(execution.environment_id, execution.release_id, item, workspace_id)}
                    )
                    for item in execution.items
                ]
            }
        )

    def _should_warn_for_item(self, environment_id: str, release_id: str, item: DeploymentItem, workspace_id: str) -> bool:
        if item.requested_action != RequestedAction.DEPLOY or item.status != ItemStatus.PENDING:
            return False
        return not self._has_matching_runner(environment_id, release_id, item, workspace_id)

    def _has_matching_runner(self, environment_id: str, release_id: str, item: DeploymentItem, workspace_id: str) -> bool:
        for runner in self.runners.list(workspace_id):
            if self._runner_matches_item(runner, environment_id, release_id, item, workspace_id):
                return True
        return False

    def _runner_matches_item(
        self,
        runner: DeploymentRunner,
        environment_id: str,
        release_id: str,
        item: DeploymentItem,
        workspace_id: str,
    ) -> bool:
        if not runner.active:
            return False
        scope = runner.scope
        if scope.environment_ids and environment_id not in scope.environment_ids:
            return False
        if scope.component_ids and item.component_id not in scope.component_ids:
            return False
        if scope.component_types or scope.component_tags:
            component = self.components.get(item.component_id, workspace_id)
            if component is None:
                return False
            if scope.component_types and (component.type is None or component.type not in scope.component_types):
                return False
            for key, value in scope.component_tags.items():
                if component.tags.get(key) != value:
                    return False
        if scope.environment_tags:
            environment = self.environments.get(environment_id, workspace_id)
            if environment is None:
                return False
            for key, value in scope.environment_tags.items():
                if environment.tags.get(key) != value:
                    return False
        return True


class PlanDeploymentUseCase:
    def __init__(
        self,
        *,
        releases: ReleaseRepository,
        versions: VersionRepository,
        environments: EnvironmentRepository,
        executions: DeploymentRepository,
        runner_eligibility: RunnerEligibilityUseCases,
    ) -> None:
        self.releases = releases
        self.versions = versions
        self.environments = environments
        self.executions = executions
        self.runner_eligibility = runner_eligibility

    def execute(
        self,
        *,
        environment_id: str,
        release_id: str,
        workspace_id: str = "default",
        force: bool = False,
    ) -> DeploymentPlan:
        release = self.releases.get(release_id, workspace_id)
        if release is None:
            raise NotFoundError(f"Release not found: {release_id}")

        environment = self.environments.get(environment_id, workspace_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        if not environment.active:
            raise ValidationError(f"Environment is inactive: {environment_id}")

        latest = self.executions.latest_for_environment(environment_id, workspace_id)
        latest_by_component = {item.component_id: item for item in latest.items} if latest is not None else {}

        planned_items: list[DeploymentItem] = []
        for release_item in release.items:
            version = self.versions.get(release_item.component_id, release_item.version, workspace_id)
            if version is None:
                raise NotFoundError(f"Version not found: {release_item.component_id}/{release_item.version}")

            requested_action, status, reason = requested_action_for_item(
                requested_version=release_item.version,
                latest_item=latest_by_component.get(release_item.component_id),
                force=force,
            )
            planned_items.append(
                DeploymentItem(
                    component_id=release_item.component_id,
                    version=version.version,
                    artifact=version.artifact,
                    requested_action=requested_action,
                    reported_action=ReportedAction.SKIP if requested_action == RequestedAction.SKIP else None,
                    status=status,
                    requested_reason=reason,
                )
            )

        plan = DeploymentPlan(workspace_id=workspace_id, environment_id=environment_id, release_id=release_id, items=planned_items)
        return self.runner_eligibility.decorate_plan(plan, workspace_id)


class CreateDeploymentUseCase:
    def __init__(
        self,
        *,
        planner: PlanDeploymentUseCase,
        executions: DeploymentRepository,
        states: EnvironmentStateRepository,
        clock: Clock,
        id_generator: IdGenerator,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.planner = planner
        self.executions = executions
        self.states = states
        self.clock = clock
        self.id_generator = id_generator
        self.events = events

    def execute(
        self,
        *,
        environment_id: str,
        release_id: str,
        context: AuthContext,
        workspace_id: str = "default",
        notes: str | None = None,
        force: bool = False,
        tags: dict[str, str] | None = None,
    ) -> Deployment:
        require_permission(context, Permission.DEPLOYMENTS_CREATE)
        release = self.planner.releases.get(release_id, workspace_id)
        if release is None:
            raise NotFoundError(f"Release not found: {release_id}")
        environment = self.planner.environments.get(environment_id, workspace_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        if not environment.active:
            raise ValidationError(f"Environment is inactive: {environment_id}")
        self._require_no_active_execution(environment_id, release.release_id, workspace_id)
        plan = self.planner.execute(environment_id=environment_id, release_id=release_id, workspace_id=workspace_id, force=force)
        now = self.clock.now()
        deployment_id = self.id_generator.new_id()
        items = [
            item.model_copy(
                update={
                    "workspace_id": workspace_id,
                    "deployment_id": deployment_id,
                    "environment_id": environment_id,
                    "release_id": release.release_id,
                }
            )
            for item in plan.items
        ]
        execution = Deployment(
            workspace_id=workspace_id,
            deployment_id=deployment_id,
            environment_id=environment_id,
            release_id=release_id,
            status=ExecutionStatus.SUCCEEDED if items and all(item.status == ItemStatus.SKIPPED for item in items) else ExecutionStatus.PENDING,
            requested_by=context.principal_id,
            notes=notes,
            force=force,
            started_at=now,
            completed_at=now if items and all(item.status == ItemStatus.SKIPPED for item in items) else None,
            items=items,
            tags=tags or {},
        )
        self.executions.create(execution)
        self.states.put(
            EnvironmentState(
                workspace_id=workspace_id,
                environment_id=environment_id,
                release_id=release_id,
                status=EnvironmentStatus(execution.status),
                last_deployment_id=execution.deployment_id,
                updated_at=now,
            )
        )
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment.created",
                category="deployment",
                summary=f"Created deployment execution {execution.deployment_id}",
                resource_type="deployment",
                resource_id=execution.deployment_id,
                after=execution,
                related_resources=[
                    EventResourceRef(resource_type="environment", resource_id=environment_id),
                    EventResourceRef(resource_type="release", resource_id=release_id),
                ],
                metadata={"environmentId": environment_id, "releaseId": release_id, "force": force},
            )
        return execution

    def cancel(self, deployment_id: str, context: AuthContext, workspace_id: str = "default") -> Deployment:
        require_permission(context, Permission.DEPLOYMENTS_CANCEL)
        execution = self._get(deployment_id, workspace_id)
        if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
            raise ValidationError(f"Execution cannot be cancelled: {deployment_id}")
        now = self.clock.now()
        updated = execution.model_copy(
            update={
                "status": ExecutionStatus.CANCELLED,
                "completed_at": now,
            }
        )
        self.executions.put(updated)
        self._update_state(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment.status_changed",
                category="deployment",
                summary=f"Cancelled deployment execution {deployment_id}",
                resource_type="deployment",
                resource_id=deployment_id,
                before=execution,
                after=updated,
                metadata={"status": str(ExecutionStatus.CANCELLED)},
            )
        return updated

    def _get(self, deployment_id: str, workspace_id: str = "default") -> Deployment:
        execution = self.executions.get(deployment_id, workspace_id)
        if execution is None:
            raise NotFoundError(f"Deployment not found: {deployment_id}")
        return execution

    def _require_no_active_execution(self, environment_id: str, release_id: str, workspace_id: str) -> None:
        for execution in self.executions.list_by_environment(environment_id, workspace_id):
            if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
                continue
            release = self.planner.releases.get(execution.release_id, workspace_id)
            if release and release.release_id == release_id:
                raise ConflictError(
                    f"Deployment already in progress for environment and Release: {environment_id}/{release_id}"
                )

    def _update_state(self, execution: Deployment) -> None:
        self.states.put(
            EnvironmentState(
                workspace_id=execution.workspace_id,
                environment_id=execution.environment_id,
                release_id=execution.release_id,
                status=execution.status,
                last_deployment_id=execution.deployment_id,
                updated_at=self.clock.now(),
            )
        )


def _add_seconds(value: str, seconds: int) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return (parsed + timedelta(seconds=seconds)).astimezone(UTC).isoformat().replace("+00:00", "Z")


class DeploymentRunnerUseCases:
    def __init__(
        self,
        *,
        runners: DeploymentRunnerRepository,
        executions: DeploymentRepository,
        releases: ReleaseRepository,
        components: ComponentRepository,
        environments: EnvironmentRepository,
        states: EnvironmentStateRepository,
        clock: Clock,
        principals: PrincipalUseCases,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.runners = runners
        self.executions = executions
        self.releases = releases
        self.components = components
        self.environments = environments
        self.states = states
        self.clock = clock
        self.principals = principals
        self.events = events
        self.runner_eligibility = RunnerEligibilityUseCases(
            runners=runners,
            releases=releases,
            components=components,
            environments=environments,
        )

    def put(self, runner: DeploymentRunner, context: AuthContext, workspace_id: str = "default") -> DeploymentRunner:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        runner = runner.model_copy(update={"workspace_id": workspace_id})
        existing = self.runners.get(runner.runner_id, workspace_id)
        if existing is None:
            runner = runner.model_copy(update={"created_by": context.principal_id})
        self.runners.put(runner)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment_runner.created" if existing is None else "deployment_runner.updated",
                category="integration",
                summary=f"{'Created' if existing is None else 'Updated'} deployment runner {runner.runner_id}",
                resource_type="deploymentRunner",
                resource_id=runner.runner_id,
                before=existing,
                after=runner,
            )
        return runner

    def create(self, request: DeploymentRunnerCreateRequest, context: AuthContext, workspace_id: str = "default") -> DeploymentRunnerCreateResult:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        existing = self.runners.get(request.runner_id, workspace_id)
        if existing is not None:
            raise ConflictError(f"DeploymentRunner already exists: {request.runner_id}")
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        runner = DeploymentRunner(
            workspace_id=workspace_id,
            runner_id=request.runner_id,
            display_name=request.display_name,
            principal_id=f"service:workspace:{workspace_id}:deployment-runner:{request.runner_id}",
            auth_method="pat",
            token_hash=token_hash,
            token_prefix=token_prefix,
            token_created_at=now,
            token_rotated_at=None,
            last_used_at=None,
            active=request.active,
            scope=request.scope,
            webhook_id=request.webhook_id,
            last_heartbeat_at=None,
            tags=request.tags,
            created_at=now,
            created_by=context.principal_id,
        )
        self.principals.ensure_service_principal(
            principal_id=runner.principal_id,
            display_name=runner.display_name,
            role="deployment-runner",
            created_by="system:deployment-runner-create",
            tags=runner.tags,
        )
        self.runners.put(runner)
        if self.events:
            self.events.append_actor(
                actor_principal_id=runner.created_by,
                action="deployment_runner.created",
                category="integration",
                summary=f"Created deployment runner {runner.runner_id}",
                resource_type="deploymentRunner",
                resource_id=runner.runner_id,
                after=runner,
            )
        return DeploymentRunnerCreateResult(runner=runner, token=token)

    def get(self, runner_id: str, workspace_id: str = "default") -> DeploymentRunner:
        runner = self.runners.get(runner_id, workspace_id)
        if runner is None:
            raise NotFoundError(f"DeploymentRunner not found: {runner_id}")
        return runner

    def list(self, workspace_id: str = "default") -> list[DeploymentRunner]:
        return self.runners.list(workspace_id)

    def rotate_token(self, runner_id: str, context: AuthContext, workspace_id: str = "default") -> RotateTokenResult:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        runner = self.get(runner_id, workspace_id)
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        updated = runner.model_copy(
            update={
                "auth_method": "pat",
                "token_hash": token_hash,
                "token_prefix": token_prefix,
                "token_created_at": runner.token_created_at or now,
                "token_rotated_at": now,
            }
        )
        self.runners.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment_runner.token_rotated",
                category="security",
                summary=f"Rotated token for deployment runner {runner_id}",
                resource_type="deploymentRunner",
                resource_id=runner_id,
                before=runner,
                after=updated,
                metadata={"tokenPrefix": updated.token_prefix, "tokenRotatedAt": updated.token_rotated_at},
            )
        return RotateTokenResult(token=token)

    def heartbeat(self, runner_id: str, context: AuthContext, workspace_id: str = "default") -> DeploymentRunner:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_REPORT_STATUS)
        runner = self.get(runner_id, workspace_id)
        updated = runner.model_copy(update={"last_heartbeat_at": self.clock.now()})
        self.runners.put(updated)
        return updated

    def list_pending(self, runner_id: str, workspace_id: str = "default") -> list[DeploymentItem]:
        runner = self._active_runner(runner_id, workspace_id)
        items: list[DeploymentItem] = []
        remaining_capacity = self._remaining_capacity(runner)
        if remaining_capacity <= 0:
            return []
        for execution in self.executions.list_pending(workspace_id):
            for item in execution.items:
                if self._runner_can_claim_item(runner, execution, item):
                    items.append(item)
                    if len(items) >= remaining_capacity:
                        return items
        return items

    def list_items(self, runner_id: str, workspace_id: str = "default") -> list[DeploymentItem]:
        runner = self._active_runner(runner_id, workspace_id)
        items: list[DeploymentItem] = []
        for execution in self.executions.list_by_environment(None, workspace_id):
            for item in execution.items:
                if self._runner_allows_item(runner, execution, item):
                    items.append(item)
        return items

    def claim_item(
        self,
        runner_id: str,
        deployment_id: str,
        component_id: str,
        context: AuthContext,
        claim_timeout_seconds: int | None = None,
        workspace_id: str = "default",
    ) -> DeploymentItem:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_CLAIM)
        runner = self._active_runner(runner_id, workspace_id)
        execution = self._get(deployment_id, workspace_id)
        if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
            raise ValidationError(f"Execution is not pending: {deployment_id}")

        now = self.clock.now()
        claim_expires_at = _add_seconds(now, claim_timeout_seconds or 900)
        updated_items: list[DeploymentItem] = []
        claimed_item: DeploymentItem | None = None
        for item in execution.items:
            if item.component_id != component_id:
                updated_items.append(item)
                continue
            if item.status != ItemStatus.PENDING or item.claimed_by is not None:
                raise ConflictError(f"Execution item already claimed or not pending: {deployment_id}/{component_id}")
            if not self._runner_can_claim_item(runner, execution, item):
                raise ConflictError(f"Runner is not eligible to claim execution item: {runner_id}/{component_id}")
            claimed_item = item.model_copy(
                update={
                    "status": ItemStatus.CLAIMED,
                    "claimed_by": runner_id,
                    "claimed_at": now,
                    "claim_expires_at": claim_expires_at,
                    "claim_eligibility": self._claim_eligibility(runner, execution, item),
                }
            )
            updated_items.append(claimed_item)
        if claimed_item is None:
            raise NotFoundError(f"Execution item not found: {deployment_id}/{component_id}")

        updated = self._with_derived_status(execution.model_copy(update={"items": updated_items}))
        self.executions.put(updated)
        self._update_state(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment_item.claimed",
                category="deployment",
                summary=f"{runner_id} claimed {component_id} for deployment {deployment_id}",
                resource_type="deployment",
                resource_id=deployment_id,
                before=execution,
                after=updated,
                metadata={"runnerId": runner_id, "componentId": component_id},
            )
        return claimed_item

    def report_item_status(
        self,
        *,
        runner_id: str,
        deployment_id: str,
        component_id: str,
        status: str,
        reported_action: str,
        context: AuthContext,
        reported_by: str | None = None,
        failure_reason: str | None = None,
        workspace_id: str = "default",
    ) -> Deployment:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_REPORT_STATUS)
        if status not in {ItemStatus.RUNNING, ItemStatus.SUCCEEDED, ItemStatus.FAILED, ItemStatus.SKIPPED}:
            raise ValidationError(f"Unsupported item status: {status}")
        if reported_action not in REPORTED_ACTIONS:
            raise ValidationError(f"Unsupported reported action: {reported_action}")
        status = ItemStatus(status)
        reported_action = ReportedAction(reported_action)

        execution = self._get(deployment_id, workspace_id)
        runner = self._active_runner(runner_id, workspace_id)
        self._require_execution_active(execution)
        previous_latest = self._previous_latest_item(execution, component_id)
        updated_items = []
        found = False
        for item in execution.items:
            if item.component_id != component_id:
                updated_items.append(item)
                continue
            found = True
            self._require_item_claimed_by_runner(runner, runner_id, execution, item)
            drift_reason = possible_drift_reason(
                requested_version=item.version,
                latest_item=previous_latest,
                force=execution.force,
                reported_action=reported_action,
                status=status,
            )
            updated_items.append(
                item.model_copy(
                    update={
                        "status": status,
                        "reported_action": reported_action,
                        "failure_reason": failure_reason,
                        "claimed_by": item.claimed_by or runner_id,
                        "drift_detected": drift_reason is not None,
                        "drift_reason": drift_reason,
                        "reported_by": reported_by or runner_id,
                    }
                )
            )
        if not found:
            raise NotFoundError(f"Execution item not found: {deployment_id}/{component_id}")
        updated = self._with_derived_status(execution.model_copy(update={"items": updated_items}))
        self.executions.put(updated)
        self._update_state(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment_item.status_reported",
                category="deployment",
                summary=f"{component_id} {status} for deployment {deployment_id}",
                resource_type="deployment",
                resource_id=deployment_id,
                before=execution,
                after=updated,
                metadata={
                    "runnerId": runner_id,
                    "componentId": component_id,
                    "status": str(status),
                    "reportedAction": str(reported_action),
                },
            )
        return updated

    def _active_runner(self, runner_id: str, workspace_id: str = "default") -> DeploymentRunner:
        runner = self.get(runner_id, workspace_id)
        if not runner.active:
            raise ValidationError(f"DeploymentRunner is inactive: {runner_id}")
        return runner

    def _require_runner_permission(self, context: AuthContext, runner_id: str, permission: Permission) -> None:
        require_permission(context, permission)
        if context.principal_type == PrincipalType.SERVICE and context.claims.get("runnerId") != runner_id:
            raise ForbiddenError(f"DeploymentRunner token cannot operate on another runner: {runner_id}")

    def _runner_allows_execution(self, runner: DeploymentRunner, execution: Deployment) -> bool:
        scope = runner.scope
        if scope.environment_ids and execution.environment_id not in scope.environment_ids:
            return False
        return True

    def _runner_can_claim_item(self, runner: DeploymentRunner, execution: Deployment, item: DeploymentItem) -> bool:
        if item.status != ItemStatus.PENDING or item.claimed_by is not None or item.requested_action != RequestedAction.DEPLOY:
            return False
        if not self._runner_has_capacity(runner):
            return False
        return self._runner_allows_item(runner, execution, item)

    def _runner_allows_item(self, runner: DeploymentRunner, execution: Deployment, item: DeploymentItem) -> bool:
        if not self._runner_allows_execution(runner, execution):
            return False
        scope = runner.scope
        if scope.component_ids and item.component_id not in scope.component_ids:
            return False
        if not scope.component_types and not scope.component_tags:
            component_selector_matches = True
        else:
            component = self.components.get(item.component_id, execution.workspace_id)
            if component is None:
                return False
            if scope.component_types and (component.type is None or component.type not in scope.component_types):
                return False
            for key, value in scope.component_tags.items():
                if component.tags.get(key) != value:
                    return False
            component_selector_matches = True
        if scope.environment_tags:
            environment = self.environments.get(execution.environment_id, execution.workspace_id)
            if environment is None:
                return False
            for key, value in scope.environment_tags.items():
                if environment.tags.get(key) != value:
                    return False
        return component_selector_matches

    def _claim_eligibility(self, runner: DeploymentRunner, execution: Deployment, item: DeploymentItem) -> dict[str, object]:
        component = self.components.get(item.component_id, execution.workspace_id)
        environment = self.environments.get(execution.environment_id, execution.workspace_id)
        return {
            "componentType": component.type if component else None,
            "componentTags": component.tags if component else {},
            "environmentTags": environment.tags if environment else {},
            "runnerSelector": {
                "environmentIds": runner.scope.environment_ids,
                "componentIds": runner.scope.component_ids,
                "componentIds": runner.scope.component_ids,
                "componentTypes": runner.scope.component_types,
                "componentTags": runner.scope.component_tags,
                "environmentTags": runner.scope.environment_tags,
                "maxConcurrentClaims": runner.scope.max_concurrent_claims,
            },
        }

    def _runner_has_capacity(self, runner: DeploymentRunner) -> bool:
        return self._remaining_capacity(runner) > 0

    def _remaining_capacity(self, runner: DeploymentRunner) -> int:
        current_claims = 0
        for execution in self.executions.list_pending(runner.workspace_id):
            for item in execution.items:
                if item.claimed_by == runner.runner_id and item.status in {ItemStatus.CLAIMED, ItemStatus.RUNNING}:
                    current_claims += 1
        return runner.scope.max_concurrent_claims - current_claims

    def _require_item_claimed_by_runner(
        self,
        runner: DeploymentRunner,
        runner_id: str,
        execution: Deployment,
        item: DeploymentItem,
    ) -> None:
        if item.claimed_by != runner_id:
            raise ValidationError(f"Execution item is not claimed by runner: {runner_id}/{item.component_id}")

    def _get(self, deployment_id: str, workspace_id: str = "default") -> Deployment:
        execution = self.executions.get(deployment_id, workspace_id)
        if execution is None:
            raise NotFoundError(f"Deployment not found: {deployment_id}")
        return execution

    def _require_no_active_execution(self, environment_id: str, release_id: str) -> None:
        for execution in self.executions.list_by_environment(environment_id):
            if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
                continue
            release = self.planner.releases.get(execution.release_id)
            if release and release.release_id == release_id:
                raise ConflictError(
                    f"Deployment already in progress for environment and version set: {environment_id}/{release_id}"
                )

    def _require_execution_active(self, execution: Deployment) -> None:
        if execution.status not in {ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
            raise ValidationError(f"Execution is not active: {execution.deployment_id}")

    def _with_derived_status(self, execution: Deployment) -> Deployment:
        if execution.status == ExecutionStatus.CANCELLED:
            return execution
        statuses = [item.status for item in execution.items]
        if any(status == ItemStatus.FAILED for status in statuses):
            return execution.model_copy(update={"status": ExecutionStatus.FAILED, "completed_at": self.clock.now()})
        if statuses and all(status in {ItemStatus.SUCCEEDED, ItemStatus.SKIPPED} for status in statuses):
            return execution.model_copy(update={"status": ExecutionStatus.SUCCEEDED, "completed_at": self.clock.now()})
        if any(status in {ItemStatus.CLAIMED, ItemStatus.RUNNING} for status in statuses):
            return execution.model_copy(update={"status": ExecutionStatus.RUNNING})
        return execution.model_copy(update={"status": ExecutionStatus.PENDING})

    def _previous_latest_item(
        self,
        execution: Deployment,
        component_id: str,
    ) -> DeploymentItem | None:
        for candidate in self.executions.list_by_environment(execution.environment_id, execution.workspace_id):
            if candidate.deployment_id == execution.deployment_id:
                continue
            for item in candidate.items:
                if item.component_id == component_id:
                    return item
        return None

    def _update_state(self, execution: Deployment) -> None:
        self.states.put(
            EnvironmentState(
                workspace_id=execution.workspace_id,
                environment_id=execution.environment_id,
                release_id=execution.release_id,
                status=execution.status,
                last_deployment_id=execution.deployment_id,
                updated_at=self.clock.now(),
            )
        )





