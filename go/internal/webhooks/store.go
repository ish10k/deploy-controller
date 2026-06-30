package webhooks

type DeliveryQuery struct {
	WebhookID    string
	EventID      string
	Status       DeliveryStatus
	ResourceType string
	ResourceID   string
}

type Store interface {
	Get(id string, workspaceID string) (*Webhook, error)
	List(workspaceID string) ([]Webhook, error)
	Put(webhook Webhook) error

	GetDelivery(id string, workspaceID string) (*Delivery, error)
	ListDeliveries(query DeliveryQuery, workspaceID string) ([]Delivery, error)
	PutDelivery(delivery Delivery) error
}
