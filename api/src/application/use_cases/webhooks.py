from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from src.application.ports import Clock, IdGenerator, WebhookDeliveryRepository, WebhookRepository
from src.application.use_cases.authorization import require_permission
from src.domain.enums import Permission, WebhookDeliveryStatus
from src.domain.errors import ForbiddenError, NotFoundError
from src.domain.models import (
    AuthContext,
    EventLogEntry,
    Webhook,
    WebhookActor,
    WebhookDelivery,
    WebhookEnvelope,
    WebhookResource,
)

logger = logging.getLogger(__name__)


class WebhookUseCases:
    def __init__(
        self,
        *,
        webhooks: WebhookRepository,
        deliveries: WebhookDeliveryRepository,
        clock: Clock,
        delivery_ids: IdGenerator,
        http_client: httpx.Client | None = None,
        dispatch_async: bool = False,
    ) -> None:
        self.webhooks = webhooks
        self.deliveries = deliveries
        self.clock = clock
        self.delivery_ids = delivery_ids
        self.http_client = http_client
        self.dispatch_async = dispatch_async
        self.events: Any | None = None

    def set_event_log(self, events: Any) -> None:
        self.events = events

    def list(self, context: AuthContext) -> list[Webhook]:
        self._require_read(context)
        return self.webhooks.list()

    def get(self, webhook_id: str, context: AuthContext) -> Webhook:
        self._require_read(context)
        webhook = self.webhooks.get(webhook_id)
        if webhook is None:
            raise NotFoundError(f"Webhook not found: {webhook_id}")
        return webhook

    def put(self, webhook_id: str, webhook: Webhook, context: AuthContext) -> Webhook:
        require_permission(context, Permission.WEBHOOKS_WRITE)
        existing = self.webhooks.get(webhook_id)
        now = self.clock.now()
        updated = webhook.model_copy(
            update={
                "webhook_id": webhook_id,
                "created_at": existing.created_at if existing else webhook.created_at,
                "created_by": existing.created_by if existing else context.principal_id,
                "updated_at": now if existing else webhook.updated_at,
            }
        )
        self.webhooks.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="webhook.created" if existing is None else "webhook.updated",
                category="integration",
                summary=f"{'Created' if existing is None else 'Updated'} webhook {webhook_id}",
                resource_type="webhook",
                resource_id=webhook_id,
                before=existing,
                after=updated,
            )
        return updated

    def list_deliveries(
        self,
        context: AuthContext,
        *,
        webhook_id: str | None = None,
        event_id: str | None = None,
        status: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> list[WebhookDelivery]:
        self._require_delivery_read(context)
        return self.deliveries.list(
            webhook_id=webhook_id,
            event_id=event_id,
            status=status,
            resource_type=resource_type,
            resource_id=resource_id,
        )

    def get_delivery(self, delivery_id: str, context: AuthContext) -> WebhookDelivery:
        self._require_delivery_read(context)
        delivery = self.deliveries.get(delivery_id)
        if delivery is None:
            raise NotFoundError(f"Webhook delivery not found: {delivery_id}")
        return delivery

    def retry_delivery(self, delivery_id: str, context: AuthContext) -> WebhookDelivery:
        require_permission(context, Permission.WEBHOOK_DELIVERIES_RETRY)
        delivery = self.deliveries.get(delivery_id)
        if delivery is None:
            raise NotFoundError(f"Webhook delivery not found: {delivery_id}")
        webhook = self.webhooks.get(delivery.webhook_id)
        if webhook is None:
            raise NotFoundError(f"Webhook not found: {delivery.webhook_id}")
        reset = delivery.model_copy(update={"status": WebhookDeliveryStatus.PENDING, "next_attempt_at": None, "last_error": None})
        self.deliveries.put(reset)
        return self.dispatch_delivery(reset, webhook)

    def enqueue_for_event(self, event: EventLogEntry) -> list[WebhookDelivery]:
        created: list[WebhookDelivery] = []
        for webhook in self.webhooks.list():
            if not webhook.active:
                continue
            for subscription in webhook.subscriptions:
                if not self._matches(event, subscription.event_types, subscription.filters.model_dump(by_alias=True, mode="json")):
                    continue
                delivery_id = self.delivery_ids.new_id()
                now = self.clock.now()
                envelope = WebhookEnvelope(
                    deliveryId=delivery_id,
                    webhookId=webhook.webhook_id,
                    subscriptionId=subscription.subscription_id,
                    eventId=event.event_id,
                    eventType=event.action,
                    occurredAt=event.occurred_at,
                    sentAt=None,
                    attempt=1,
                    actor=WebhookActor(principalId=event.actor_principal_id, type=event.actor_type, origin=str(event.origin)),
                    resource=WebhookResource(type=event.resource_type, id=event.resource_id),
                    relatedResources=event.related_resources,
                    data={"summary": event.summary},
                    changes=event.changes,
                    metadata=event.metadata,
                )
                delivery = WebhookDelivery(
                    webhookDeliveryId=delivery_id,
                    webhookId=webhook.webhook_id,
                    subscriptionId=subscription.subscription_id,
                    eventId=event.event_id,
                    eventType=event.action,
                    status=WebhookDeliveryStatus.PENDING,
                    envelope=envelope,
                    attempts=0,
                    createdAt=now,
                    updatedAt=now,
                )
                self.deliveries.put(delivery)
                created.append(delivery)
                self._dispatch_best_effort(delivery, webhook)
        return created

    def _dispatch_best_effort(self, delivery: WebhookDelivery, webhook: Webhook) -> None:
        if self.dispatch_async:
            thread = threading.Thread(target=self._dispatch_logged, args=(delivery, webhook), daemon=True)
            thread.start()
            return
        self._dispatch_logged(delivery, webhook)

    def _dispatch_logged(self, delivery: WebhookDelivery, webhook: Webhook) -> None:
        try:
            self.dispatch_delivery(delivery, webhook)
        except Exception:
            logger.exception("Failed to dispatch webhook delivery %s", delivery.webhook_delivery_id)

    def dispatch_delivery(self, delivery: WebhookDelivery, webhook: Webhook) -> WebhookDelivery:
        if delivery.attempts >= webhook.retry_policy.max_attempts:
            return delivery
        now = self.clock.now()
        attempt = delivery.attempts + 1
        envelope = delivery.envelope.model_copy(update={"sent_at": now, "attempt": attempt})
        try:
            response = self._post(webhook.url, envelope.model_dump(by_alias=True, mode="json"))
            status = WebhookDeliveryStatus.SUCCEEDED if 200 <= response.status_code < 300 else WebhookDeliveryStatus.FAILED
            next_attempt_at = None if status == WebhookDeliveryStatus.SUCCEEDED or attempt >= webhook.retry_policy.max_attempts else _add_seconds(now, webhook.retry_policy.backoff_seconds)
            updated = delivery.model_copy(
                update={
                    "status": status,
                    "envelope": envelope,
                    "attempts": attempt,
                    "next_attempt_at": next_attempt_at,
                    "last_response_status": response.status_code,
                    "last_response_body": response.text[:2000],
                    "last_error": None if status == WebhookDeliveryStatus.SUCCEEDED else response.text[:2000],
                    "updated_at": now,
                }
            )
        except Exception as exc:
            updated = delivery.model_copy(
                update={
                    "status": WebhookDeliveryStatus.FAILED,
                    "envelope": envelope,
                    "attempts": attempt,
                    "next_attempt_at": None if attempt >= webhook.retry_policy.max_attempts else _add_seconds(now, webhook.retry_policy.backoff_seconds),
                    "last_error": str(exc)[:2000],
                    "updated_at": now,
                }
            )
        self.deliveries.put(updated)
        return updated

    def _post(self, url: str, payload: dict[str, Any]) -> httpx.Response:
        if self.http_client is not None:
            return self.http_client.post(url, json=payload, timeout=5.0)
        with httpx.Client(timeout=5.0) as client:
            return client.post(url, json=payload)

    def _matches(self, event: EventLogEntry, event_types: list[str], filters: dict[str, Any]) -> bool:
        if event_types and event.action not in event_types and "eventlog.created" not in event_types and "*" not in event_types:
            return False
        checks = [
            ("resourceTypes", event.resource_type),
            ("resourceIds", event.resource_id),
            ("categories", event.category),
            ("origins", str(event.origin)),
            ("severities", str(event.severity)),
        ]
        return all(not filters.get(key) or value in filters[key] for key, value in checks)

    def _require_read(self, context: AuthContext) -> None:
        if Permission.WEBHOOKS_READ not in context.permissions and Permission.WEBHOOKS_WRITE not in context.permissions:
            raise ForbiddenError("Current principal cannot read webhooks.")

    def _require_delivery_read(self, context: AuthContext) -> None:
        if Permission.WEBHOOK_DELIVERIES_READ not in context.permissions and Permission.WEBHOOK_DELIVERIES_RETRY not in context.permissions:
            raise ForbiddenError("Current principal cannot read webhook deliveries.")


def _add_seconds(value: str, seconds: int) -> str:
    normalized = value.replace("Z", "+00:00")
    return (datetime.fromisoformat(normalized) + timedelta(seconds=seconds)).astimezone(UTC).isoformat().replace("+00:00", "Z")
