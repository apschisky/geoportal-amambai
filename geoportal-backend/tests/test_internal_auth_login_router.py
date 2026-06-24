from datetime import UTC, datetime
import inspect
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import internal_auth_login
from app.api.routes import internal_auth_smoke
from app.services import auth_service
from app.services import auth_service
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.dependencies.auth_dependencies import get_session_secret
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_NAME
from app.dependencies.auth_dependencies import INTERNAL_SESSION_COOKIE_NAME
from app.services.auth_service import AuthenticatedSession
from app.services.auth_current_session_service import AuthenticatedCurrentSession


LOGIN_PATH = "/api/internal/auth/login"
LOGOUT_PATH = "/api/internal/auth/logout"
SMOKE_PATH = "/api/internal/auth/smoke"
TEST_LOGIN = "usuario.ficticio"
TEST_PASSWORD = "credencial-de-teste"
TEST_SECRET = "configuracao-interna-de-teste"
RETURNED_OPAQUE_SESSION = "sessao-opaca-de-teste"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_auth_login.router)
    app.dependency_overrides[get_session_secret] = lambda: TEST_SECRET
    return app


def build_isolated_app_with_smoke() -> FastAPI:
    app = build_isolated_app()
    app.include_router(internal_auth_smoke.router)
    return app


def authenticated_session() -> AuthenticatedSession:
    return AuthenticatedSession(
        usuario_id=20,
        nome="Usuario Ficticio",
        login=TEST_LOGIN,
        token=RETURNED_OPAQUE_SESSION,
        expira_em=EXPIRES_AT,
        session_id=30,
    )


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=20,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def set_successful_login(monkeypatch) -> None:
    monkeypatch.setattr(
        internal_auth_login.auth_service,
        "authenticate_user",
        lambda **kwargs: authenticated_session(),
    )


def set_successful_session_resolution(monkeypatch) -> dict[str, Any]:
    calls: dict[str, Any] = {}

    def fake_resolve_authenticated_session(**kwargs: Any) -> AuthenticatedCurrentSession:
        calls.update(kwargs)
        return authenticated_current_session()

    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        fake_resolve_authenticated_session,
    )
    return calls


def post_successful_login(client: TestClient) -> None:
    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": TEST_PASSWORD},
    )
    assert response.status_code == 200


def test_internal_login_success_returns_minimal_payload(
    monkeypatch,
) -> None:
    calls: dict[str, Any] = {}

    def fake_authenticate_user(**kwargs: Any) -> AuthenticatedSession:
        calls.update(kwargs)
        for key in (
            'client_ip',
            'rate_limit_enabled',
            'rate_limit_max_attempts',
            'rate_limit_ip_max_attempts',
            'rate_limit_ip_login_max_attempts',
            'rate_limit_window_minutes',
        ):
            calls.pop(key, None)
        return authenticated_session()

    monkeypatch.setattr(
        internal_auth_login.auth_service,
        "authenticate_user",
        fake_authenticate_user,
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": f"  {TEST_LOGIN}  ", "senha": TEST_PASSWORD},
    )

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "usuario_id": 20,
        "nome": "Usuario Ficticio",
        "login": TEST_LOGIN,
        "expira_em": "2030-05-27T13:00:00Z",
        "token": RETURNED_OPAQUE_SESSION,
    }
    assert calls == {
        "login_informado": f"  {TEST_LOGIN}  ",
        "password": TEST_PASSWORD,
        "session_secret": TEST_SECRET,
        "origem": "api_internal_auth_login",
    }
    assert INTERNAL_SESSION_COOKIE_NAME in response.cookies


def test_internal_login_success_sets_httponly_lax_internal_cookie(
    monkeypatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "true")
    set_successful_login(monkeypatch)
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": TEST_PASSWORD},
    )

    set_cookie = response.headers["set-cookie"]
    assert response.status_code == 200
    assert f"{INTERNAL_SESSION_COOKIE_NAME}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/api/internal" in set_cookie
    assert "Max-Age=" in set_cookie
    assert RETURNED_OPAQUE_SESSION in set_cookie
    assert TEST_PASSWORD not in set_cookie
    assert TEST_SECRET not in set_cookie


