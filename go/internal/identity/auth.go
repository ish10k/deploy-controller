package identity

import "time"

type AuthMethod string

const (
	PATAuthMethod         AuthMethod = "PAT"
	AccessTokenAuthMethod AuthMethod = "AccessToken"
)

type TokenFields struct {
	TokenHash      string
	TokenPrefix    string
	TokenCreatedAt string
	LastUsedAt     time.Time
}
