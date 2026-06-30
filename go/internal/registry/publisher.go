package registry

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/identity"
	"github.com/ish10k/onerelease/internal/tag"
)

type Publisher struct {
	audit.Fields
	identity.TokenFields
	WorkspaceId string
	PublisherId string
	DisplayName string
	PrincipalId string
	AuthMethod  identity.AuthMethod
	Active      bool
	Tag         tag.Tags
}