def test_internal_login_cookie_secure_can_be_disabled_for_controlled_tests(
    monkeypatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")
    set_successful_login(monkeypatch)
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": TEST_PASSWORD},
    )

    assert response.status_code == 200
    assert "Secure" not in response.headers["set-cookie"]


def test_internal_login_failure_returns_generic_401(monkeypatch) -> None:
    monkeypatch.setattr(
        internal_auth_login.auth_service,
        "authenticate_user",
        lambda **kwargs: None,
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": "senha-incorreta-ficticia"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_internal_login_blank_fields_return_generic_401(monkeypatch) -> None:
    calls: dict[str, Any] = {}

    def fake_authenticate_user(**kwargs: Any) -> None:
        calls.update(kwargs)
        return None

    monkeypatch.setattr(
        internal_auth_login.auth_service,
        "authenticate_user",
        fake_authenticate_user,
    )
    client = TestClient(build_isolated_app())

    response = client.post(LOGIN_PATH, json={"login": "   ", "senha": ""})

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
    assert calls["login_informado"] == "   "
    assert calls["password"] == ""
    assert calls["session_secret"] == TEST_SECRET


def test_internal_login_success_does_not_return_sensitive_fields(monkeypatch) -> None:
    monkeypatch.setattr(
        internal_auth_login.auth_service,
        "authenticate_user",
        lambda **kwargs: authenticated_session(),
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": TEST_PASSWORD},
    )

    body = response.json()
    response_text = response.text
    assert "senha" not in body
    assert "password" not in body
    assert "senha_hash" not in body
    assert "token_hash" not in body
    assert "session_secret" not in body
    assert "DATABASE_URL" not in body
    assert TEST_PASSWORD not in response_text
    assert TEST_SECRET not in response_text


def test_smoke_protected_route_accepts_login_cookie(monkeypatch) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")
    set_successful_login(monkeypatch)
    resolve_calls = set_successful_session_resolution(monkeypatch)
    client = TestClient(build_isolated_app_with_smoke())

    post_successful_login(client)
    response = client.get(SMOKE_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "usuario_id": 20,
        "sessao_id": 30,
    }
    assert resolve_calls == {
        "token": RETURNED_OPAQUE_SESSION,
        "session_secret": TEST_SECRET,
    }


def test_smoke_protected_route_still_accepts_bearer(monkeypatch) -> None:
    resolve_calls = set_successful_session_resolution(monkeypatch)
    client = TestClient(build_isolated_app_with_smoke())

    response = client.get(
        SMOKE_PATH,
        headers={"Authorization": f"Bearer {RETURNED_OPAQUE_SESSION}"},
    )

    assert response.status_code == 200
    assert resolve_calls == {
        "token": RETURNED_OPAQUE_SESSION,
        "session_secret": TEST_SECRET,
    }


def test_internal_logout_with_cookie_and_header_revokes_session_and_clears_cookie(
    monkeypatch,
) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")
    set_successful_login(monkeypatch)
    set_successful_session_resolution(monkeypatch)
    revoke_calls: list[int] = []
    monkeypatch.setattr(
        internal_auth_login,
        "revoke_session",
        lambda session_id: revoke_calls.append(session_id) or True,
    )
    client = TestClient(build_isolated_app())

    post_successful_login(client)
    response = client.post(
        LOGOUT_PATH,
        headers={INTERNAL_MUTATING_REQUEST_HEADER_NAME: "1"},
    )

    set_cookie = response.headers["set-cookie"]
    assert response.status_code == 200
    assert response.json() == {"logged_out": True}
    assert revoke_calls == [30]
    assert f"{INTERNAL_SESSION_COOKIE_NAME}=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "Path=/api/internal" in set_cookie
    assert RETURNED_OPAQUE_SESSION not in response.text
    assert TEST_SECRET not in response.text


def test_internal_logout_without_header_returns_controlled_error(monkeypatch) -> None:
    monkeypatch.setenv(auth_dependencies.INTERNAL_SESSION_COOKIE_SECURE_ENV_VAR, "false")
    set_successful_login(monkeypatch)
    set_successful_session_resolution(monkeypatch)
    revoke_calls: list[int] = []
    monkeypatch.setattr(
        internal_auth_login,
        "revoke_session",
        lambda session_id: revoke_calls.append(session_id) or True,
    )
    client = TestClient(build_isolated_app())

    post_successful_login(client)
    response = client.post(LOGOUT_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}
    assert revoke_calls == []


def test_internal_logout_without_session_returns_generic_401(monkeypatch) -> None:
    monkeypatch.setattr(
        auth_dependencies,
        "resolve_authenticated_session",
        lambda **kwargs: None,
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGOUT_PATH,
        headers={INTERNAL_MUTATING_REQUEST_HEADER_NAME: "1"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_login_does_not_require_internal_mutating_header(monkeypatch) -> None:
    set_successful_login(monkeypatch)
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={"login": TEST_LOGIN, "senha": TEST_PASSWORD},
    )

    assert response.status_code == 200


def test_get_smoke_does_not_require_internal_mutating_header(monkeypatch) -> None:
    app = build_isolated_app_with_smoke()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    client = TestClient(app)

    response = client.get(SMOKE_PATH)

    assert response.status_code == 200


def test_internal_login_router_configures_cookie_without_duplicate_auth_logic() -> None:
    source = inspect.getsource(internal_auth_login)

    assert "authenticate_user" in source
    assert "create_session" not in source
    assert "verify_password" not in source
    assert "senha_hash" not in source
    assert "token_hash" not in source
    assert "get_engine" not in source
    assert "delete(" not in source.lower()


def test_internal_login_passes_resolved_ip_and_rate_limit_settings(
    monkeypatch,
) -> None:
    calls: dict[str, Any] = {}
    monkeypatch.setattr(
        internal_auth_login,
        'resolve_client_ip',
        lambda request, trusted_proxy_hosts: '198.51.100.70',
    )

    def fake_authenticate_user(**kwargs: Any) -> AuthenticatedSession:
        calls.update(kwargs)
        return authenticated_session()

    monkeypatch.setattr(
        internal_auth_login.auth_service,
        'authenticate_user',
        fake_authenticate_user,
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={'login': TEST_LOGIN, 'senha': TEST_PASSWORD},
    )

    assert response.status_code == 200
    assert calls['client_ip'] == '198.51.100.70'
    assert calls['rate_limit_enabled'] is True
    assert calls['rate_limit_max_attempts'] == 5
    assert calls['rate_limit_ip_max_attempts'] == 20
    assert calls['rate_limit_ip_login_max_attempts'] == 5
    assert calls['rate_limit_window_minutes'] == 15


def test_internal_login_rate_limit_returns_generic_429(monkeypatch) -> None:
    monkeypatch.setattr(
        internal_auth_login.auth_service,
        'authenticate_user',
        lambda **kwargs: (_ for _ in ()).throw(
            auth_service.LoginRateLimitExceeded()
        ),
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={'login': TEST_LOGIN, 'senha': 'credencial-invalida'},
    )

    assert response.status_code == 429
    assert response.json() == {'detail': 'Too many authentication attempts'}
    assert TEST_LOGIN not in response.text


def test_internal_login_passes_disabled_rate_limit_setting(monkeypatch) -> None:
    calls: dict[str, Any] = {}
    monkeypatch.setattr(internal_auth_login.settings, 'rate_limit_enabled', False)

    def fake_authenticate_user(**kwargs: Any) -> AuthenticatedSession:
        calls.update(kwargs)
        return authenticated_session()

    monkeypatch.setattr(
        internal_auth_login.auth_service,
        'authenticate_user',
        fake_authenticate_user,
    )
    client = TestClient(build_isolated_app())

    response = client.post(
        LOGIN_PATH,
        json={'login': TEST_LOGIN, 'senha': TEST_PASSWORD},
    )

    assert response.status_code == 200
    assert calls['rate_limit_enabled'] is False
