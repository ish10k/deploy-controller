import hashlib
import secrets


def issue_pat() -> tuple[str, str, str]:
    token = f"settle_pat_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    token_prefix = token[:18]
    return token, token_hash, token_prefix

