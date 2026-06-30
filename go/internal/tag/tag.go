package tag

import "github.com/ish10k/onerelease/internal/audit"

type Tags map[string]string

type TagDefinition struct {
	audit.Fields
	WorkspaceID   string
	ID            string
	Description   string
	DefaultValue  string
	AllowedValues []string
	Scope         TagDefinitionScope
}

type TagDefinitionScope struct {
	ResourceTypes []TagResourceType
}

type TagResourceType string

const (
	OrganisationTagResourceType TagResourceType = "organisation"
	WorkspaceTagResourceType    TagResourceType = "workspace"
	ComponentTagResourceType    TagResourceType = "component"
	ReleaseTagResourceType      TagResourceType = "release"
	VersionTagResourceType      TagResourceType = "version"
	DeploymentTagResourceType   TagResourceType = "deployment"
	EnvironmentTagResourceType  TagResourceType = "environment"
	RunnerTagResourceType       TagResourceType = "runner"
	PublisherTagResourceType    TagResourceType = "publisher"
	PrincipalTagResourceType    TagResourceType = "principal"
	WebhookTagResourceType      TagResourceType = "webhook"
)
