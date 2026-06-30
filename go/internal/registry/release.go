package registry

import (
	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/tag"
)

type Release struct {
	audit.Fields
	WorkspaceId string
	ReleaseId   string
	Description string
	Notes       string
	Items       []ReleaseItem
	Tags        tag.Tags
}

type ReleaseItem struct {
	ComponentId string
	Version     string
	Source      ReleaseItemSource
}

type ReleaseItemSource string

const (
	ExplicitReleaseItemSource ReleaseItemSource = "Explicit"
	ImplicitReleaseItemSource ReleaseItemSource = "Implicit"
)
