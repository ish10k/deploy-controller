from src.application.ports import (
    ActualShaReader,
    ArtifactResolver,
    Clock,
    ComponentRepository,
    DeploymentExecutionRepository,
    DeploySetRepository,
    EnvironmentRepository,
    EnvironmentStateRepository,
    EnvironmentTargetRepository,
    IdGenerator,
    ReleaseRepository,
    TargetResolutionRepository,
)
from src.domain.errors import NotFoundError, ValidationError
from src.domain.models import (
    DeploymentExecution,
    DeploymentExecutionItem,
    DeploymentPlan,
    EnvironmentState,
)
from src.domain.planning import should_deploy


class PlanDeploymentUseCase:
    def __init__(
        self,
        *,
        deploysets: DeploySetRepository,
        releases: ReleaseRepository,
        environments: EnvironmentRepository,
        components: ComponentRepository,
        environment_targets: EnvironmentTargetRepository,
        target_resolutions: TargetResolutionRepository,
        executions: DeploymentExecutionRepository,
        artifact_resolver: ArtifactResolver,
        actual_sha_reader: ActualShaReader,
    ) -> None:
        self.deploysets = deploysets
        self.releases = releases
        self.environments = environments
        self.components = components
        self.environment_targets = environment_targets
        self.target_resolutions = target_resolutions
        self.executions = executions
        self.artifact_resolver = artifact_resolver
        self.actual_sha_reader = actual_sha_reader

    def execute(
        self,
        *,
        environment_id: str,
        deployset_id: str,
        require_actual_sha_check: bool = True,
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
            component = self.components.get(deployset_item.component_id)
            if component is None:
                raise NotFoundError(f"Component not found: {deployset_item.component_id}")
            if not component.active:
                raise ValidationError(f"Component is inactive: {component.component_id}")

            release = self.releases.get(component.component_id, deployset_item.version)
            if release is None:
                raise NotFoundError(f"Release not found: {component.component_id}/{deployset_item.version}")

            target = self.environment_targets.get(environment_id, component.component_id)
            if target is None:
                raise NotFoundError(f"EnvironmentTarget not found: {environment_id}/{component.component_id}")
            if target.type != component.type:
                raise ValidationError(f"EnvironmentTarget type does not match component type: {component.component_id}")

            resolution = self.target_resolutions.get(component.type, target.target_key)
            if resolution is None:
                raise NotFoundError(f"TargetResolution not found: {component.type}/{target.target_key}")

            self.artifact_resolver.resolve(
                component_type=component.type,
                component_id=component.component_id,
                version=release.version,
                artifact_sha256=release.artifact_sha256,
            )
            actual_sha = self.actual_sha_reader.read_actual_sha256(
                component_type=component.type,
                target_key=target.target_key,
            )
            deploy, reason = should_deploy(
                requested_version=deployset_item.version,
                release_artifact_sha=release.artifact_sha256,
                latest_item=latest_by_component.get(component.component_id),
                actual_sha=actual_sha,
                require_actual_sha_check=require_actual_sha_check,
            )
            planned_items.append(
                DeploymentExecutionItem(
                    componentId=component.component_id,
                    version=release.version,
                    artifactSha256=release.artifact_sha256,
                    actualSha256=actual_sha,
                    action="deploy" if deploy else "noop",
                    status="pending" if deploy else "succeeded",
                    reason=reason,
                )
            )

        return DeploymentPlan(environmentId=environment_id, deploySetId=deployset_id, items=planned_items)


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
        require_actual_sha_check: bool = True,
    ) -> DeploymentExecution:
        plan = self.planner.execute(
            environment_id=environment_id,
            deployset_id=deployset_id,
            require_actual_sha_check=require_actual_sha_check,
        )
        now = self.clock.now()
        execution = DeploymentExecution(
            deploymentExecutionId=self.id_generator.new_id(),
            environmentId=environment_id,
            deploySetId=deployset_id,
            status="planned",
            requestedBy=requested_by,
            startedAt=now,
            completedAt=None,
            items=plan.items,
        )
        self.executions.create(execution)
        self.states.put(
            EnvironmentState(
                environmentId=environment_id,
                deploySetId=deployset_id,
                status="planned",
                lastDeploymentExecutionId=execution.deployment_execution_id,
                updatedAt=now,
            )
        )
        return execution
