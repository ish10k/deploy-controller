package identity

type Role struct {
	WorkspaceId        string
	RoleId             string
	Permissions        []Permission
	Description        string
	PermissonsEditable bool
}
