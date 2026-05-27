import os

from fastapi import Cookie, Depends, Header, HTTPException, status

from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.auth_current_session_service import resolve_authenticated_session
from app.services.auth_token_transport_service import extract_session_token


INTERNAL_SESSION_COOKIE_NAME = "geoportal_internal_session"
SESSION_SECRET_ENV_VAR = "GEOPORTAL_INTERNAL_SESSION_SECRET"
NOT_AUTHENTICATED_DETAIL = "Not authenticated"


def get_session_secret() -> str:
    session_secret = os.getenv(SESSION_SECRET_ENV_VAR, "").strip()
    if not session_secret:
        raise RuntimeError("internal session secret is not configured")

    return session_secret


def _raise_not_authenticated() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=NOT_AUTHENTICATED_DETAIL,
    )


def get_current_authenticated_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
    session_cookie: str | None = Cookie(default=None, alias=INTERNAL_SESSION_COOKIE_NAME),
    session_secret: str = Depends(get_session_secret),
) -> AuthenticatedCurrentSession:
    transport_result = extract_session_token(
        authorization_header=authorization,
        session_cookie=session_cookie,
        preferred_transport="cookie",
    )

    if (
        transport_result.token is None
        or transport_result.is_ambiguous
        or transport_result.is_malformed
    ):
        _raise_not_authenticated()

    current_session = resolve_authenticated_session(
        token=transport_result.token,
        session_secret=session_secret,
    )
    if current_session is None:
        _raise_not_authenticated()

    return current_session
