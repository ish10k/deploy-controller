package identity

import (
	"time"

	"github.com/ish10k/onerelease/internal/audit"
	"github.com/ish10k/onerelease/internal/tag"
)

type Principal struct {
	audit.Fields
	ID              string
	Type            PrincipalType
	DisplayName     string
	Email           string
	ExternalIssuer  string
	ExternalSubject string
	Active          bool
	Roles           []string
	Tags            tag.Tags
	LastSeenAt      time.Time
}

type PrincipalType string

const (
	UserPrincipalType    PrincipalType = "user"
	ServicePrincipalType PrincipalType = "service"
)
