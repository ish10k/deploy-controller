from __future__ import annotations

from src.application.ports import (
    Clock,
    OrganizationMembershipRepository,
    OrganizationRepository,
    WorkspaceMembershipRepository,
    WorkspaceRepository,
)
from src.application.use_cases.authorization import require_permission
from src.domain.enums import Permission
from src.domain.errors import ConflictError, NotFoundError
from src.domain.models import (
    AuthContext,
    Organization,
    OrganizationMembership,
    Workspace,
    WorkspaceMembership,
)

DEFAULT_ORGANIZATION_ID = "default"
DEFAULT_WORKSPACE_ID = "default"


class OrganizationUseCases:
    def __init__(
        self,
        *,
        organizations: OrganizationRepository,
        workspaces: WorkspaceRepository,
        organization_memberships: OrganizationMembershipRepository,
        workspace_memberships: WorkspaceMembershipRepository,
        clock: Clock,
    ) -> None:
        self.organizations = organizations
        self.workspaces = workspaces
        self.organization_memberships = organization_memberships
        self.workspace_memberships = workspace_memberships
        self.clock = clock

    def ensure_default(self, principal_id: str, now: str | None = None) -> None:
        now = now or self.clock.now()
        if self.organizations.get(DEFAULT_ORGANIZATION_ID) is None:
            self.organizations.put(
                Organization(
                    organization_id=DEFAULT_ORGANIZATION_ID,
                    display_name="Default",
                    active=True,
                    tags={},
                    created_at=now,
                    created_by=principal_id,
                )
            )
        if self.workspaces.get(DEFAULT_WORKSPACE_ID) is None:
            self.workspaces.put(
                Workspace(
                    workspace_id=DEFAULT_WORKSPACE_ID,
                    organization_id=DEFAULT_ORGANIZATION_ID,
                    display_name="Default",
                    active=True,
                    tags={},
                    created_at=now,
                    created_by=principal_id,
                )
            )
        if self.organization_memberships.get(DEFAULT_ORGANIZATION_ID, principal_id) is None:
            self.organization_memberships.put(
                OrganizationMembership(
                    organization_id=DEFAULT_ORGANIZATION_ID,
                    principal_id=principal_id,
                    roles=["org-owner"],
                    active=True,
                    created_at=now,
                    created_by="system:first-login-bootstrap",
                )
            )
        if self.workspace_memberships.get(DEFAULT_WORKSPACE_ID, principal_id) is None:
            self.workspace_memberships.put(
                WorkspaceMembership(
                    workspace_id=DEFAULT_WORKSPACE_ID,
                    principal_id=principal_id,
                    roles=["workspace-admin"],
                    active=True,
                    created_at=now,
                    created_by="system:first-login-bootstrap",
                )
            )

    def list(self, context: AuthContext) -> list[Organization]:
        require_permission(context, Permission.ORGANIZATIONS_READ)
        return self.organizations.list()

    def get(self, organization_id: str, context: AuthContext) -> Organization:
        require_permission(context, Permission.ORGANIZATIONS_READ)
        organization = self.organizations.get(organization_id)
        if organization is None:
            raise NotFoundError(f"Organization not found: {organization_id}")
        return organization

    def put(self, organization_id: str, organization: Organization, context: AuthContext) -> Organization:
        require_permission(context, Permission.ORGANIZATIONS_WRITE)
        existing = self.organizations.get(organization_id)
        updated = organization.model_copy(
            update={
                "organization_id": organization_id,
                "created_by": existing.created_by if existing else context.principal_id,
                "created_at": existing.created_at if existing else organization.created_at,
                "updated_at": self.clock.now() if existing else organization.updated_at,
            }
        )
        self.organizations.put(updated)
        return updated

    def create_workspace(self, organization_id: str, workspace: Workspace, context: AuthContext) -> Workspace:
        require_permission(context, Permission.WORKSPACES_CREATE)
        if self.organizations.get(organization_id) is None:
            raise NotFoundError(f"Organization not found: {organization_id}")
        if self.workspaces.get(workspace.workspace_id) is not None:
            raise ConflictError(f"Workspace already exists: {workspace.workspace_id}")
        created = workspace.model_copy(
            update={
                "organization_id": organization_id,
                "created_by": context.principal_id,
                "created_at": workspace.created_at,
            }
        )
        self.workspaces.put(created)
        return created

    def list_workspaces(self, organization_id: str, context: AuthContext) -> list[Workspace]:
        require_permission(context, Permission.WORKSPACES_READ)
        if self.organizations.get(organization_id) is None:
            raise NotFoundError(f"Organization not found: {organization_id}")
        return self.workspaces.list(organization_id)

    def list_memberships(self, organization_id: str, context: AuthContext) -> list[OrganizationMembership]:
        require_permission(context, Permission.ORGANIZATION_MEMBERSHIPS_READ)
        return self.organization_memberships.list(organization_id=organization_id)

    def put_membership(
        self,
        organization_id: str,
        principal_id: str,
        membership: OrganizationMembership,
        context: AuthContext,
    ) -> OrganizationMembership:
        require_permission(context, Permission.ORGANIZATION_MEMBERSHIPS_WRITE)
        existing = self.organization_memberships.get(organization_id, principal_id)
        updated = membership.model_copy(
            update={
                "organization_id": organization_id,
                "principal_id": principal_id,
                "created_at": existing.created_at if existing else membership.created_at,
                "created_by": existing.created_by if existing else context.principal_id,
                "updated_at": self.clock.now() if existing else membership.updated_at,
            }
        )
        self._ensure_not_removing_last_owner(existing, updated)
        self.organization_memberships.put(updated)
        return updated

    def _ensure_not_removing_last_owner(self, existing: OrganizationMembership | None, candidate: OrganizationMembership) -> None:
        if existing is None or "org-owner" not in existing.roles:
            return
        if candidate.active and "org-owner" in candidate.roles:
            return
        owners = [
            membership
            for membership in self.organization_memberships.list(organization_id=candidate.organization_id)
            if membership.principal_id != candidate.principal_id and membership.active and "org-owner" in membership.roles
        ]
        if not owners:
            raise ConflictError("Cannot remove or disable the last active org-owner for this organization.")


