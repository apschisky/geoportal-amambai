from datetime import UTC, datetime
import inspect

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import internal_auth_smoke
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.main import app as main_app
from app.services.auth_current_session_service import AuthenticatedCurrentSession


EXPIRES_AT = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_auth_smoke.router)
    return app


def fake_authenticated_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=20,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def test_router_is_not_included_in_main_app() -> None:
    route_paths = {route.path for route in main_app.routes}

    assert "/api/internal/auth/smoke" not in route_paths


def test_unauthenticated_request_returns_generic_401() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get("/api/internal/auth/smoke")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_authenticated_request_returns_minimal_safe_payload() -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        fake_authenticated_session
    )
    client = TestClient(app)

    response = client.get("/api/internal/auth/smoke")

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "usuario_id": 20,
        "sessao_id": 30,
    }


def test_authenticated_response_does_not_expose_sensitive_fields() -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        fake_authenticated_session
    )
    client = TestClient(app)

    response = client.get("/api/internal/auth/smoke")

    body = response.json()
    assert "token" not in body
    assert "token_hash" not in body
    assert "session_secret" not in body
    assert "senha" not in body
    assert "senha_hash" not in body
    assert "password" not in body
    assert "email" not in body
    assert "nome" not in body
    assert "expira_em" not in body


def test_smoke_endpoint_uses_dependency_without_state_changes() -> None:
    source = inspect.getsource(internal_auth_smoke)

    assert "Depends(" in source
    assert "get_current_authenticated_session" in source
    assert "create_session" not in source
    assert "authenticate_user" not in source
    assert "record_login_attempt" not in source
    assert "record_successful_login" not in source
    assert "get_engine" not in source


def test_router_file_does_not_register_global_middleware_or_login_route() -> None:
    source = inspect.getsource(internal_auth_smoke)
    route_paths = {route.path for route in internal_auth_smoke.router.routes}

    assert "add_middleware" not in source
    assert "middleware" not in source
    assert "login" not in source.lower()
    assert "/login" not in route_paths


def test_isolated_app_contains_only_smoke_router_for_internal_auth() -> None:
    app = build_isolated_app()
    route_paths = {route.path for route in app.routes}

    assert "/api/internal/auth/smoke" in route_paths
    assert "/api/internal/auth/login" not in route_paths
