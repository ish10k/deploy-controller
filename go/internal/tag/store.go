package tag

type Store interface {
	Get(id string, workspaceID string) (*TagDefinition, error)
	List(workspaceID string) ([]TagDefinition, error)
	Put(tagDefinition TagDefinition) error
}
