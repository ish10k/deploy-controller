package runner

type Store interface {
	Get(id string, workspaceID string) (*Runner, error)
	List(workspaceID string) ([]Runner, error)
	Put(runner Runner) error
	CountActiveClaimsByRunner(runnerID string, workspaceID string) (int, error)
}
