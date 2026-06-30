package environment

type Store interface {
	Get(id string, workspaceID string) (*Environment, error)
	List(workspaceID string) ([]Environment, error)
	Put(environment Environment) error
}
