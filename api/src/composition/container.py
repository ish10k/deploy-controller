from dataclasses import dataclass

from src.application.use_cases.deployments import DeploymentRunnerUseCases, CreateDeploymentUseCase, PlanDeploymentUseCase
from src.application.use_cases.registry import (
    ComponentSetUseCases,
    ComponentUseCases,
    DeploySetUseCases,
    EnvironmentUseCases,
    ReadOnlyUseCases,
    ReleaseUseCases,
    PublisherUseCases,
    TagDefinitionUseCases,
)
from src.application.use_cases.identity import PrincipalUseCases
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.roles import RoleUseCases
from src.application.use_cases.tenancy import OrganizationUseCases, WorkspaceUseCases
from src.application.use_cases.webhooks import WebhookUseCases


@dataclass(frozen=True)
class Container:
    components: ComponentUseCases
    component_sets: ComponentSetUseCases
    releases: ReleaseUseCases
    publishers: PublisherUseCases
    deploysets: DeploySetUseCases
    environments: EnvironmentUseCases
    tag_definitions: TagDefinitionUseCases
    read_only: ReadOnlyUseCases
    plan_deployment: PlanDeploymentUseCase
    create_deployment: CreateDeploymentUseCase
    deployment_runners: DeploymentRunnerUseCases
    principals: PrincipalUseCases
    roles: RoleUseCases
    organizations: OrganizationUseCases
    workspaces: WorkspaceUseCases
    events: EventLogUseCases
    webhooks: WebhookUseCases
