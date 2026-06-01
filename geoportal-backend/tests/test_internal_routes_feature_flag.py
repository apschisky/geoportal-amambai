from collections.abc import Generator
from datetime import UTC, datetime
import importlib

import pytest
from fastapi.testclient import TestClient

from app.core.internal_routes_config import INTERNAL_ROUTES_ENABLED_ENV_VAR
from app.dependencies.auth_dependencies import SESSION_SECRET_ENV_VAR
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.services.auth_current_session_service import AuthenticatedCurrentSession


INTERNAL_SMOKE_PATH = "/api/internal/auth/smoke"
INTERNAL_LOGIN_PATH = "/api/internal/auth/login"
INTERNAL_LOGOUT_PATH = "/api/internal/auth/logout"
INTERNAL_ME_PATH = "/api/internal/auth/me"
INTERNAL_PERMISSION_SMOKE_PATH = "/api/internal/auth/permission-smoke"
INTERNAL_ADMIN_PROFILES_PATH = "/api/internal/admin/profiles"
INTERNAL_ADMIN_USERS_PATH = "/api/internal/admin/users"
INTERNAL_ADMIN_USER_DETAIL_ROUTE = "/api/internal/admin/users/{usuario_id}"
INTERNAL_ADMIN_USER_DETAIL_PATH = "/api/internal/admin/users/7"
INTERNAL_ADMIN_USER_PROFILES_ROUTE = "/api/internal/admin/users/{usuario_id}/profiles"
INTERNAL_ADMIN_USER_PROFILES_PATH = "/api/internal/admin/users/7/profiles"
INTERNAL_ADMIN_USER_BLOCK_ROUTE = "/api/internal/admin/users/{usuario_id}/block"
INTERNAL_ADMIN_USER_BLOCK_PATH = "/api/internal/admin/users/7/block"
INTERNAL_ADMIN_USER_UNBLOCK_ROUTE = "/api/internal/admin/users/{usuario_id}/unblock"
INTERNAL_ADMIN_USER_UNBLOCK_PATH = "/api/internal/admin/users/7/unblock"
INTERNAL_ADMIN_USER_RESET_PASSWORD_ROUTE = (
    "/api/internal/admin/users/{usuario_id}/reset-password"
)
INTERNAL_ADMIN_USER_RESET_PASSWORD_PATH = "/api/internal/admin/users/7/reset-password"
EXPIRES_AT = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)


def reload_main_app() -> object:
    import app.main as main_module

    return importlib.reload(main_module).app


@pytest.fixture(autouse=True)
def reset_main_app_after_test(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[None, None, None]:
    yield
    monkeypatch.delenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, raising=False)
    monkeypatch.delenv(SESSION_SECRET_ENV_VAR, raising=False)
    reload_main_app()


def route_paths(app: object) -> set[str]:
    return {route.path for route in app.routes}


def fake_authenticated_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=20,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


@pytest.mark.parametrize("value", [None, "false", "invalid-value"])
def test_internal_smoke_route_is_absent_when_flag_is_not_enabled(
    monkeypatch: pytest.MonkeyPatch,
    value: str | None,
) -> None:
    if value is None:
        monkeypatch.delenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, raising=False)
    else:
        monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, value)

    app = reload_main_app()

    assert INTERNAL_SMOKE_PATH not in route_paths(app)
    assert INTERNAL_LOGIN_PATH not in route_paths(app)
    assert INTERNAL_LOGOUT_PATH not in route_paths(app)
    assert INTERNAL_ME_PATH not in route_paths(app)
    assert INTERNAL_PERMISSION_SMOKE_PATH not in route_paths(app)
    assert INTERNAL_ADMIN_PROFILES_PATH not in route_paths(app)
    assert INTERNAL_ADMIN_USERS_PATH not in route_paths(app)
    assert INTERNAL_ADMIN_USER_DETAIL_ROUTE not in route_paths(app)
    assert INTERNAL_ADMIN_USER_PROFILES_ROUTE not in route_paths(app)
    assert INTERNAL_ADMIN_USER_BLOCK_ROUTE not in route_paths(app)
    assert INTERNAL_ADMIN_USER_UNBLOCK_ROUTE not in route_paths(app)
    assert INTERNAL_ADMIN_USER_RESET_PASSWORD_ROUTE not in route_paths(app)


