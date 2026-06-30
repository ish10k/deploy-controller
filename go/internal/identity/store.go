package identity

type Store interface {
	GetPrincipal(id string) (*Principal, error)
	ListPrincipals() ([]Principal, error)
	PutPrincipal(principal Principal) error
	GetPrincipalByOIDC(externalIssuer string, externalSubject string) (*Principal, error)

	GetRole(id string, workspaceID string) (*Role, error)
	ListRoles(workspaceID string) ([]Role, error)
	PutRole(role Role) error
}
