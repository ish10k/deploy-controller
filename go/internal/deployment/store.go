package deployment

type Store interface {
	Get(id string, workspaceID string) (*Deployment, error)
	Create(deployment Deployment) error
	Put(deployment Deployment) error
	ListByEnvironment(environmentID string, workspaceID string) ([]Deployment, error)
	LatestForEnvironment(environmentID string, workspaceID string) (*Deployment, error)
	ListPending(workspaceID string) ([]Deployment, error)
}
