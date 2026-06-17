from src.application.ports import BootstrapStateRepository, Clock, PrincipalRepository
from src.domain.enums import Permission, PrincipalType
from src.domain.errors import ConflictError, ForbiddenError, NotFoundError
from src.domain.models import AuthContext, BootstrapState, Principal, WhoAmI

PLATFORM_ADMIN = "platform-admin"

ROLE_PERMISSIONS: dict[str, list[Permission]] = {
    PLATFORM_ADMIN: list(Permission),
    "platform-deployer": [
        Permission.COMPONENTS_READ,
        Permission.COMPONENT_SETS_READ,
        Permission.RELEASES_READ,
        Permission.DEPSETS_READ,
        Permission.DEPLOYMENTS_READ,
        Permission.DEPLOYMENTS_CREATE,
    ],
    "platform-viewer": [
        Permission.COMPONENTS_READ,
        Permission.COMPONENT_SETS_READ,
        Permission.RELEASES_READ,
        Permission.DEPSETS_READ,
        Permission.ENVIRONMENTS_READ,
        Permission.DEPLOYMENTS_READ,
    ],
    "deployment-runner": [
        Permission.EXECUTIONS_CLAIM,
        Permission.EXECUTIONS_REPORT_STATUS,
    ],
    "release-source": [
        Permission.RELEASES_CREATE,
        Permission.RELEASE_SOURCES_PUBLISH,
    ],
}


def permissions_for_roles(roles: list[str]) -> list[Permission]:
    values = {permission for role in roles for permission in ROLE_PERMISSIONS.get(role, [])}
    return sorted(values, key=str)


class PrincipalUseCases:
    def __init__(
        self,
        *,
        principals: PrincipalRepository,
        bootstrap: BootstrapStateRepository,
        clock: Clock,
    ) -> None:
        self.principals = principals
        self.bootstrap = bootstrap
        self.clock = clock

    def create(self, principal: Principal) -> Principal:
        if self.principals.get(principal.principal_id) is not None:
            raise ConflictError(f"Principal already exists: {principal.principal_id}")
        self._validate_oidc_unique(principal)
        self._validate_admin_invariant(principal)
        self.principals.put(principal)
        return principal

    def put(self, principal: Principal) -> Principal:
        self._validate_oidc_unique(principal)
        self._validate_admin_invariant(principal)
        self.principals.put(principal.model_copy(update={"updated_at": self.clock.now()}))
        return self.get(principal.principal_id)

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
        return WhoAmI(
            principal_id=principal.principal_id,
            type=principal.type,
            auth_method=principal.auth_method,
            display_name=principal.display_name,
            email=principal.email,
            roles=principal.roles,
            permissions=permissions_for_roles(principal.roles),
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
                roles=[PLATFORM_ADMIN],
                active=True,
                tags={},
                created_at=now,
                created_by="system:first-login-bootstrap",
                last_seen_at=now,
            )
            self.principals.put(principal)
            self.bootstrap.put(BootstrapState(completed=True, completed_at=now, completed_by=principal_id))
            return auth_context_for_oidc_principal(principal, claims or {})
        if principal is None or not principal.active or principal.type != PrincipalType.USER or principal.auth_method != "oidc":
            raise ForbiddenError("OIDC token is valid, but no active Settle principal is registered.")
        updated = principal.model_copy(update={"last_seen_at": now})
        self.principals.put(updated)
        return auth_context_for_oidc_principal(updated, claims or {})

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
            if principal.type == PrincipalType.USER and principal.active and PLATFORM_ADMIN in principal.roles
        ]
        if not active_admins:
            raise ConflictError("Cannot remove or disable the last active platform-admin user.")


def auth_context_for_oidc_principal(principal: Principal, claims: dict[str, object]) -> AuthContext:
    return AuthContext(
        principal_id=principal.principal_id,
        principal_type=principal.type,
        auth_method=principal.auth_method,
        roles=principal.roles,
        permissions=permissions_for_roles(principal.roles),
        claims=claims,
    )
