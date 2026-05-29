from datetime import UTC, datetime
import inspect

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_auth_permission_smoke
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.main import app as main_app
from app.services.auth_current_session_service import AuthenticatedCurrentSession


PERMISSION_SMOKE_PATH = "/api/internal/auth/permission-smoke"
EXPECTED_PERMISSION = "internal.auth.me"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_auth_permission_smoke.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def test_router_is_not_included_in_main_app_without_feature_flag() -> None:
    route_paths = {route.path for route in main_app.routes}

    assert PERMISSION_SMOKE_PATH not in route_paths


def test_permission_smoke_returns_200_for_authenticated_user_with_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    calls: dict[str, object] = {}

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        calls.update(
            {
                "usuario_id": usuario_id,
                "permission_code": permission_code,
            }
        )
        return True

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    client = TestClient(app)

    response = client.get(PERMISSION_SMOKE_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "authorized": True,
        "permission": EXPECTED_PERMISSION,
        "usuario_id": 7,
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }


def test_permission_smoke_returns_403_for_authenticated_user_without_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )
    client = TestClient(app)

    response = client.get(PERMISSION_SMOKE_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert "internal.auth.me" not in response.text
    assert "admin.homologacao" not in response.text


def test_permission_smoke_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(PERMISSION_SMOKE_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_get_permission_smoke_does_not_require_internal_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    client = TestClient(app)

    response = client.get(PERMISSION_SMOKE_PATH)

    assert response.status_code == 200


def test_permission_smoke_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    client = TestClient(app)

    response = client.get(PERMISSION_SMOKE_PATH)

    body = response.json()
    response_text = response.text
    assert response.status_code == 200
    assert "token" not in body
    assert "cookie" not in body
    assert "senha" not in body
    assert "senha_hash" not in body
    assert "token_hash" not in body
    assert "session_secret" not in body
    assert "DATABASE_URL" not in body
    assert "SQL" not in body
    assert "role" not in body
    assert "GRANT" not in body
    assert "token_hash" not in response_text
    assert "session_secret" not in response_text
    assert "DATABASE_URL" not in response_text
    assert "GRANT" not in response_text


def test_permission_smoke_router_uses_require_permission_without_hardcoded_login() -> None:
    source = inspect.getsource(internal_auth_permission_smoke)
    route_paths = {route.path for route in internal_auth_permission_smoke.router.routes}

    assert PERMISSION_SMOKE_PATH in route_paths
    assert 'require_permission(INTERNAL_AUTH_ME_PERMISSION)' in source
    assert EXPECTED_PERMISSION in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "create_session" not in source
    assert "authenticate_user" not in source
    assert "get_engine" not in source
    assert "DELETE" not in source.upper()


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
