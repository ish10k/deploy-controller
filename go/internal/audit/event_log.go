package audit

type Event struct {
	WorkspaceID      string
	EventID          string
	OccurredAt       string
	ActorPrincipalID string
	Action           string
	Category         string
	Severity         Severity
	Summary          string
	ResourceType     string
	ResourceID       string
	CorrelationID    string
	Metadata         map[string]any
}

type Severity string

const (
	InfoEventSeverity    = "info"
	WarningEventSeverity = "warning"
	ErrorEventSeverity   = "error"
)
