from dataclasses import dataclass

from src.application.use_cases.deployments import AdapterUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentSetUseCases,
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
)


@dataclass(frozen=True)
class Container:
    components: ComponentUseCases
    component_sets: ComponentSetUseCases
    releases: ReleaseUseCases
    deploysets: DeploySetUseCases
    environments: EnvironmentUseCases
    read_only: ReadOnlyUseCases
    plan_deployment: PlanDeploymentUseCase
    create_deployment: CreateDeploymentUseCase
    adapters: AdapterUseCases


