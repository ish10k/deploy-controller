from src.domain.models import Component, DeploySet, Environment, EnvironmentTarget, Release, TargetResolution
from src.infrastructure.memory.repositories import MemoryRepositories


def seed_local_data(store: MemoryRepositories) -> None:
    if store.components:
        return

    store.put_component(Component(componentId="api", type="ecs", active=True))
    store.put_component(Component(componentId="worker", type="lambda", active=True))

    store.create_release(
        Release(
            componentId="api",
            version="1.0.0",
            artifactSha256="sha-api-100",
            sourceSha256="src-api-100",
            createdAt="2026-06-16T12:00:00Z",
            createdBy="seed",
        )
    )
    store.create_release(
        Release(
            componentId="api",
            version="1.1.0",
            artifactSha256="sha-api-110",
            sourceSha256="src-api-110",
            createdAt="2026-06-16T12:10:00Z",
            createdBy="seed",
        )
    )
    store.create_release(
        Release(
            componentId="worker",
            version="1.0.0",
            artifactSha256="sha-worker-100",
            sourceSha256="src-worker-100",
            createdAt="2026-06-16T12:00:00Z",
            createdBy="seed",
        )
    )
    store.create_release(
        Release(
            componentId="worker",
            version="1.1.0",
            artifactSha256="sha-worker-110",
            sourceSha256="src-worker-110",
            createdAt="2026-06-16T12:10:00Z",
            createdBy="seed",
        )
    )

    store.create_deployset(
        DeploySet(
            deploySetId="local-default",
            schemaVersion=1,
            items=[
                {"componentId": "api", "version": "1.1.0"},
                {"componentId": "worker", "version": "1.1.0"},
            ],
            createdAt="2026-06-16T12:01:00Z",
            createdBy="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deploySetId="local-hotfix",
            schemaVersion=1,
            items=[
                {"componentId": "api", "version": "1.0.0"},
                {"componentId": "worker", "version": "1.1.0"},
            ],
            createdAt="2026-06-16T12:02:00Z",
            createdBy="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deploySetId="dev-default",
            schemaVersion=1,
            items=[
                {"componentId": "api", "version": "1.0.0"},
                {"componentId": "worker", "version": "1.0.0"},
            ],
            createdAt="2026-06-16T12:03:00Z",
            createdBy="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deploySetId="prod-default",
            schemaVersion=1,
            items=[
                {"componentId": "api", "version": "1.1.0"},
                {"componentId": "worker", "version": "1.0.0"},
            ],
            createdAt="2026-06-16T12:04:00Z",
            createdBy="seed",
        )
    )

    store.put_environment(
        Environment(environmentId="local", awsAccountId="123456789012", region="eu-west-2", active=True)
    )
    store.put_environment(
        Environment(environmentId="dev", awsAccountId="123456789012", region="eu-west-2", active=True)
    )
    store.put_environment(
        Environment(environmentId="prod", awsAccountId="123456789012", region="eu-west-2", active=True)
    )
    store.put_environment_target(
        EnvironmentTarget(environmentId="local", componentId="api", type="ecs", targetKey="local/api")
    )
    store.put_environment_target(
        EnvironmentTarget(environmentId="local", componentId="worker", type="lambda", targetKey="local/worker")
    )
    store.put_environment_target(EnvironmentTarget(environmentId="dev", componentId="api", type="ecs", targetKey="dev/api"))
    store.put_environment_target(
        EnvironmentTarget(environmentId="dev", componentId="worker", type="lambda", targetKey="dev/worker")
    )
    store.put_environment_target(
        EnvironmentTarget(environmentId="prod", componentId="api", type="ecs", targetKey="prod/api")
    )
    store.put_environment_target(
        EnvironmentTarget(environmentId="prod", componentId="worker", type="lambda", targetKey="prod/worker")
    )
    store.put_target_resolution(
        TargetResolution(type="ecs", targetKey="local/api", target={"cluster": "local", "service": "api"})
    )
    store.put_target_resolution(
        TargetResolution(type="lambda", targetKey="local/worker", target={"functionName": "local-worker"})
    )
    store.put_target_resolution(TargetResolution(type="ecs", targetKey="dev/api", target={"cluster": "dev", "service": "api"}))
    store.put_target_resolution(
        TargetResolution(type="lambda", targetKey="dev/worker", target={"functionName": "dev-worker"})
    )
    store.put_target_resolution(
        TargetResolution(type="ecs", targetKey="prod/api", target={"cluster": "prod", "service": "api"})
    )
    store.put_target_resolution(
        TargetResolution(type="lambda", targetKey="prod/worker", target={"functionName": "prod-worker"})
    )
