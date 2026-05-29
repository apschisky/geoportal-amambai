from datetime import UTC, datetime
import inspect

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_admin_profiles
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.main import app as main_app
from app.repositories.auth_admin_profile_repository import InternalAdminProfileListItem
from app.services.auth_current_session_service import AuthenticatedCurrentSession


ADMIN_PROFILES_PATH = "/api/internal/admin/profiles"
EXPECTED_PERMISSION = "admin.perfis.ler"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 29, 15, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_admin_profiles.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def fake_profiles() -> list[InternalAdminProfileListItem]:
    return [
        InternalAdminProfileListItem(
            id=3,
            chave="administrador-interno-geoportal",
            nome="Administrador Interno do Geoportal",
            ativo=True,
            criado_em=CREATED_AT,
        )
    ]


def test_router_is_not_included_in_main_app_without_feature_flag() -> None:
    route_paths = {route.path for route in main_app.routes}

    assert ADMIN_PROFILES_PATH not in route_paths


def test_admin_profiles_returns_200_for_authenticated_user_with_permission(
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
    monkeypatch.setattr(
        internal_admin_profiles,
        "list_internal_admin_profiles",
        fake_profiles,
    )
    client = TestClient(app)

    response = client.get(ADMIN_PROFILES_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "perfis": [
            {
                "id": 3,
                "chave": "administrador-interno-geoportal",
                "nome": "Administrador Interno do Geoportal",
                "ativo": True,
                "criado_em": "2026-05-29T15:00:00Z",
            }
        ]
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }


def test_admin_profiles_returns_403_without_required_permission(
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
    monkeypatch.setattr(
        internal_admin_profiles,
        "list_internal_admin_profiles",
        fake_profiles,
    )
    client = TestClient(app)

    response = client.get(ADMIN_PROFILES_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "administrador-interno-geoportal" not in response.text


def test_admin_profiles_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(ADMIN_PROFILES_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_get_admin_profiles_does_not_require_internal_mutating_header(
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
    monkeypatch.setattr(
        internal_admin_profiles,
        "list_internal_admin_profiles",
        fake_profiles,
    )
    client = TestClient(app)

    response = client.get(ADMIN_PROFILES_PATH)

    assert response.status_code == 200


def test_admin_profiles_response_does_not_expose_sensitive_fields(
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
    monkeypatch.setattr(
        internal_admin_profiles,
        "list_internal_admin_profiles",
        fake_profiles,
    )
    client = TestClient(app)

    response = client.get(ADMIN_PROFILES_PATH)

    response_text = response.text
    body = response.json()
    assert response.status_code == 200
    assert set(body["perfis"][0]) == {
        "id",
        "chave",
        "nome",
        "ativo",
        "criado_em",
    }
    for forbidden in (
        "senha",
        "senha_hash",
        "token",
        "token_hash",
        "cookie",
        "session_secret",
        "DATABASE_URL",
        "SQL",
        "role",
        "GRANT",
        "sessao",
        "auditoria",
        "permissoes",
    ):
        assert forbidden not in response_text


def test_admin_profiles_router_uses_permission_without_hardcoded_login() -> None:
    source = inspect.getsource(internal_admin_profiles)
    route_paths = {route.path for route in internal_admin_profiles.router.routes}

    assert ADMIN_PROFILES_PATH in route_paths
    assert 'require_permission(LIST_INTERNAL_PROFILES_PERMISSION)' in source
    assert EXPECTED_PERMISSION in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "require_internal_mutating_request_header" not in source
    assert "create_internal_user" not in source
    assert "assign_internal" not in source
    assert "DELETE" not in source.upper()


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
