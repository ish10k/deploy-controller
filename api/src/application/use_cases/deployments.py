from src.application.ports import (
    Clock,
    DeploymentExecutionRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    IdGenerator,
    ReleaseRepository,
)
from src.domain.enums import (
    EXECUTION_STATUSES,
    ITEM_STATUSES,
    REPORTED_ACTIONS,
    EnvironmentStatus,
    ExecutionStatus,
    ItemStatus,
    ReportedAction,
    RequestedAction,
)
from src.domain.errors import NotFoundError, ValidationError
from src.domain.models import (
    DeploymentExecution,
    DeploymentExecutionItem,
    DeploymentPlan,
    EnvironmentState,
)
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
    ) -> None:
        self.planner = planner
        self.executions = executions
        self.states = states
        self.clock = clock
        self.id_generator = id_generator

    def execute(
        self,
        *,
        environment_id: str,
        deployset_id: str,
        requested_by: str,
        notes: str | None = None,
        force: bool = False,
        tags: dict[str, str] | None = None,
    ) -> DeploymentExecution:
        plan = self.planner.execute(environment_id=environment_id, deployset_id=deployset_id, force=force)
        now = self.clock.now()
        execution = DeploymentExecution(
            deployment_execution_id=self.id_generator.new_id(),
            environment_id=environment_id,
            deployset_id=deployset_id,
            status=ExecutionStatus.PENDING,
            requested_by=requested_by,
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
        return execution


class AdapterUseCases:
    def __init__(
        self,
        *,
        executions: DeploymentExecutionRepository,
        states: EnvironmentStateRepository,
        clock: Clock,
    ) -> None:
        self.executions = executions
        self.states = states
        self.clock = clock

    def list_pending(self) -> list[DeploymentExecution]:
        return self.executions.list_pending()

    def claim(self, deployment_execution_id: str, claimed_by: str) -> DeploymentExecution:
        execution = self._get(deployment_execution_id)
        if execution.status != ExecutionStatus.PENDING:
            raise ValidationError(f"Execution is not pending: {deployment_execution_id}")
        updated = execution.model_copy(update={"status": ExecutionStatus.CLAIMED, "claimed_by": claimed_by})
        self.executions.put(updated)
        self._update_state(updated)
        return updated

    def report_item_status(
        self,
        *,
        deployment_execution_id: str,
        component_id: str,
        status: str,
        reported_action: str,
        reported_by: str,
        adapter_reason: str | None = None,
        message: str | None = None,
        error: str | None = None,
    ) -> DeploymentExecution:
        if status not in ITEM_STATUSES:
            raise ValidationError(f"Unsupported item status: {status}")
        if reported_action not in REPORTED_ACTIONS:
            raise ValidationError(f"Unsupported reported action: {reported_action}")
        status = ItemStatus(status)
        reported_action = ReportedAction(reported_action)

        execution = self._get(deployment_execution_id)
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
                        "adapter_reason": adapter_reason,
                        "drift_detected": drift_reason is not None,
                        "drift_reason": drift_reason,
                        "reported_by": reported_by,
                        "message": message,
                        "error": error,
                    }
                )
            )
        if not found:
            raise NotFoundError(f"Execution item not found: {deployment_execution_id}/{component_id}")
        updated = execution.model_copy(update={"items": updated_items})
        self.executions.put(updated)
        return updated

    def report_execution_status(self, deployment_execution_id: str, status: str) -> DeploymentExecution:
        if status not in EXECUTION_STATUSES:
            raise ValidationError(f"Unsupported execution status: {status}")
        status = ExecutionStatus(status)
        execution = self._get(deployment_execution_id)
        completed_at = (
            self.clock.now()
            if status in {ExecutionStatus.SUCCEEDED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED}
            else execution.completed_at
        )
        updated = execution.model_copy(update={"status": status, "completed_at": completed_at})
        self.executions.put(updated)
        self._update_state(updated)
        return updated

    def _get(self, deployment_execution_id: str) -> DeploymentExecution:
        execution = self.executions.get(deployment_execution_id)
        if execution is None:
            raise NotFoundError(f"DeploymentExecution not found: {deployment_execution_id}")
        return execution

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


