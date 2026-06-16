from src.domain.enums import DeploySetItemSource
from src.domain.models import (
    Artifact,
    Component,
    ComponentSet,
    ComponentSetItem,
    DeploySet,
    DeploySetItem,
    Environment,
    Release,
)
from src.infrastructure.memory.repositories import MemoryRepositories


def seed_local_data(store: MemoryRepositories) -> None:
    if store.components:
        return

    store.put_component(Component(component_id="api", type="ecs", active=True))
    store.put_component(Component(component_id="worker", type="lambda", active=True))
    store.put_component_set(
        ComponentSet(
            component_set_id="local-platform",
            description="Local deployables",
            components=[
                ComponentSetItem(component_id="api", required=True),
                ComponentSetItem(component_id="worker", required=True),
            ],
            tags={"team": "platform"},
            created_at="2026-06-16T12:00:00Z",
            created_by="seed",
        )
    )

    store.create_release(
        Release(
            component_id="api",
            version="1.0.0",
            artifact=Artifact(key="api:1.0.0", sha256="sha-api-100"),
            git_sha="src-api-100",
            created_at="2026-06-16T12:00:00Z",
            created_by="seed",
        )
    )
    store.create_release(
        Release(
            component_id="api",
            version="1.1.0",
            artifact=Artifact(key="api:1.1.0", sha256="sha-api-110"),
            git_sha="src-api-110",
            created_at="2026-06-16T12:10:00Z",
            created_by="seed",
        )
    )
    store.create_release(
        Release(
            component_id="worker",
            version="1.0.0",
            artifact=Artifact(key="worker:1.0.0", sha256="sha-worker-100"),
            git_sha="src-worker-100",
            created_at="2026-06-16T12:00:00Z",
            created_by="seed",
        )
    )
    store.create_release(
        Release(
            component_id="worker",
            version="1.1.0",
            artifact=Artifact(key="worker:1.1.0", sha256="sha-worker-110"),
            git_sha="src-worker-110",
            created_at="2026-06-16T12:10:00Z",
            created_by="seed",
        )
    )

    store.create_deployset(
        DeploySet(
            deployset_id="local-default",
            component_set_id="local-platform",
            schema_version=1,
            items=[
                DeploySetItem(component_id="api", version="1.1.0", source=DeploySetItemSource.EXPLICIT),
                DeploySetItem(component_id="worker", version="1.1.0", source=DeploySetItemSource.EXPLICIT),
            ],
            created_at="2026-06-16T12:01:00Z",
            created_by="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="local-hotfix",
            component_set_id="local-platform",
            schema_version=1,
            items=[
                DeploySetItem(component_id="api", version="1.0.0", source=DeploySetItemSource.EXPLICIT),
                DeploySetItem(component_id="worker", version="1.1.0", source=DeploySetItemSource.EXPLICIT),
            ],
            created_at="2026-06-16T12:02:00Z",
            created_by="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="dev-default",
            component_set_id="local-platform",
            schema_version=1,
            items=[
                DeploySetItem(component_id="api", version="1.0.0", source=DeploySetItemSource.EXPLICIT),
                DeploySetItem(component_id="worker", version="1.0.0", source=DeploySetItemSource.EXPLICIT),
            ],
            created_at="2026-06-16T12:03:00Z",
            created_by="seed",
        )
    )
    store.create_deployset(
        DeploySet(
            deployset_id="prod-default",
            component_set_id="local-platform",
            schema_version=1,
            items=[
                DeploySetItem(component_id="api", version="1.1.0", source=DeploySetItemSource.EXPLICIT),
                DeploySetItem(component_id="worker", version="1.0.0", source=DeploySetItemSource.EXPLICIT),
            ],
            created_at="2026-06-16T12:04:00Z",
            created_by="seed",
        )
    )

    store.put_environment(Environment(environment_id="local", provider_hint="local", active=True))
    store.put_environment(Environment(environment_id="dev", provider_hint="aws", active=True))
    store.put_environment(Environment(environment_id="prod", provider_hint="aws", active=True))
