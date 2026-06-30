package registry

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/tag"
)

type Component struct {
	audit.Fields
	WorkspaceID string
	ID          string
	Type        string
	Active      bool
	Tags        tag.Tags
}