def test_internal_smoke_route_returns_404_when_flag_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, raising=False)
    app = reload_main_app()
    client = TestClient(app)

    response = client.get(INTERNAL_SMOKE_PATH)

    assert response.status_code == 404
    assert client.post(INTERNAL_LOGIN_PATH, json={}).status_code == 404
    assert client.post(INTERNAL_LOGOUT_PATH).status_code == 404
    assert client.get(INTERNAL_ME_PATH).status_code == 404
    assert client.get(INTERNAL_PERMISSION_SMOKE_PATH).status_code == 404
    assert client.get(INTERNAL_ADMIN_PROFILES_PATH).status_code == 404
    assert client.get(INTERNAL_ADMIN_USERS_PATH).status_code == 404
    assert client.post(INTERNAL_ADMIN_USERS_PATH, json={}).status_code == 404
    assert client.get(INTERNAL_ADMIN_USER_DETAIL_PATH).status_code == 404
    assert client.post(INTERNAL_ADMIN_USER_PROFILES_PATH, json={}).status_code == 404
    assert client.post(INTERNAL_ADMIN_USER_BLOCK_PATH).status_code == 404
    assert client.post(INTERNAL_ADMIN_USER_UNBLOCK_PATH).status_code == 404
    assert client.post(INTERNAL_ADMIN_USER_RESET_PASSWORD_PATH, json={}).status_code == 404


def test_internal_smoke_route_is_present_when_flag_is_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, "true")
    app = reload_main_app()

    assert INTERNAL_SMOKE_PATH in route_paths(app)
    assert INTERNAL_LOGIN_PATH in route_paths(app)
    assert INTERNAL_LOGOUT_PATH in route_paths(app)
    assert INTERNAL_ME_PATH in route_paths(app)
    assert INTERNAL_PERMISSION_SMOKE_PATH in route_paths(app)
    assert INTERNAL_ADMIN_PROFILES_PATH in route_paths(app)
    assert INTERNAL_ADMIN_USERS_PATH in route_paths(app)
    assert INTERNAL_ADMIN_USER_DETAIL_ROUTE in route_paths(app)
    assert INTERNAL_ADMIN_USER_PROFILES_ROUTE in route_paths(app)
    assert INTERNAL_ADMIN_USER_BLOCK_ROUTE in route_paths(app)
    assert INTERNAL_ADMIN_USER_UNBLOCK_ROUTE in route_paths(app)
    assert INTERNAL_ADMIN_USER_RESET_PASSWORD_ROUTE in route_paths(app)


def test_enabled_internal_smoke_route_without_auth_returns_generic_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, "true")
    monkeypatch.setenv(SESSION_SECRET_ENV_VAR, "segredo-ficticio-para-teste")
    app = reload_main_app()
    client = TestClient(app)

    response = client.get(INTERNAL_SMOKE_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_enabled_internal_smoke_route_with_dependency_override_returns_200(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, "true")
    app = reload_main_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        fake_authenticated_session
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SMOKE_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "usuario_id": 20,
        "sessao_id": 30,
    }


def test_enabled_internal_smoke_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, "true")
    app = reload_main_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        fake_authenticated_session
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SMOKE_PATH)

    body = response.json()
    assert "token" not in body
    assert "token_hash" not in body
    assert "session_secret" not in body
    assert "senha" not in body
    assert "senha_hash" not in body
    assert "password" not in body
    assert "nome" not in body
    assert "email" not in body
    assert "permissoes" not in body


def test_public_routes_continue_available_when_internal_flag_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, raising=False)
    app = reload_main_app()
    client = TestClient(app)

    assert client.get("/api/health").status_code == 200
    assert client.get("/api/public/iluminacao/health").status_code == 200
    assert client.get("/api/version").status_code == 200


def test_public_iluminacao_route_does_not_require_internal_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(INTERNAL_ROUTES_ENABLED_ENV_VAR, "true")
    app = reload_main_app()
    client = TestClient(app)

    assert client.get("/api/public/iluminacao/health").status_code == 200
