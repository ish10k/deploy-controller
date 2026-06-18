from __future__ import annotations

from src.application.ports import RoleRepository
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.domain.enums import Permission
from src.domain.errors import ConflictError, NotFoundError
from src.domain.models import AuthContext, Role

ADMIN_ROLE = "admin"
LEGACY_PLATFORM_ADMIN = "platform-admin"
ADMIN_ROLE_ALIASES = {ADMIN_ROLE, LEGACY_PLATFORM_ADMIN}

DEFAULT_ROLES: dict[str, Role] = {
    ADMIN_ROLE: Role(
        roleId=ADMIN_ROLE,
        description="Full platform administration. This role is system-managed.",
        permissions=list(Permission),
        system=True,
        permissionsEditable=False,
    ),
    LEGACY_PLATFORM_ADMIN: Role(
        roleId=LEGACY_PLATFORM_ADMIN,
        description="Legacy admin role retained for compatibility.",
        permissions=list(Permission),
        system=True,
        permissionsEditable=False,
    ),
    "platform-deployer": Role(
        roleId="platform-deployer",
        description="Can read deployment metadata and create deployments.",
        permissions=[
            Permission.COMPONENTS_READ,
            Permission.COMPONENT_SETS_READ,
            Permission.RELEASES_READ,
            Permission.DEPSETS_READ,
            Permission.DEPLOYMENTS_READ,
            Permission.DEPLOYMENTS_CREATE,
        ],
        system=True,
    ),
    "platform-viewer": Role(
        roleId="platform-viewer",
        description="Read-only platform visibility, including the audit event log.",
        permissions=[
            Permission.COMPONENTS_READ,
            Permission.COMPONENT_SETS_READ,
            Permission.RELEASES_READ,
            Permission.DEPSETS_READ,
            Permission.ENVIRONMENTS_READ,
            Permission.DEPLOYMENTS_READ,
            Permission.EVENTS_READ,
            Permission.WEBHOOKS_READ,
            Permission.WEBHOOK_DELIVERIES_READ,
        ],
        system=True,
    ),
    "deployment-runner": Role(
        roleId="deployment-runner",
        description="Service role for deployment runners.",
        permissions=[
            Permission.EXECUTIONS_CLAIM,
            Permission.EXECUTIONS_REPORT_STATUS,
        ],
        system=True,
    ),
    "release-source": Role(
        roleId="release-source",
        description="Service role for external release publishers.",
        permissions=[
            Permission.RELEASES_CREATE,
            Permission.RELEASE_SOURCES_PUBLISH,
        ],
        system=True,
    ),
}


def normalize_roles(roles: list[str]) -> list[str]:
    normalized = [ADMIN_ROLE if role == LEGACY_PLATFORM_ADMIN else role for role in roles]
    return list(dict.fromkeys(normalized))


def has_admin_role(role_ids: list[str]) -> bool:
    return any(role in ADMIN_ROLE_ALIASES for role in role_ids)


def permissions_for_roles(role_ids: list[str], roles: list[Role] | None = None) -> list[Permission]:
    if roles is None:
        role_map = DEFAULT_ROLES
    else:
        role_map = {role.role_id: role for role in roles}
        for role_id, role in DEFAULT_ROLES.items():
            role_map.setdefault(role_id, role)
    values = {permission for role_id in role_ids for permission in role_map.get(role_id, Role(roleId=role_id, permissions=[])).permissions}
    return sorted(values, key=str)


class RoleUseCases:
    def __init__(self, *, roles: RoleRepository, events: EventLogUseCases | None = None) -> None:
        self.roles = roles
        self.events = events
        self.ensure_defaults()

    def ensure_defaults(self) -> None:
        for role in DEFAULT_ROLES.values():
            existing = self.roles.get(role.role_id)
            if existing is None:
                self.roles.put(role)
                continue
            if not existing.permissions_editable:
                self.roles.put(role)

    def list(self, context: AuthContext) -> list[Role]:
        require_permission(context, Permission.ROLES_READ)
        return self.list_unchecked()

    def list_unchecked(self) -> list[Role]:
        return sorted(
            [role for role in self.roles.list() if role.role_id != LEGACY_PLATFORM_ADMIN],
            key=lambda role: role.role_id,
        )

    def get(self, role_id: str, context: AuthContext) -> Role:
        require_permission(context, Permission.ROLES_READ)
        role = self.roles.get(role_id)
        if role is None and role_id == ADMIN_ROLE:
            role = self.roles.get(LEGACY_PLATFORM_ADMIN)
        if role is None:
            raise NotFoundError(f"Role not found: {role_id}")
        if role.role_id == LEGACY_PLATFORM_ADMIN:
            role = role.model_copy(update={"role_id": ADMIN_ROLE})
        return role

    def put(self, role_id: str, role: Role, context: AuthContext) -> Role:
        require_permission(context, Permission.ROLES_WRITE)
        role_id = ADMIN_ROLE if role_id == LEGACY_PLATFORM_ADMIN else role_id
        existing = self.roles.get(role_id)
        if existing and not existing.permissions_editable:
            raise ConflictError(f"Role permissions are system-managed: {role_id}")
        if role_id in ADMIN_ROLE_ALIASES:
            raise ConflictError("The admin role is system-managed.")

        updated = role.model_copy(update={"role_id": role_id, "system": existing.system if existing else False, "permissions_editable": True})
        self.roles.put(updated)
        if self.events:
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action="role.updated" if existing else "role.created",
                category="identity",
                summary=f"{'Updated' if existing else 'Created'} role {role_id}",
                resource_type="role",
                resource_id=role_id,
                before=existing,
                after=updated,
            )
        return updated
