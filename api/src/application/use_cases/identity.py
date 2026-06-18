from __future__ import annotations

from src.application.ports import (
    BootstrapStateRepository,
    Clock,
    OrganizationMembershipRepository,
    OrganizationRepository,
    PrincipalRepository,
    RoleRepository,
    WorkspaceMembershipRepository,
    WorkspaceRepository,
)
from src.application.use_cases.authorization import require_permission
from src.application.use_cases.events import EventLogUseCases
from src.application.use_cases.roles import ADMIN_ROLE, has_admin_role, normalize_roles, permissions_for_roles
from src.domain.enums import Permission, PrincipalType
from src.domain.errors import ConflictError, ForbiddenError, NotFoundError
from src.domain.models import AuthContext, BootstrapState, Principal, Role, WhoAmI, WhoAmIOrganization, WhoAmIWorkspace

if False:  # pragma: no cover
    from src.application.use_cases.tenancy import OrganizationUseCases

class PrincipalUseCases:
    def __init__(
        self,
        *,
        principals: PrincipalRepository,
        roles: RoleRepository,
        bootstrap: BootstrapStateRepository,
        clock: Clock,
        events: EventLogUseCases | None = None,
        organizations: OrganizationRepository | None = None,
        workspaces: WorkspaceRepository | None = None,
        organization_memberships: OrganizationMembershipRepository | None = None,
        workspace_memberships: WorkspaceMembershipRepository | None = None,
        bootstrap_tenancy: "OrganizationUseCases | None" = None,
    ) -> None:
        self.principals = principals
        self.roles = roles
        self.bootstrap = bootstrap
        self.clock = clock
        self.events = events
        self.organizations = organizations
        self.workspaces = workspaces
        self.organization_memberships = organization_memberships
        self.workspace_memberships = workspace_memberships
        self.bootstrap_tenancy = bootstrap_tenancy

    def create(self, principal: Principal, context: AuthContext) -> Principal:
        require_permission(context, Permission.PRINCIPALS_WRITE)
        principal = principal.model_copy(update={"created_by": context.principal_id, "roles": normalize_roles(principal.roles)})
        if self.principals.get(principal.principal_id) is not None:
            raise ConflictError(f"Principal already exists: {principal.principal_id}")
        self._validate_admin_role_unchanged(None, principal)
        self._validate_oidc_unique(principal)
        self._validate_admin_invariant(principal)
        self.principals.put(principal)
        if self.events:
            self.events.append_actor(
                actor_principal_id=principal.created_by,
                action="principal.created",
                category="identity",
                summary=f"Created principal {principal.principal_id}",
                resource_type="principal",
                resource_id=principal.principal_id,
                after=principal,
            )
        return principal

    def put(self, principal: Principal, context: AuthContext) -> Principal:
        require_permission(context, Permission.PRINCIPALS_WRITE)
        existing = self.principals.get(principal.principal_id)
        principal = principal.model_copy(update={"roles": normalize_roles(principal.roles)})
        if existing is None:
            principal = principal.model_copy(update={"created_by": context.principal_id})
        self._validate_admin_role_unchanged(existing, principal)
        self._validate_oidc_unique(principal)
        self._validate_admin_invariant(principal)
        self.principals.put(principal.model_copy(update={"updated_at": self.clock.now()}))
        updated = self.get(principal.principal_id)
        if self.events:
            action = "principal.roles_changed" if existing and existing.roles != updated.roles else "principal.updated"
            self.events.append_actor(
                actor_principal_id=context.principal_id,
                action=action,
                category="identity",
                summary=f"Updated principal {principal.principal_id}",
                resource_type="principal",
                resource_id=principal.principal_id,
                before=existing,
                after=updated,
            )
        return updated

    def get(self, principal_id: str) -> Principal:
        principal = self.principals.get(principal_id)
        if principal is None:
            raise NotFoundError(f"Principal not found: {principal_id}")
        return principal

    def list(self) -> list[Principal]:
        return self.principals.list()

    def bootstrap_state(self) -> BootstrapState:
        return self.bootstrap.get()

    def whoami(self, context: AuthContext) -> WhoAmI:
        principal = self.get(context.principal_id)
        organization_memberships = self.organization_memberships.list(principal_id=principal.principal_id) if self.organization_memberships else []
        workspace_memberships = self.workspace_memberships.list(principal_id=principal.principal_id) if self.workspace_memberships else []
        return WhoAmI(
            principal_id=principal.principal_id,
            type=principal.type,
            auth_method=principal.auth_method,
            display_name=principal.display_name,
            email=principal.email,
            roles=normalize_roles(principal.roles),
            permissions=self._permissions_for_roles(principal.roles),
            organizations=[
                WhoAmIOrganization(
                    organization_id=membership.organization_id,
                    display_name=self.organizations.get(membership.organization_id).display_name if self.organizations and self.organizations.get(membership.organization_id) else membership.organization_id,
                    roles=membership.roles,
                )
                for membership in organization_memberships
                if membership.active
            ],
            workspaces=[
                WhoAmIWorkspace(
                    workspace_id=membership.workspace_id,
                    organization_id=self.workspaces.get(membership.workspace_id).organization_id if self.workspaces and self.workspaces.get(membership.workspace_id) else "default",
                    display_name=self.workspaces.get(membership.workspace_id).display_name if self.workspaces and self.workspaces.get(membership.workspace_id) else membership.workspace_id,
                    roles=membership.roles,
                )
                for membership in workspace_memberships
                if membership.active
            ],
        )

    def authenticate_oidc(
        self,
        *,
        issuer: str,
        subject: str,
        email: str | None,
        display_name: str | None,
        bootstrap_allowed_email: str | None = None,
        bootstrap_allowed_subject: str | None = None,
        claims: dict[str, object] | None = None,
    ) -> AuthContext:
        bootstrap = self.bootstrap.get()
        principal = self.principals.get_by_oidc(issuer, subject)
        now = self.clock.now()
        if principal is None and not bootstrap.completed:
            if bootstrap_allowed_subject and subject != bootstrap_allowed_subject:
                raise ForbiddenError("OIDC user is not allowed to bootstrap this Settle instance.")
            if bootstrap_allowed_email and email != bootstrap_allowed_email:
                raise ForbiddenError("OIDC user is not allowed to bootstrap this Settle instance.")
            principal_id = f"user:{subject}"
            principal = Principal(
                principal_id=principal_id,
                type=PrincipalType.USER,
                display_name=display_name or email or subject,
                email=email,
                auth_method="oidc",
                external_issuer=issuer,
                external_subject=subject,
                roles=[ADMIN_ROLE],
                active=True,
                tags={},
                created_at=now,
                created_by="system:first-login-bootstrap",
                last_seen_at=now,
            )
            self.principals.put(principal)
            if self.bootstrap_tenancy:
                self.bootstrap_tenancy.ensure_default(principal_id, now)
            self.bootstrap.put(BootstrapState(completed=True, completed_at=now, completed_by=principal_id))
            if self.events:
                self.events.append_system(
                    actor_principal_id="system:first-login-bootstrap",
                    action="principal.bootstrap_created",
                    category="identity",
                    summary=f"Bootstrapped first admin {principal_id}",
                    resource_type="principal",
                    resource_id=principal_id,
                    after=principal,
                )
            return auth_context_for_oidc_principal(principal, claims or {}, self.roles.list())
        if principal is None or not principal.active or principal.type != PrincipalType.USER or principal.auth_method != "oidc":
            raise ForbiddenError("OIDC token is valid, but no active Settle principal is registered.")
        updated = principal.model_copy(update={"last_seen_at": now})
        self.principals.put(updated)
        return auth_context_for_oidc_principal(updated, claims or {}, self.roles.list())

    def ensure_service_principal(
        self,
        *,
        principal_id: str,
        display_name: str,
        role: str,
        created_by: str = "system:service-principal-bootstrap",
        tags: dict[str, str] | None = None,
    ) -> Principal:
        existing = self.principals.get(principal_id)
        expected = Principal(
            principal_id=principal_id,
            type=PrincipalType.SERVICE,
            display_name=display_name,
            email=None,
            auth_method="pat",
            external_issuer=None,
            external_subject=None,
            roles=[role],
            active=True,
            tags=tags or {},
            created_at=self.clock.now(),
            created_by=created_by,
        )
        if existing is not None:
            if existing.type != PrincipalType.SERVICE or existing.auth_method != "pat":
                raise ConflictError(f"Principal already exists with incompatible auth: {principal_id}")
            return existing
        self.principals.put(expected)
        if self.events:
            self.events.append_system(
                actor_principal_id=created_by,
                action="principal.service_created",
                category="identity",
                summary=f"Created service principal {principal_id}",
                resource_type="principal",
                resource_id=principal_id,
                after=expected,
                metadata={"role": role},
            )
        return expected

    def _validate_oidc_unique(self, principal: Principal) -> None:
        if principal.type != PrincipalType.USER or principal.auth_method != "oidc":
            return
        if principal.external_issuer is None or principal.external_subject is None:
            raise ConflictError("OIDC user principals require externalIssuer and externalSubject.")
        existing = self.principals.get_by_oidc(principal.external_issuer, principal.external_subject)
        if existing is not None and existing.principal_id != principal.principal_id:
            raise ConflictError("OIDC issuer and subject are already registered to another principal.")

    def _validate_admin_invariant(self, candidate: Principal) -> None:
        if not self.bootstrap.get().completed:
            return
        principals = {
            principal.principal_id: principal
            for principal in self.principals.list()
        }
        principals[candidate.principal_id] = candidate
        active_admins = [
            principal
            for principal in principals.values()
            if principal.type == PrincipalType.USER and principal.active and has_admin_role(principal.roles)
        ]
        if not active_admins:
            raise ConflictError("Cannot remove or disable the last active admin user.")

    def _validate_admin_role_unchanged(self, existing: Principal | None, candidate: Principal) -> None:
        if candidate.type != PrincipalType.USER:
            return
        candidate_is_admin = has_admin_role(candidate.roles)
        if existing is None:
            if candidate_is_admin:
                raise ConflictError("The admin role cannot be assigned through user management.")
            return
        if has_admin_role(existing.roles) != candidate_is_admin:
            raise ConflictError("The admin role cannot be changed through user management.")

    def _permissions_for_roles(self, roles: list[str]) -> list[Permission]:
        return permissions_for_roles(roles, self.roles.list())


def auth_context_for_oidc_principal(principal: Principal, claims: dict[str, object], roles: list[Role] | None = None) -> AuthContext:
    return AuthContext(
        principal_id=principal.principal_id,
        principal_type=principal.type,
        auth_method=principal.auth_method,
        roles=normalize_roles(principal.roles),
        permissions=permissions_for_roles(principal.roles, roles),
        claims=claims,
    )
