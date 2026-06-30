package webhooks

import (
	"time"

	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/tag"
)

type RetryPolicy struct {
	MaxAttempts    int
	BackoffSeconds int
}

type Scope struct {
	ResourceTypes []string
	ResourceIDs   []string
	Categories    []string
	Origins       []string
	Severities    []string
}

type Subscription struct {
	SubscriptionID string
	EventTypes     []string
	Scope          Scope
}

type Webhook struct {
	audit.Fields
	WorkspaceID   string
	ID            string
	DisplayName   string
	URL           string
	Active        bool
	RetryPolicy   RetryPolicy
	Subscriptions []Subscription
	SecretRef     string
	Tags          tag.Tags
}

type Actor struct {
	PrincipalID string
	Type        string
	Origin      string
}

type Resource struct {
	Type string
	ID   string
}

type Envelope struct {
	SchemaVersion    string
	WorkspaceID      string
	DeliveryID       string
	WebhookID        string
	SubscriptionID   string
	EventID          string
	EventType        string
	OccurredAt       time.Time
	SentAt           *time.Time
	Attempt          int
	Actor            Actor
	Resource         Resource
	Data             map[string]any
	Metadata         map[string]any
}

type DeliveryStatus string

const (
	PendingDeliveryStatus   DeliveryStatus = "pending"
	SucceededDeliveryStatus DeliveryStatus = "succeeded"
	FailedDeliveryStatus    DeliveryStatus = "failed"
)

type Delivery struct {
	audit.Fields
	WorkspaceID            string
	ID                     string
	WebhookID              string
	SubscriptionID         string
	EventID                string
	EventType              string
	Status                 DeliveryStatus
	Envelope               Envelope
	Attempts               int
	NextAttemptAt          *time.Time
	LastResponseHTTPStatus int
	LastResponseBody       string
	LastError              string
}
