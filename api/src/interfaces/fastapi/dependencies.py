import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header
from src.composition import Container
from src.composition.aws_container import build_aws_container
from src.composition.memory_container import build_memory_container
from src.application.use_cases.auth import OidcSettings, require_pat_context, verify_oidc_token
from src.domain.errors import UnauthorizedError
from src.domain.models import AuthContext


@lru_cache(maxsize=1)
def get_container() -> Container:
    backend = os.getenv("DEPLOYSET_BACKEND", "memory")
    if backend == "dynamodb":
        return build_aws_container()
    return build_memory_container()


ContainerDep = Annotated[Container, Depends(get_container)]


def get_auth_context(
    container: ContainerDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthContext:
    if not authorization:
        raise UnauthorizedError("Authorization bearer token is required.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Authorization bearer token is required.")
    if token.startswith("settle_pat_"):
        return require_pat_context(
            token=token,
            principals=container.principals.list(),
            runners=container.deployment_runners.list(),
            release_sources=container.release_sources.list(),
            roles=container.roles.list_unchecked(),
        )
    if os.getenv("SETTLE_AUTH_MODE", "oidc") != "oidc":
        raise UnauthorizedError("OIDC authentication is not configured in this runtime.")
    issuer = os.getenv("SETTLE_OIDC_ISSUER")
    audience = os.getenv("SETTLE_OIDC_AUDIENCE")
    client_id = os.getenv("SETTLE_OIDC_CLIENT_ID", "settle-ui")
    if not issuer or not audience:
        raise UnauthorizedError("OIDC issuer and audience must be configured.")
    public_issuer = os.getenv("SETTLE_OIDC_PUBLIC_ISSUER", issuer)
    jwks_url = os.getenv("SETTLE_OIDC_JWKS_URL", f"{issuer.rstrip('/')}/protocol/openid-connect/certs")
    email_claim = os.getenv("SETTLE_OIDC_EMAIL_CLAIM", "email")
    name_claim = os.getenv("SETTLE_OIDC_NAME_CLAIM", "name")
    subject_claim = os.getenv("SETTLE_OIDC_SUBJECT_CLAIM", "sub")
    claims = verify_oidc_token(
        token,
        OidcSettings(
            issuer=issuer,
            audience=audience,
            client_id=client_id,
            jwks_url=jwks_url,
            accepted_issuers=list({issuer, public_issuer}),
            email_claim=email_claim,
            name_claim=name_claim,
            subject_claim=subject_claim,
        ),
    )
    subject = str(claims[subject_claim])
    email = claims.get(email_claim)
    name = claims.get(name_claim)
    return container.principals.authenticate_oidc(
        issuer=str(claims["iss"]),
        subject=subject,
        email=str(email) if email is not None else None,
        display_name=str(name) if name is not None else None,
        bootstrap_allowed_email=os.getenv("SETTLE_BOOTSTRAP_ALLOWED_EMAIL"),
        bootstrap_allowed_subject=os.getenv("SETTLE_BOOTSTRAP_ALLOWED_SUB"),
        claims=claims,
    )
