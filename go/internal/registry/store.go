package registry

type Store interface {
	GetComponent(id string, workspaceID string) (*Component, error)
	ListComponents(workspaceID string) ([]Component, error)
	PutComponent(component Component) error

	GetRelease(id string, workspaceID string) (*Release, error)
	ListReleases(workspaceID string) ([]Release, error)
	PutRelease(release Release) error
	CreateRelease(release Release) error

	GetVersion(componentID string, version string, workspaceID string) (*ComponentVersion, error)
	ListVersionsByComponent(componentID string, workspaceID string) ([]ComponentVersion, error)
	CreateVersion(version ComponentVersion) error

	GetPublisher(id string, workspaceID string) (*Publisher, error)
	ListPublishers(workspaceID string) ([]Publisher, error)
	PutPublisher(publisher Publisher) error
}
