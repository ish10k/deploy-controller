from dataclasses import dataclass

from src.application.use_cases.deployments import CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentTargetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    TargetResolutionUseCases,
)


@dataclass(frozen=True)
class Container:
    components: ComponentUseCases
    releases: ReleaseUseCases
    deploysets: DeploySetUseCases
    environments: EnvironmentUseCases
    environment_targets: EnvironmentTargetUseCases
    target_resolutions: TargetResolutionUseCases
    read_only: ReadOnlyUseCases
    plan_deployment: PlanDeploymentUseCase
    create_deployment: CreateDeploymentUseCase

