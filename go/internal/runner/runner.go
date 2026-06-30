package runner

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/identity"
	"github.com/ish10k/onerelease/internal/tag"
)

type Runner struct {
	audit.Fields
	identity.TokenFields
	WorkspaceID string
	ID          string
	DisplayName string
	PrincipalID string
	AuthMethod  identity.AuthMethod
	Active      bool
	Scope       Scope
	WebhookID   string
	Tags        tag.Tags
}

type Scope struct {
	EnvironmentIDs      []string
	ComponentIDs        []string
	ComponentTypes      []string
	ComponentTags       []string
	EnvironmentTags     []string
	MaxConcurrentClaims int
}
