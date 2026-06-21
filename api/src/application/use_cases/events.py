import logging
from collections.abc import Callable
from typing import Any

from src.application.ports import Clock, EventLogRepository, IdGenerator
from src.domain.enums import EventOrigin, EventSeverity, Permission, PrincipalType
from src.domain.errors import ForbiddenError, NotFoundError
from src.domain.models import AuthContext, EventChange, EventLogEntry, EventLogListResult, EventResourceRef

logger = logging.getLogger(__name__)

REDACTED = "[redacted]"
SENSITIVE_FRAGMENTS = ("token", "secret", "password", "authorization", "hash", "claims")


def _safe_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: REDACTED if _sensitive(key) else _safe_value(child)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [_safe_value(item) for item in value]
    return value


def _sensitive(field: str) -> bool:
    normalized = field.replace("_", "").replace("-", "").lower()
    return any(fragment in normalized for fragment in SENSITIVE_FRAGMENTS)


def _dump(value: object | None) -> dict[str, Any]:
    if value is None:
        return {}
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True, mode="json")
    if isinstance(value, dict):
        return value
    return {"value": value}


def build_changes(before: object | None, after: object | None) -> list[EventChange]:
    left = _dump(before)
    right = _dump(after)
    changes: list[EventChange] = []
    for field in sorted(set(left) | set(right)):
        if _sensitive(field):
            continue
        before_value = _safe_value(left.get(field))
        after_value = _safe_value(right.get(field))
        if before_value != after_value:
            changes.append(EventChange(field=field, before=before_value, after=after_value))
    return changes


class EventLogUseCases:
    def __init__(
        self,
        *,
        events: EventLogRepository,
        clock: Clock,
        id_generator: IdGenerator,
        on_append: Callable[[EventLogEntry], None] | None = None,
    ) -> None:
        self.events = events
        self.clock = clock
        self.id_generator = id_generator
        self.on_append = on_append

    def append(
        self,
        *,
        actor_principal_id: str,
        actor_type: str,
        origin: EventOrigin,
        action: str,
        category: str,
        summary: str,
        resource_type: str,
        resource_id: str,
        before: object | None = None,
        after: object | None = None,
        related_resources: list[EventResourceRef] | None = None,
        metadata: dict[str, object] | None = None,
        severity: EventSeverity = EventSeverity.INFO,
        correlation_id: str | None = None,
        request_id: str | None = None,
    ) -> EventLogEntry | None:
        event = EventLogEntry(
            event_id=self.id_generator.new_id(),
            occurred_at=self.clock.now(),
            actor_principal_id=actor_principal_id,
            actor_type=actor_type,
            origin=origin,
            action=action,
            category=category,
            severity=severity,
            summary=summary,
            resource_type=resource_type,
            resource_id=resource_id,
            related_resources=related_resources or [],
            correlation_id=correlation_id,
            request_id=request_id,
            changes=build_changes(before, after),
            metadata=_safe_value(metadata or {}),
        )
        try:
            self.events.append(event)
            if self.on_append:
                self.on_append(event)
        except Exception:
            logger.exception("Failed to append event log entry: %s", event.action)
            return None
        return event

    def append_system(self, *, actor_principal_id: str, action: str, category: str, summary: str, resource_type: str, resource_id: str, **kwargs: Any) -> None:
        self.append(
            actor_principal_id=actor_principal_id,
            actor_type="system",
            origin=EventOrigin.SYSTEM,
            action=action,
            category=category,
            summary=summary,
            resource_type=resource_type,
            resource_id=resource_id,
            **kwargs,
        )

    def append_actor(self, *, actor_principal_id: str, action: str, category: str, summary: str, resource_type: str, resource_id: str, **kwargs: Any) -> None:
        if actor_principal_id.startswith("system:"):
            self.append_system(
                actor_principal_id=actor_principal_id,
                action=action,
                category=category,
                summary=summary,
                resource_type=resource_type,
                resource_id=resource_id,
                **kwargs,
            )
            return
        origin = EventOrigin.SERVICE if actor_principal_id.startswith("service:") else EventOrigin.USER
        actor_type = "service" if origin == EventOrigin.SERVICE else "user"
        self.append(
            actor_principal_id=actor_principal_id,
            actor_type=actor_type,
            origin=origin,
            action=action,
            category=category,
            summary=summary,
            resource_type=resource_type,
            resource_id=resource_id,
            **kwargs,
        )

    def append_for_context(self, context: AuthContext | None, **kwargs: Any) -> None:
        if context is None:
            self.append_system(actor_principal_id="system:unknown", **kwargs)
            return
        origin = EventOrigin.SERVICE if context.principal_type == PrincipalType.SERVICE else EventOrigin.USER
        self.append(
            actor_principal_id=context.principal_id,
            actor_type=str(context.principal_type),
            origin=origin,
            **kwargs,
        )

    def get(self, context: AuthContext, event_id: str) -> EventLogEntry:
        self._require_read(context)
        event = self.events.get(event_id)
        if event is None:
            raise NotFoundError(f"Event not found: {event_id}")
        return event

    def list(
        self,
        context: AuthContext,
        *,
        limit: int = 50,
        cursor: str | None = None,
        actor_principal_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        category: str | None = None,
        action: str | None = None,
        origin: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
    ) -> EventLogListResult:
        self._require_read(context)
        events, next_cursor = self.events.list(
            limit=max(1, min(limit, 200)),
            cursor=cursor,
            actor_principal_id=actor_principal_id,
            resource_type=resource_type,
            resource_id=resource_id,
            category=category,
            action=action,
            origin=origin,
            from_time=from_time,
            to_time=to_time,
        )
        return EventLogListResult(events=events, next_cursor=next_cursor)

    def _require_read(self, context: AuthContext) -> None:
        if Permission.EVENTS_READ not in context.permissions:
            raise ForbiddenError("Current principal cannot read events.")

