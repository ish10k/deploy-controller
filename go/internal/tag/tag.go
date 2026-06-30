package tag

import "github.com/ish10k/onerelease/internal/audit"

type Tags map[string]string

type TagDefinition struct {
	audit.Fields
	WorkspaceId   string
	Key           string
	Description   string
	DefaultValue  string
	AllowedValues []string
	Selector      TagDefinitionSelector
}

type TagDefinitionSelector struct {
	ResourceTypes []TagResourceType
}

type TagResourceType string

const (
	OrganisationTagResourceType TagResourceType = "Organisation"
	WorkspaceTagResourceType    TagResourceType = "Workspace"
	ComponmentTagResourceType   TagResourceType = "Component"
	ReleaseTagResourceType      TagResourceType = "Release"
	VersionTagResourceType      TagResourceType = "Version"
	DeploymentTagResourceType   TagResourceType = "Deployment"
	EnvironmentTagResourceType  TagResourceType = "Environment"
	RunnerTagResourceType       TagResourceType = "Runner"
	PublisherTagResourceType    TagResourceType = "Publisher"
	PrincipalTagResourceType    TagResourceType = "Principal"
	WebhookTagResourceType      TagResourceType = "Webhook"
)
