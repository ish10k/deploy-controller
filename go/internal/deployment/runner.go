package deployment

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/identity"
	"github.com/ish10k/onerelease/internal/tag"
)

type Runner struct {
	audit.Fields
	identity.TokenFields
	WorkspaceId string
	RunnerId    string
	DisplayName string
	PrincipalId string
	AuthMethod  identity.AuthMethod
	Active      bool
	Scope       RunnerScope
	WebhookId   string
	Tags        tag.Tags
}

type RunnerScope struct {
	EnvironmentIds       []string
	ComponentIds         []string
	ComponentTypes       []string
	ComponentTags        []string
	EnvironemntTags      []string
	MaxConcurrencyClaims []string
}
