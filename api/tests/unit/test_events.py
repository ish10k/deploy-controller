from src.application.use_cases.events import EventLogUseCases, build_changes
from src.composition.memory_container import build_memory_container
from src.domain.enums import EventOrigin, Permission, PrincipalType
from src.domain.models import AuthContext, EventLogEntry, Release
from src.infrastructure.memory.repositories import MemoryEventLogRepository, MemoryRepositories


class FixedClock:
    def __init__(self) -> None:
        self.counter = 0

    def now(self) -> str:
        self.counter += 1
        return f"2026-06-18T12:00:{self.counter:02d}Z"


class FixedIds:
    def __init__(self) -> None:
        self.counter = 0

    def new_id(self) -> str:
        self.counter += 1
        return f"event-{self.counter}"


def admin_context() -> AuthContext:
    return AuthContext(
        principal_id="user:admin",
        principal_type=PrincipalType.USER,
        auth_method="oidc",
        roles=["admin"],
        permissions=list(Permission),
        claims={},
    )


def test_build_changes_omits_secret_and_token_fields() -> None:
    changes = build_changes(
        {"displayName": "old", "tokenHash": "hash-a", "metadata": {"authorization": "Bearer a", "region": "eu"}},
        {"displayName": "new", "tokenHash": "hash-b", "metadata": {"authorization": "Bearer b", "region": "us"}},
    )

    assert [change.field for change in changes] == ["displayName", "metadata"]
    assert changes[1].before == {"authorization": "[redacted]", "region": "eu"}
    assert changes[1].after == {"authorization": "[redacted]", "region": "us"}


def test_memory_event_log_lists_newest_first_and_filters() -> None:
    store = MemoryRepositories()
    events = EventLogUseCases(events=MemoryEventLogRepository(store), clock=FixedClock(), id_generator=FixedIds())
    events.append_actor(
        actor_principal_id="user:admin",
        action="principal.updated",
        category="identity",
        summary="Updated user",
        resource_type="principal",
        resource_id="user:admin",
    )
    events.append_actor(
        actor_principal_id="service:runner",
        action="deployment.claimed",
        category="deployment",
        summary="Claimed execution",
        resource_type="deploymentExecution",
        resource_id="dep-1",
    )

    result = events.list(admin_context())
    assert [event.event_id for event in result.events] == ["event-2", "event-1"]

    deployment_result = events.list(admin_context(), category="deployment")
    assert [event.action for event in deployment_result.events] == ["deployment.claimed"]


def test_idempotent_release_create_does_not_emit_duplicate_event() -> None:
    store = MemoryRepositories()
    container = build_memory_container(store)
    release = Release(
        componentId="api",
        version="1.0.0",
        artifact={"key": "api:1.0.0", "digest": "sha256:abc"},
        source={"key": "git+https://git.example.com/api.git#1.0.0", "digest": "sha256:src-abc"},
        createdAt="2026-06-18T12:00:00Z",
        createdBy="ci",
    )

    container.releases.create(release, admin_context())
    container.releases.create(release, admin_context())

    release_events = [
        event
        for event in store.event_log.values()
        if event.action == "release.created" and event.resource_type == "release"
    ]
    assert len(release_events) == 1


def test_event_append_failure_does_not_escape() -> None:
    class BrokenRepository:
        def append(self, event: EventLogEntry) -> None:
            raise RuntimeError("nope")

        def get(self, event_id: str) -> EventLogEntry | None:
            return None

        def list(self, **kwargs: object) -> tuple[list[EventLogEntry], str | None]:
            return [], None

    events = EventLogUseCases(events=BrokenRepository(), clock=FixedClock(), id_generator=FixedIds())

    events.append(
        actor_principal_id="system:test",
        actor_type="system",
        origin=EventOrigin.SYSTEM,
        action="test.failed_append",
        category="test",
        summary="Should not raise",
        resource_type="test",
        resource_id="one",
    )
