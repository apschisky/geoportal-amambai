from datetime import UTC, datetime
import inspect

import pytest
from fastapi import HTTPException, Response

from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import clear_internal_session_cookie
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.dependencies.auth_dependencies import get_internal_session_cookie_secure
from app.dependencies.auth_dependencies import get_session_secret
from app.dependencies.auth_dependencies import is_internal_session_cookie_secure
from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import set_internal_session_cookie
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.auth_token_transport_service import AuthTokenTransportResult


TEST_COOKIE_TOKEN = "token-cookie-ficticio"
TEST_BEARER_TOKEN = "token-bearer-ficticio"
TEST_SESSION_SECRET = "segredo-ficticio-para-dependency"
EXPIRES_AT = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)


def authenticated_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=20,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def assert_generic_401(exc: HTTPException) -> None:
    assert exc.status_code == 401
    assert exc.detail == "Not authenticated"
    assert "token" not in str(exc.detail).lower()
    assert "cookie" not in str(exc.detail).lower()
    assert "bearer" not in str(exc.detail).lower()
    assert "expirada" not in str(exc.detail).lower()
    assert "revogada" not in str(exc.detail).lower()


def test_missing_token_raises_generic_401() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_authenticated_session(
            authorization=None,
            session_cookie=None,
            session_secret=TEST_SESSION_SECRET,
        )

    assert_generic_401(exc_info.value)


def test_malformed_authorization_raises_generic_401() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_authenticated_session(
            authorization="Basic credencial-ficticia",
            session_cookie=None,
            session_secret=TEST_SESSION_SECRET,
        )

    assert_generic_401(exc_info.value)


def test_cookie_and_bearer_together_raise_generic_401() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_authenticated_session(
            authorization=f"Bearer {TEST_BEARER_TOKEN}",
            session_cookie=TEST_COOKIE_TOKEN,
            session_secret=TEST_SESSION_SECRET,
        )

    assert_generic_401(exc_info.value)


def test_extracted_token_with_invalid_session_raises_generic_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_dependencies,
        "extract_session_token",
        lambda **kwargs: AuthTokenTransportResult(
            token=TEST_COOKIE_TOKEN,
            transport="cookie",
        ),
    )
    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        lambda **kwargs: None,
    )

    with pytest.raises(HTTPException) as exc_info:
        get_current_authenticated_session(
            authorization=None,
            session_cookie=TEST_COOKIE_TOKEN,
            session_secret=TEST_SESSION_SECRET,
        )

    assert_generic_401(exc_info.value)


def test_valid_session_returns_authenticated_current_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_dependencies,
        "extract_session_token",
        lambda **kwargs: AuthTokenTransportResult(
            token=TEST_COOKIE_TOKEN,
            transport="cookie",
        ),
    )
    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        lambda **kwargs: authenticated_session(),
    )

    response = get_current_authenticated_session(
        authorization=None,
        session_cookie=TEST_COOKIE_TOKEN,
        session_secret=TEST_SESSION_SECRET,
    )

    assert response == authenticated_session()
    assert not hasattr(response, "token")
    assert not hasattr(response, "token_hash")
    assert not hasattr(response, "session_secret")


def test_dependency_calls_extract_session_token_with_header_and_cookie(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_extract_session_token(**kwargs: object) -> AuthTokenTransportResult:
        captured.update(kwargs)
        return AuthTokenTransportResult(token=TEST_COOKIE_TOKEN, transport="cookie")

    monkeypatch.setattr(auth_dependencies, "extract_session_token", fake_extract_session_token)
    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        lambda **kwargs: authenticated_session(),
    )

    response = get_current_authenticated_session(
        authorization=f"Bearer {TEST_BEARER_TOKEN}",
        session_cookie=TEST_COOKIE_TOKEN,
        session_secret=TEST_SESSION_SECRET,
    )

    assert response == authenticated_session()
    assert captured == {
        "authorization_header": f"Bearer {TEST_BEARER_TOKEN}",
        "session_cookie": TEST_COOKIE_TOKEN,
        "preferred_transport": "cookie",
    }


def test_dependency_calls_resolve_authenticated_session_with_token_and_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_resolve_authenticated_session(**kwargs: object) -> AuthenticatedCurrentSession:
        captured.update(kwargs)
        return authenticated_session()

    monkeypatch.setattr(
        auth_dependencies,
        "extract_session_token",
        lambda **kwargs: AuthTokenTransportResult(
            token=TEST_BEARER_TOKEN,
            transport="bearer",
        ),
    )
    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        fake_resolve_authenticated_session,
    )

    response = get_current_authenticated_session(
        authorization=f"Bearer {TEST_BEARER_TOKEN}",
        session_cookie=None,
        session_secret=TEST_SESSION_SECRET,
    )

    assert response == authenticated_session()
    assert captured == {
        "token": TEST_BEARER_TOKEN,
        "session_secret": TEST_SESSION_SECRET,
    }


def test_missing_session_secret_configuration_raises_internal_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(auth_dependencies.SESSION_SECRET_ENV_VAR, raising=False)

    with pytest.raises(RuntimeError):
        get_session_secret()


def test_configured_session_secret_is_read_without_logging_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.SESSION_SECRET_ENV_VAR, TEST_SESSION_SECRET)

    response = get_session_secret()

    assert response == TEST_SESSION_SECRET


def test_internal_session_cookie_secure_defaults_to_true_in_production() -> None:
    assert is_internal_session_cookie_secure(app_env="production") is True
    assert is_internal_session_cookie_secure(app_env="producao") is True
    assert is_internal_session_cookie_secure(app_env="development") is False


def test_internal_session_cookie_secure_can_be_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "true")

    assert get_internal_session_cookie_secure() is True

    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")

    assert get_internal_session_cookie_secure() is False


def test_set_internal_session_cookie_uses_safe_attributes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "true")
    response = Response()

    set_internal_session_cookie(
        response=response,
        token=TEST_COOKIE_TOKEN,
        expira_em=EXPIRES_AT,
        now=datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
    )

    set_cookie = response.headers["set-cookie"]
    assert "geoportal_internal_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/api/internal" in set_cookie
    assert "Max-Age=3600" in set_cookie
    assert TEST_COOKIE_TOKEN in set_cookie
    assert TEST_SESSION_SECRET not in set_cookie


def test_clear_internal_session_cookie_expires_cookie(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")
    response = Response()

    clear_internal_session_cookie(response)

    set_cookie = response.headers["set-cookie"]
    assert "geoportal_internal_session=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/api/internal" in set_cookie


def test_internal_mutating_request_header_accepts_only_expected_value() -> None:
    assert require_internal_mutating_request_header("1") is None

    with pytest.raises(HTTPException) as exc_info:
        require_internal_mutating_request_header(None)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Invalid internal request"


def test_dependency_does_not_depend_on_endpoint_or_request() -> None:
    signature = inspect.signature(get_current_authenticated_session)
    module_source = inspect.getsource(auth_dependencies)

    assert "request" not in signature.parameters
    assert "APIRouter" not in module_source
    assert "@router" not in module_source
    assert "@app" not in module_source
