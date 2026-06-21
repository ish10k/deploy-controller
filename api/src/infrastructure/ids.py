from uuid import uuid4


class UuidIdGenerator:
    def new_id(self) -> str:
        return uuid4().hex[:8]


class EventIdGenerator:
    def new_id(self) -> str:
        return f"event-{uuid4()}"


class WebhookDeliveryIdGenerator:
    def new_id(self) -> str:
        return f"whd-{uuid4()}"


class WebhookSubscriptionIdGenerator:
    def new_id(self) -> str:
        return f"sub-{uuid4()}"

