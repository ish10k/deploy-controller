package deployment

type DeploymentPlan struct {
	WorkspaceId   string
	EnvironmentId string
	ReleaseId     string
	Items         []DeploymentItem
}
