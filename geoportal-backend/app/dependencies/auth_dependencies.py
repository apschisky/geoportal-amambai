import os
from datetime import UTC, datetime

from fastapi import Cookie, Depends, Header, HTTPException, Response, status

from app.core.config import settings
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.auth_current_session_service import resolve_authenticated_session
from app.services.auth_permission_service import has_permission
from app.services.auth_token_transport_service import extract_session_token


INTERNAL_SESSION_COOKIE_NAME = "geoportal_internal_session"
INTERNAL_SESSION_COOKIE_PATH = "/api/internal"
INTERNAL_SESSION_COOKIE_SAMESITE = "lax"
INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR = "GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE"
INTERNAL_MUTATING_REQUEST_HEADER_NAME = "X-Geoportal-Internal-Request"
INTERNAL_MUTATING_REQUEST_HEADER_VALUE = "1"
SESSION_SECRET_ENV_VAR = "GEOPORTAL_INTERNAL_SESSION_SECRET"
NOT_AUTHENTICATED_DETAIL = "Not authenticated"
INVALID_INTERNAL_REQUEST_DETAIL = "Invalid internal request"
FORBIDDEN_DETAIL = "Forbidden"

_TRUE_VALUES = frozenset({"true", "1", "yes", "on"})
_FALSE_VALUES = frozenset({"false", "0", "no", "off"})
_PRODUCTION_ENV_VALUES = frozenset({"production", "producao", "prod"})


def get_session_secret() -> str:
    session_secret = os.getenv(SESSION_SECRET_ENV_VAR, "").strip()
    if not session_secret:
        raise RuntimeError("internal session secret is not configured")

    return session_secret


def is_internal_session_cookie_secure(
    value: str | None = None,
    app_env: str | None = None,
) -> bool:
    if isinstance(value, str):
        normalized_value = value.strip().lower()
        if normalized_value in _TRUE_VALUES:
            return True
        if normalized_value in _FALSE_VALUES:
            return False

    normalized_app_env = (app_env or settings.app_env).strip().lower()
    return normalized_app_env in _PRODUCTION_ENV_VALUES


def get_internal_session_cookie_secure() -> bool:
    return is_internal_session_cookie_secure(
        value=os.getenv(INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR),
    )


def _session_cookie_max_age(
    expira_em: datetime,
    now: datetime | None = None,
) -> int:
    reference_time = now or datetime.now(UTC)
    expires_at = expira_em
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    return max(0, int((expires_at - reference_time).total_seconds()))


def set_internal_session_cookie(
    response: Response,
    token: str,
    expira_em: datetime,
    now: datetime | None = None,
) -> None:
    response.set_cookie(
        key=INTERNAL_SESSION_COOKIE_NAME,
        value=token,
        max_age=_session_cookie_max_age(expira_em, now=now),
        httponly=True,
        secure=get_internal_session_cookie_secure(),
        samesite=INTERNAL_SESSION_COOKIE_SAMESITE,
        path=INTERNAL_SESSION_COOKIE_PATH,
    )


def clear_internal_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=INTERNAL_SESSION_COOKIE_NAME,
        path=INTERNAL_SESSION_COOKIE_PATH,
        secure=get_internal_session_cookie_secure(),
        httponly=True,
        samesite=INTERNAL_SESSION_COOKIE_SAMESITE,
    )


def _raise_not_authenticated() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=NOT_AUTHENTICATED_DETAIL,
    )


def require_internal_mutating_request_header(
    internal_request_header: str | None = Header(
        default=None,
        alias=INTERNAL_MUTATING_REQUEST_HEADER_NAME,
    ),
) -> None:
    if internal_request_header != INTERNAL_MUTATING_REQUEST_HEADER_VALUE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=INVALID_INTERNAL_REQUEST_DETAIL,
        )


def require_permission(permission_code: str):
    normalized_permission = permission_code.strip().lower()

    def permission_dependency(
        current_session: AuthenticatedCurrentSession = Depends(
            get_current_authenticated_session
        ),
    ) -> AuthenticatedCurrentSession:
        if not normalized_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_DETAIL,
            )

        if not has_permission(
            current_session.usuario_id,
            normalized_permission,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_DETAIL,
            )

        return current_session

    return permission_dependency


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
