package identity

type Role struct {
	WorkspaceID         string
	ID                  string
	Permissions         []Permission
	Description         string
	PermissionsEditable bool
}
