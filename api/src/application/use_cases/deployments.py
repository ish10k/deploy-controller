from __future__ import annotations

from src.application.ports import (
    Clock,
    DeploymentExecutionRepository,
    DeploymentRunnerRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    IdGenerator,
    ReleaseRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.domain.enums import (
    ITEM_STATUSES,
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
    DeploymentExecution,
    DeploymentExecutionItem,
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


class PlanDeploymentUseCase:
    def __init__(
        self,
        *,
        deploysets: DeploySetRepository,
        releases: ReleaseRepository,
        environments: EnvironmentRepository,
        executions: DeploymentExecutionRepository,
    ) -> None:
        self.deploysets = deploysets
        self.releases = releases
        self.environments = environments
        self.executions = executions

    def execute(
        self,
        *,
        environment_id: str,
        deployset_id: str,
        force: bool = False,
    ) -> DeploymentPlan:
        deployset = self.deploysets.get(deployset_id)
        if deployset is None:
            raise NotFoundError(f"DeploySet not found: {deployset_id}")

        environment = self.environments.get(environment_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        if not environment.active:
            raise ValidationError(f"Environment is inactive: {environment_id}")

        latest = self.executions.latest_for_environment(environment_id)
        latest_by_component = {item.component_id: item for item in latest.items} if latest is not None else {}

        planned_items: list[DeploymentExecutionItem] = []
        for deployset_item in deployset.items:
            release = self.releases.get(deployset_item.component_id, deployset_item.version)
            if release is None:
                raise NotFoundError(f"Release not found: {deployset_item.component_id}/{deployset_item.version}")

            requested_action, status, reason = requested_action_for_item(
                requested_version=deployset_item.version,
                latest_item=latest_by_component.get(deployset_item.component_id),
                force=force,
            )
            planned_items.append(
                DeploymentExecutionItem(
                    component_id=deployset_item.component_id,
                    version=release.version,
                    artifact=release.artifact,
                    requested_action=requested_action,
                    reported_action=ReportedAction.SKIP if requested_action == RequestedAction.SKIP else None,
                    status=status,
                    requested_reason=reason,
                )
            )

        return DeploymentPlan(environment_id=environment_id, deployset_id=deployset_id, items=planned_items)


class CreateDeploymentUseCase:
    def __init__(
        self,
        *,
        planner: PlanDeploymentUseCase,
        executions: DeploymentExecutionRepository,
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
        deployset_id: str,
        context: AuthContext,
        notes: str | None = None,
        force: bool = False,
        tags: dict[str, str] | None = None,
    ) -> DeploymentExecution:
        require_permission(context, Permission.DEPLOYMENTS_CREATE)
        deployset = self.planner.deploysets.get(deployset_id)
        if deployset is None:
            raise NotFoundError(f"DeploySet not found: {deployset_id}")
        environment = self.planner.environments.get(environment_id)
        if environment is None:
            raise NotFoundError(f"Environment not found: {environment_id}")
        if not environment.active:
            raise ValidationError(f"Environment is inactive: {environment_id}")
        self._require_no_active_execution(environment_id, deployset.component_set_id)
        plan = self.planner.execute(environment_id=environment_id, deployset_id=deployset_id, force=force)
        now = self.clock.now()
        execution = DeploymentExecution(
            deployment_execution_id=self.id_generator.new_id(),
            environment_id=environment_id,
            deployset_id=deployset_id,
            status=ExecutionStatus.PENDING,
            requested_by=context.principal_id,
            notes=notes,
            force=force,
            started_at=now,
            completed_at=None,
            items=plan.items,
            tags=tags or {},
        )
        self.executions.create(execution)
        self.states.put(
            EnvironmentState(
                environment_id=environment_id,
                deployset_id=deployset_id,
                status=EnvironmentStatus.PENDING,
                last_deployment_execution_id=execution.deployment_execution_id,
                updated_at=now,
            )
        )
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment.created",
                category="deployment",
                summary=f"Created deployment execution {execution.deployment_execution_id}",
                resource_type="deploymentExecution",
                resource_id=execution.deployment_execution_id,
                after=execution,
                related_resources=[
                    EventResourceRef(resource_type="environment", resource_id=environment_id),
                    EventResourceRef(resource_type="deployset", resource_id=deployset_id),
                ],
                metadata={"environmentId": environment_id, "deploysetId": deployset_id, "force": force},
            )
        return execution

    def cancel(self, deployment_execution_id: str, context: AuthContext) -> DeploymentExecution:
        require_permission(context, Permission.DEPLOYMENTS_CANCEL)
        execution = self._get(deployment_execution_id)
        if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
            raise ValidationError(f"Execution cannot be cancelled: {deployment_execution_id}")
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
                summary=f"Cancelled deployment execution {deployment_execution_id}",
                resource_type="deploymentExecution",
                resource_id=deployment_execution_id,
                before=execution,
                after=updated,
                metadata={"status": str(ExecutionStatus.CANCELLED)},
            )
        return updated

    def _get(self, deployment_execution_id: str) -> DeploymentExecution:
        execution = self.executions.get(deployment_execution_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

    def _require_no_active_execution(self, environment_id: str, component_set_id: str) -> None:
        for execution in self.executions.list_by_environment(environment_id):
            if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
                continue
            deployset = self.planner.deploysets.get(execution.deployset_id)
            if deployset and deployset.component_set_id == component_set_id:
                raise ConflictError(
                    f"Deployment already in progress for environment and component set: {environment_id}/{component_set_id}"
                )

    def _update_state(self, execution: DeploymentExecution) -> None:
        self.states.put(
            EnvironmentState(
                environment_id=execution.environment_id,
                deployset_id=execution.deployset_id,
                status=execution.status,
                last_deployment_execution_id=execution.deployment_execution_id,
                updated_at=self.clock.now(),
            )
        )


class DeploymentRunnerUseCases:
    def __init__(
        self,
        *,
        runners: DeploymentRunnerRepository,
        executions: DeploymentExecutionRepository,
        deploysets: DeploySetRepository,
        states: EnvironmentStateRepository,
        clock: Clock,
        principals: PrincipalUseCases,
        events: EventLogUseCases | None = None,
    ) -> None:
        self.runners = runners
        self.executions = executions
        self.deploysets = deploysets
        self.states = states
        self.clock = clock
        self.principals = principals
        self.events = events

    def put(self, runner: DeploymentRunner, context: AuthContext) -> DeploymentRunner:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        existing = self.runners.get(runner.runner_id)
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

    def create(self, request: DeploymentRunnerCreateRequest, context: AuthContext) -> DeploymentRunnerCreateResult:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        existing = self.runners.get(request.runner_id)
        if existing is not None:
            raise ConflictError(f"DeploymentRunner already exists: {request.runner_id}")
        token, token_hash, token_prefix = issue_pat()
        now = self.clock.now()
        runner = DeploymentRunner(
            runner_id=request.runner_id,
            display_name=request.display_name,
            principal_id=f"service:deployment-runner:{request.runner_id}",
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

    def get(self, runner_id: str) -> DeploymentRunner:
        runner = self.runners.get(runner_id)
        if runner is None:
            raise NotFoundError(f"DeploymentRunner not found: {runner_id}")
        return runner

    def list(self) -> list[DeploymentRunner]:
        return self.runners.list()

    def rotate_token(self, runner_id: str, context: AuthContext) -> RotateTokenResult:
        require_permission(context, Permission.DEPLOYMENT_RUNNERS_WRITE)
        runner = self.get(runner_id)
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

    def heartbeat(self, runner_id: str, context: AuthContext) -> DeploymentRunner:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_REPORT_STATUS)
        runner = self.get(runner_id)
        updated = runner.model_copy(update={"last_heartbeat_at": self.clock.now()})
        self.runners.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=runner.principal_id,
                action="deployment_runner.heartbeat",
                category="runner",
                summary=f"Heartbeat from deployment runner {runner_id}",
                resource_type="deploymentRunner",
                resource_id=runner_id,
                before=runner,
                after=updated,
            )
        return updated

    def list_pending(self, runner_id: str) -> list[DeploymentExecution]:
        runner = self._active_runner(runner_id)
        return [execution for execution in self.executions.list_pending() if self._runner_allows_execution(runner, execution)]

    def claim(self, runner_id: str, deployment_execution_id: str, context: AuthContext, lease_seconds: int | None = None) -> DeploymentExecution:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_CLAIM)
        runner = self._active_runner(runner_id)
        execution = self._get(deployment_execution_id)
        self._require_scope(runner, execution)
        if execution.status != ExecutionStatus.PENDING:
            raise ValidationError(f"Execution is not pending: {deployment_execution_id}")
        updated = execution.model_copy(update={"status": ExecutionStatus.CLAIMED, "claimed_by": runner_id})
        self.executions.put(updated)
        self._update_state(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment.claimed",
                category="deployment",
                summary=f"Claimed deployment execution {deployment_execution_id}",
                resource_type="deploymentExecution",
                resource_id=deployment_execution_id,
                before=execution,
                after=updated,
                metadata={"runnerId": runner_id},
            )
        return updated

    def report_item_status(
        self,
        *,
        runner_id: str,
        deployment_execution_id: str,
        component_id: str,
        status: str,
        reported_action: str,
        context: AuthContext,
        reported_by: str | None = None,
        runner_reason: str | None = None,
        message: str | None = None,
        error: str | None = None,
    ) -> DeploymentExecution:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_REPORT_STATUS)
        if status not in ITEM_STATUSES:
            raise ValidationError(f"Unsupported item status: {status}")
        if reported_action not in REPORTED_ACTIONS:
            raise ValidationError(f"Unsupported reported action: {reported_action}")
        status = ItemStatus(status)
        reported_action = ReportedAction(reported_action)

        execution = self._get(deployment_execution_id)
        runner = self._active_runner(runner_id)
        self._require_scope(runner, execution)
        self._require_claimed_by_runner(runner_id, execution)
        self._require_execution_active(execution)
        previous_latest = self._previous_latest_item(execution, component_id)
        updated_items = []
        found = False
        for item in execution.items:
            if item.component_id != component_id:
                updated_items.append(item)
                continue
            found = True
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
                        "runner_reason": runner_reason,
                        "drift_detected": drift_reason is not None,
                        "drift_reason": drift_reason,
                        "reported_by": reported_by or runner_id,
                        "message": message,
                        "error": error,
                    }
                )
            )
        if not found:
            raise NotFoundError(f"Execution item not found: {deployment_execution_id}/{component_id}")
        updated = execution.model_copy(update={"items": updated_items})
        self.executions.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment_item.status_reported",
                category="deployment",
                summary=f"Reported {component_id} as {status} for execution {deployment_execution_id}",
                resource_type="deploymentExecution",
                resource_id=deployment_execution_id,
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

    def report_execution_status(self, runner_id: str, deployment_execution_id: str, status: str, context: AuthContext) -> DeploymentExecution:
        self._require_runner_permission(context, runner_id, Permission.EXECUTIONS_REPORT_STATUS)
        if status not in {ExecutionStatus.RUNNING, ExecutionStatus.SUCCEEDED, ExecutionStatus.FAILED}:
            raise ValidationError(f"Unsupported execution status: {status}")
        status = ExecutionStatus(status)
        execution = self._get(deployment_execution_id)
        runner = self._active_runner(runner_id)
        self._require_scope(runner, execution)
        self._require_claimed_by_runner(runner_id, execution)
        self._require_execution_active(execution)
        completed_at = (
            self.clock.now()
            if status in {ExecutionStatus.SUCCEEDED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED}
            else execution.completed_at
        )
        updated = execution.model_copy(update={"status": status, "completed_at": completed_at})
        self.executions.put(updated)
        self._update_state(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="deployment.status_changed",
                category="deployment",
                summary=f"Changed deployment execution {deployment_execution_id} to {status}",
                resource_type="deploymentExecution",
                resource_id=deployment_execution_id,
                before=execution,
                after=updated,
                metadata={"runnerId": runner_id, "status": str(status)},
            )
        return updated

    def _active_runner(self, runner_id: str) -> DeploymentRunner:
        runner = self.get(runner_id)
        if not runner.active:
            raise ValidationError(f"DeploymentRunner is inactive: {runner_id}")
        return runner

    def _require_runner_permission(self, context: AuthContext, runner_id: str, permission: Permission) -> None:
        require_permission(context, permission)
        if context.principal_type == PrincipalType.SERVICE and context.claims.get("runnerId") != runner_id:
            raise ForbiddenError(f"DeploymentRunner token cannot operate on another runner: {runner_id}")

    def _runner_allows_execution(self, runner: DeploymentRunner, execution: DeploymentExecution) -> bool:
        scope = runner.scope
        if scope.environment_ids and execution.environment_id not in scope.environment_ids:
            return False
        if scope.component_set_ids:
            deployset = self.deploysets.get(execution.deployset_id)
            return bool(deployset and deployset.component_set_id in scope.component_set_ids)
        return True

    def _require_scope(self, runner: DeploymentRunner, execution: DeploymentExecution) -> None:
        if not self._runner_allows_execution(runner, execution):
            raise ValidationError(f"DeploymentRunner scope does not allow execution: {execution.deployment_execution_id}")

    def _require_claimed_by_runner(self, runner_id: str, execution: DeploymentExecution) -> None:
        if execution.claimed_by != runner_id:
            raise ValidationError(f"Execution is not claimed by runner: {runner_id}")

    def _get(self, deployment_execution_id: str) -> DeploymentExecution:
        execution = self.executions.get(deployment_execution_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

    def _require_no_active_execution(self, environment_id: str, component_set_id: str) -> None:
        for execution in self.executions.list_by_environment(environment_id):
            if execution.status not in {ExecutionStatus.PENDING, ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
                continue
            deployset = self.planner.deploysets.get(execution.deployset_id)
            if deployset and deployset.component_set_id == component_set_id:
                raise ConflictError(
                    f"Deployment already in progress for environment and component set: {environment_id}/{component_set_id}"
                )

    def _require_execution_active(self, execution: DeploymentExecution) -> None:
        if execution.status not in {ExecutionStatus.CLAIMED, ExecutionStatus.RUNNING}:
            raise ValidationError(f"Execution is not active: {execution.deployment_execution_id}")

    def _previous_latest_item(
        self,
        execution: DeploymentExecution,
        component_id: str,
    ) -> DeploymentExecutionItem | None:
        for candidate in self.executions.list_by_environment(execution.environment_id):
            if candidate.deployment_execution_id == execution.deployment_execution_id:
                continue
            for item in candidate.items:
                if item.component_id == component_id:
                    return item
        return None

    def _update_state(self, execution: DeploymentExecution) -> None:
        self.states.put(
            EnvironmentState(
                environment_id=execution.environment_id,
                deployset_id=execution.deployset_id,
                status=execution.status,
                last_deployment_execution_id=execution.deployment_execution_id,
                updated_at=self.clock.now(),
            )
        )
