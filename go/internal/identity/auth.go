package identity

import "time"

type AuthMethod string

const (
	PATAuthMethod         AuthMethod = "pat"
	AccessTokenAuthMethod AuthMethod = "access_token"
)

type TokenFields struct {
	TokenHash      string
	TokenPrefix    string
	TokenCreatedAt string
	LastUsedAt     time.Time
}
