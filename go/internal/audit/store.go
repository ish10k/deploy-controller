package audit

type ListQuery struct {
	Limit            int
	Cursor           string
	ActorPrincipalID string
	ResourceType     string
	ResourceID       string
	Category         string
	Action           string
	Origin           string
	FromTime         string
	ToTime           string
}

type Store interface {
	Append(event Event) error
	Get(id string) (*Event, error)
	List(query ListQuery) ([]Event, string, error)
}
