import httpx

from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.webhooks import WebhookUseCases
from src.domain.enums import EventOrigin, Permission, PrincipalType, WebhookDeliveryStatus
from src.domain.models import AuthContext, EventLogEntry, Webhook, WebhookFilter, WebhookRetryPolicy, WebhookSubscription
from src.infrastructure.ids import EventIdGenerator, WebhookDeliveryIdGenerator
from src.infrastructure.memory.repositories import MemoryEventLogRepository, MemoryRepositories, MemoryWebhookDeliveryRepository, MemoryWebhookRepository
from src.infrastructure.time import SystemClock


class FailingHttpClient:
    def post(self, url: str, *, json: dict[str, object], timeout: float) -> httpx.Response:
        return httpx.Response(500, text="downstream failed")


def admin_context() -> AuthContext:
    return AuthContext(
        principalId="user:test-admin",
        principalType=PrincipalType.USER,
        authMethod="oidc",
        roles=["admin"],
        permissions=list(Permission),
        claims={},
    )


def test_webhook_subscriptions_create_one_delivery_per_matching_rule() -> None:
    store = MemoryRepositories()
    clock = SystemClock()
    webhooks = WebhookUseCases(
        webhooks=MemoryWebhookRepository(store),
        deliveries=MemoryWebhookDeliveryRepository(store),
        clock=clock,
        delivery_ids=WebhookDeliveryIdGenerator(),
        http_client=FailingHttpClient(),  # type: ignore[arg-type]
    )
    events = EventLogUseCases(
        events=MemoryEventLogRepository(store),
        clock=clock,
        id_generator=EventIdGenerator(),
        on_append=webhooks.enqueue_for_event,
    )
    webhooks.put(
        "version-events",
        Webhook(
            webhookId="ignored",
            displayName="Version events",
            url="https://example.com/webhook",
            active=True,
            retryPolicy=WebhookRetryPolicy(maxAttempts=2, backoffSeconds=60),
            subscriptions=[
                WebhookSubscription(subscriptionId="sub-version", eventTypes=["version.created"], filters=WebhookFilter(resourceTypes=["version"])),
                WebhookSubscription(subscriptionId="sub-audit", eventTypes=["eventlog.created"], filters=WebhookFilter(categories=["registry"])),
            ],
            createdAt=clock.now(),
            createdBy="user:test-admin",
        ),
        admin_context(),
    )

    events.append_actor(
        actor_principal_id="user:test-admin",
        action="version.created",
        category="registry",
        summary="Created version api 1.2.3",
        resource_type="version",
        resource_id="api@1.2.3",
        metadata={"token": "must-redact", "componentId": "api"},
    )

    deliveries = store.list_webhook_deliveries(webhook_id="version-events")
    assert len(deliveries) == 2
    assert {delivery.subscription_id for delivery in deliveries} == {"sub-version", "sub-audit"}
    assert {delivery.envelope.schema_version for delivery in deliveries} == {"webhook.v1"}
    assert {delivery.envelope.event_type for delivery in deliveries} == {"version.created"}
    assert all(delivery.status == WebhookDeliveryStatus.FAILED for delivery in deliveries)
    assert all(delivery.attempts == 1 for delivery in deliveries)
    assert all(delivery.next_attempt_at is not None for delivery in deliveries)
    assert all(delivery.envelope.metadata["token"] == "[redacted]" for delivery in deliveries)


def test_webhook_matching_honors_resource_filters() -> None:
    store = MemoryRepositories()
    webhooks = WebhookUseCases(
        webhooks=MemoryWebhookRepository(store),
        deliveries=MemoryWebhookDeliveryRepository(store),
        clock=SystemClock(),
        delivery_ids=WebhookDeliveryIdGenerator(),
        http_client=FailingHttpClient(),  # type: ignore[arg-type]
    )
    event = EventLogEntry(
        eventId="event-1",
        occurredAt="2026-06-18T12:00:00Z",
        actorPrincipalId="user:test-admin",
        actorType="user",
        origin=EventOrigin.USER,
        action="release.created",
        category="registry",
        summary="Created release",
        resourceType="release",
        resourceId="ds-1",
    )

    assert webhooks._matches(event, ["release.created"], {"resourceTypes": ["release"]})  # noqa: SLF001
    assert not webhooks._matches(event, ["release.created"], {"resourceTypes": ["version"]})  # noqa: SLF001


