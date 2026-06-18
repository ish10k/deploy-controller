from src.domain.enums import Permission
from src.domain.errors import ForbiddenError
from src.domain.models import AuthContext


def require_permission(context: AuthContext, permission: Permission) -> None:
    if permission not in context.permissions:
        raise ForbiddenError(f"Current principal requires {permission} permission.")
