package registry

import "github.com/ish10k/onerelease/internal/audit"

type ComponentVersion struct {
	audit.Fields
	WorkspaceId string
	ComponentId string
	Version     string
	Description string
	Notes       string
	Artifact    Artifact
}

type Artifact struct {
	Key    string
	Digest string
}
