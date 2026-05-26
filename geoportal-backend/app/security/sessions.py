from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets


DEFAULT_SESSION_DURATION_MINUTES = 60
SESSION_TOKEN_BYTES = 32
TOKEN_HASH_PREFIX = "hmac-sha256:"


def generate_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str, secret: str) -> str:
    if not token.strip():
        raise ValueError("token must not be empty")
    if not secret.strip():
        raise ValueError("secret must not be empty")

    digest = hmac.new(
        secret.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{TOKEN_HASH_PREFIX}{digest}"


def verify_session_token(token: str, token_hash: str, secret: str) -> bool:
    try:
        if not token.strip() or not token_hash.strip() or not secret.strip():
            return False
        if not token_hash.startswith(TOKEN_HASH_PREFIX):
            return False

        expected_hash = hash_session_token(token, secret)
        return hmac.compare_digest(expected_hash, token_hash)
    except (AttributeError, TypeError, ValueError):
        return False


def _to_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def build_session_expiration(
    now: datetime | None = None,
    minutes: int = DEFAULT_SESSION_DURATION_MINUTES,
) -> datetime:
    if minutes <= 0:
        raise ValueError("minutes must be greater than zero")

    base_time = _to_utc_aware(now or datetime.now(UTC))
    return base_time + timedelta(minutes=minutes)


def is_session_expired(expires_at: datetime, now: datetime | None = None) -> bool:
    current_time = _to_utc_aware(now or datetime.now(UTC))
    expiration_time = _to_utc_aware(expires_at)

    return current_time >= expiration_time


def is_session_revoked(revoked_at: datetime | None) -> bool:
    return revoked_at is not None