class WorkspaceUseCases:
    def __init__(
        self,
        *,
        workspaces: WorkspaceRepository,
        memberships: WorkspaceMembershipRepository,
        clock: Clock,
    ) -> None:
        self.workspaces = workspaces
        self.memberships = memberships
        self.clock = clock

    def get(self, workspace_id: str, context: AuthContext) -> Workspace:
        require_permission(context, Permission.WORKSPACES_READ)
        workspace = self.workspaces.get(workspace_id)
        if workspace is None:
            raise NotFoundError(f"Workspace not found: {workspace_id}")
        return workspace

    def put(self, workspace_id: str, workspace: Workspace, context: AuthContext) -> Workspace:
        require_permission(context, Permission.WORKSPACES_WRITE)
        existing = self.workspaces.get(workspace_id)
        if existing is None:
            raise NotFoundError(f"Workspace not found: {workspace_id}")
        updated = workspace.model_copy(
            update={
                "workspace_id": workspace_id,
                "organization_id": existing.organization_id,
                "created_at": existing.created_at,
                "created_by": existing.created_by,
                "updated_at": self.clock.now(),
            }
        )
        self.workspaces.put(updated)
        return updated

    def list_memberships(self, workspace_id: str, context: AuthContext) -> list[WorkspaceMembership]:
        require_permission(context, Permission.WORKSPACE_MEMBERSHIPS_READ)
        return self.memberships.list(workspace_id=workspace_id)

    def get_membership(self, workspace_id: str, principal_id: str, context: AuthContext) -> WorkspaceMembership:
        require_permission(context, Permission.WORKSPACE_MEMBERSHIPS_READ)
        membership = self.memberships.get(workspace_id, principal_id)
        if membership is None:
            raise NotFoundError(f"WorkspaceMembership not found: {workspace_id}/{principal_id}")
        return membership

    def put_membership(
        self,
        workspace_id: str,
        principal_id: str,
        membership: WorkspaceMembership,
        context: AuthContext,
    ) -> WorkspaceMembership:
        require_permission(context, Permission.WORKSPACE_MEMBERSHIPS_WRITE)
        existing = self.memberships.get(workspace_id, principal_id)
        updated = membership.model_copy(
            update={
                "workspace_id": workspace_id,
                "principal_id": principal_id,
                "created_at": existing.created_at if existing else membership.created_at,
                "created_by": existing.created_by if existing else context.principal_id,
                "updated_at": self.clock.now() if existing else membership.updated_at,
            }
        )
        self._ensure_not_removing_last_admin(existing, updated)
        self.memberships.put(updated)
        return updated

    def _ensure_not_removing_last_admin(self, existing: WorkspaceMembership | None, candidate: WorkspaceMembership) -> None:
        if existing is None or "workspace-admin" not in existing.roles:
            return
        if candidate.active and "workspace-admin" in candidate.roles:
            return
        admins = [
            membership
            for membership in self.memberships.list(workspace_id=candidate.workspace_id)
            if membership.principal_id != candidate.principal_id and membership.active and "workspace-admin" in membership.roles
        ]
        if not admins:
            raise ConflictError("Cannot remove or disable the last active workspace-admin for this workspace.")
