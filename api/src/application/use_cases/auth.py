import hashlib
from dataclasses import dataclass
from typing import Any

from src.application.use_cases.roles import normalize_roles, permissions_for_roles
from src.domain.enums import PrincipalType
from src.domain.errors import UnauthorizedError
from src.domain.models import AuthContext, DeploymentRunner, Principal, ReleaseSource, Role


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def auth_context_for_principal(principal: Principal, claims: dict[str, object] | None = None, roles: list[Role] | None = None) -> AuthContext:
    return AuthContext(
        principal_id=principal.principal_id,
        principal_type=principal.type,
        auth_method=principal.auth_method,
        roles=normalize_roles(principal.roles),
        permissions=permissions_for_roles(principal.roles, roles),
        claims=claims or {},
    )


def service_claims_for_principal(
    *,
    principal: Principal,
    runners: list[DeploymentRunner],
    release_sources: list[ReleaseSource],
) -> dict[str, object]:
    for runner in runners:
        if runner.principal_id == principal.principal_id:
            return {"runnerId": runner.runner_id}
    for release_source in release_sources:
        if release_source.principal_id == principal.principal_id:
            return {"releaseSourceId": release_source.release_source_id}
    return {}


def require_pat_context(
    *,
    token: str,
    principals: list[Principal],
    runners: list[DeploymentRunner],
    release_sources: list[ReleaseSource],
    roles: list[Role] | None = None,
) -> AuthContext:
    token_hash = hash_token(token)
    for runner in runners:
        if runner.token_hash == token_hash:
            principal = next((item for item in principals if item.principal_id == runner.principal_id), None)
            if principal is None or not principal.active or principal.type != PrincipalType.SERVICE or principal.auth_method != "pat":
                raise UnauthorizedError("PAT principal is inactive or not registered.")
            return auth_context_for_principal(principal, {"runnerId": runner.runner_id}, roles)
    for release_source in release_sources:
        if release_source.token_hash == token_hash:
            principal = next((item for item in principals if item.principal_id == release_source.principal_id), None)
            if principal is None or not principal.active or principal.type != PrincipalType.SERVICE or principal.auth_method != "pat":
                raise UnauthorizedError("PAT principal is inactive or not registered.")
            return auth_context_for_principal(principal, {"releaseSourceId": release_source.release_source_id}, roles)
    raise UnauthorizedError("Invalid PAT token.")


@dataclass(frozen=True)
class OidcSettings:
    issuer: str
    audience: str
    client_id: str
    jwks_url: str
    accepted_issuers: list[str]
    email_claim: str = "email"
    name_claim: str = "name"
    subject_claim: str = "sub"
    clock_skew_seconds: int = 60


def verify_oidc_token(token: str, settings: OidcSettings) -> dict[str, Any]:
    try:
        import jwt
        from jwt import PyJWKClient
        from jwt.exceptions import (
            ExpiredSignatureError,
            ImmatureSignatureError,
            InvalidIssuedAtError,
            InvalidSignatureError,
            PyJWKClientError,
            PyJWTError,
        )
    except ImportError as exc:
        raise UnauthorizedError("OIDC authentication dependencies are not installed.") from exc

    try:
        signing_key = PyJWKClient(settings.jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.audience,
            options={"verify_iss": False, "require": ["exp"], "verify_aud": False},
            leeway=settings.clock_skew_seconds,
        )
    except ExpiredSignatureError as exc:
        raise UnauthorizedError("OIDC access token is expired.") from exc
    except (ImmatureSignatureError, InvalidIssuedAtError) as exc:
        raise UnauthorizedError("OIDC token time claims are not valid yet. Check API and OIDC provider clocks.") from exc
    except InvalidSignatureError as exc:
        raise UnauthorizedError("OIDC token signature is invalid for the configured JWKS URL.") from exc
    except PyJWKClientError as exc:
        raise UnauthorizedError(f"OIDC signing key could not be loaded from JWKS URL: {exc}") from exc
    except PyJWTError as exc:
        raise UnauthorizedError(f"OIDC token is invalid: {exc}") from exc

    issuer = claims.get("iss")
    if issuer not in settings.accepted_issuers:
        raise UnauthorizedError("OIDC token issuer is not trusted.")
    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if settings.audience not in audiences and claims.get("azp") != settings.client_id:
        raise UnauthorizedError("OIDC token audience is not trusted.")
    if not claims.get(settings.subject_claim):
        available_claims = ", ".join(sorted(claims.keys()))
        raise UnauthorizedError(
            f'OIDC token subject claim "{settings.subject_claim}" is required. Available claims: {available_claims}'
        )
    return claims
