package environment

import (
	"github.com/ish10k/onerelease/internal/tag"
)

type Environment struct {
	WorkspaceID      string
	ID               string
	DisplayName      string
	Active           bool
	Tags             tag.Tags
	LastDeploymentID string
}
