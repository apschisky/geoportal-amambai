from dataclasses import dataclass
from typing import Literal


AuthTokenTransport = Literal["cookie", "bearer"]
PreferredAuthTokenTransport = Literal["cookie", "bearer", "none"]


@dataclass(frozen=True)
class AuthTokenTransportResult:
    token: str | None
    transport: AuthTokenTransport | None
    is_ambiguous: bool = False
    is_malformed: bool = False


def _normalize_cookie_token(session_cookie: str | None) -> str | None:
    if not isinstance(session_cookie, str):
        return None

    token = session_cookie.strip()
    return token or None


def _normalize_bearer_token(
    authorization_header: str | None,
) -> tuple[str | None, bool]:
    if authorization_header is None:
        return None, False
    if not isinstance(authorization_header, str):
        return None, True

    header_value = authorization_header.strip()
    if not header_value:
        return None, False

    parts = header_value.split()
    if len(parts) != 2:
        return None, True
    if parts[0].lower() != "bearer":
        return None, True
    if not parts[1].strip():
        return None, True

    return parts[1].strip(), False


def extract_session_token(
    authorization_header: str | None = None,
    session_cookie: str | None = None,
    preferred_transport: PreferredAuthTokenTransport = "cookie",
) -> AuthTokenTransportResult:
    if preferred_transport not in {"cookie", "bearer", "none"}:
        raise ValueError("preferred_transport must be cookie, bearer or none")

    cookie_token = _normalize_cookie_token(session_cookie)
    bearer_token, bearer_malformed = _normalize_bearer_token(authorization_header)

    if cookie_token and bearer_token:
        return AuthTokenTransportResult(
            token=None,
            transport=None,
            is_ambiguous=True,
        )

    if cookie_token:
        return AuthTokenTransportResult(
            token=cookie_token,
            transport="cookie",
        )

    if bearer_malformed:
        return AuthTokenTransportResult(
            token=None,
            transport=None,
            is_malformed=True,
        )

    if bearer_token:
        return AuthTokenTransportResult(
            token=bearer_token,
            transport="bearer",
        )

    return AuthTokenTransportResult(token=None, transport=None)
