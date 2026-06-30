package registry

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/tag"
)

type Release struct {
	audit.Fields
	WorkspaceID string
	ID          string
	Description string
	Notes       string
	Items       []ReleaseItem
	Tags        tag.Tags
}

type ReleaseItem struct {
	ComponentID string
	Version     string
	Source      ReleaseItemSource
}

type ReleaseItemSource string

const (
	ExplicitReleaseItemSource ReleaseItemSource = "explicit"
	ImplicitReleaseItemSource ReleaseItemSource = "implicit"
)
