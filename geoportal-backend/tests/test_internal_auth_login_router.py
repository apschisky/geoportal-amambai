from datetime import UTC, datetime
import inspect
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import internal_auth_login
from app.dependencies.auth_dependencies import get_session_secret
from app.services.auth_service import AuthenticatedSession


LOGIN_PATH = "/api/internal/auth/login"
TEST_LOGIN = "usuario.ficticio"
TEST_PASSWORD = "credencial-de-teste"
TEST_SECRET = "configuracao-interna-de-teste"
RETURNED_OPAQUE_SESSION = "sessao-opaca-de-teste"
EXPIRES_AT = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_auth_login.router)
    app.dependency_overrides[get_session_secret] = lambda: TEST_SECRET
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


def test_internal_login_success_returns_minimal_payload(
    monkeypatch,
) -> None:
    calls: dict[str, Any] = {}

    def fake_authenticate_user(**kwargs: Any) -> AuthenticatedSession:
        calls.update(kwargs)
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
        "expira_em": "2026-05-27T13:00:00Z",
        "token": RETURNED_OPAQUE_SESSION,
    }
    assert calls == {
        "login_informado": f"  {TEST_LOGIN}  ",
        "password": TEST_PASSWORD,
        "session_secret": TEST_SECRET,
        "origem": "api_internal_auth_login",
    }


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


def test_internal_login_router_does_not_configure_cookie_or_duplicate_auth_logic() -> None:
    source = inspect.getsource(internal_auth_login)

    assert "authenticate_user" in source
    assert "set_cookie" not in source
    assert "create_session" not in source
    assert "verify_password" not in source
    assert "senha_hash" not in source
    assert "token_hash" not in source
    assert "get_engine" not in source
