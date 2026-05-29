from datetime import UTC, datetime
import inspect

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_admin_users
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_NAME
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_VALUE
from app.main import app as main_app
from app.repositories.auth_admin_user_list_repository import InternalAdminUserListItem
from app.services.auth_admin_user_service import InternalUserConflictError
from app.services.auth_current_session_service import AuthenticatedCurrentSession


ADMIN_USERS_PATH = "/api/internal/admin/users"
ADMIN_USER_DETAIL_PATH = "/api/internal/admin/users/7"
EXPECTED_PERMISSION = "admin.usuarios.ler"
EXPECTED_CREATE_PERMISSION = "admin.usuarios.criar"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 29, 9, 30, tzinfo=UTC)
CREATE_PAYLOAD = {
    "login": " usuario.exemplo ",
    "nome": " Usuario Exemplo ",
    "email": None,
    "senha_inicial": "senha-ficticia-interna-123",
}


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_admin_users.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def fake_users() -> list[InternalAdminUserListItem]:
    return [
        InternalAdminUserListItem(
            id=7,
            login="admin.homologacao",
            nome="Administrador Homologacao",
            email=None,
            ativo=True,
            bloqueado=False,
            criado_em=CREATED_AT,
        )
    ]


def fake_user() -> InternalAdminUserListItem:
    return fake_users()[0]


def fake_created_user() -> InternalAdminUserListItem:
    return InternalAdminUserListItem(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=False,
        criado_em=CREATED_AT,
    )


def mutating_headers() -> dict[str, str]:
    return {
        INTERNAL_MUTATING_REQUEST_HEADER_NAME: INTERNAL_MUTATING_REQUEST_HEADER_VALUE,
    }


def test_router_is_not_included_in_main_app_without_feature_flag() -> None:
    route_paths = {route.path for route in main_app.routes}

    assert ADMIN_USERS_PATH not in route_paths


def test_admin_users_returns_200_for_authenticated_user_with_permission(
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
    monkeypatch.setattr(internal_admin_users, "list_internal_admin_users", fake_users)
    client = TestClient(app)

    response = client.get(ADMIN_USERS_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "usuarios": [
            {
                "id": 7,
                "login": "admin.homologacao",
                "nome": "Administrador Homologacao",
                "email": None,
                "ativo": True,
                "bloqueado": False,
                "criado_em": "2026-05-29T09:30:00Z",
            }
        ]
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }


def test_admin_users_returns_403_without_required_permission(
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
    monkeypatch.setattr(internal_admin_users, "list_internal_admin_users", fake_users)
    client = TestClient(app)

    response = client.get(ADMIN_USERS_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "admin.homologacao" not in response.text


def test_admin_users_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(ADMIN_USERS_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_get_admin_users_does_not_require_internal_mutating_header(
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
    monkeypatch.setattr(internal_admin_users, "list_internal_admin_users", fake_users)
    client = TestClient(app)

    response = client.get(ADMIN_USERS_PATH)

    assert response.status_code == 200


def test_admin_users_response_does_not_expose_sensitive_fields(
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
    monkeypatch.setattr(internal_admin_users, "list_internal_admin_users", fake_users)
    client = TestClient(app)

    response = client.get(ADMIN_USERS_PATH)

    response_text = response.text
    body = response.json()
    assert response.status_code == 200
    assert "usuarios" in body
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
        "bloqueado_ate",
    ):
        assert forbidden not in response_text


def test_admin_users_router_uses_permission_without_hardcoded_login() -> None:
    source = inspect.getsource(internal_admin_users)
    route_paths = {route.path for route in internal_admin_users.router.routes}

    assert ADMIN_USERS_PATH in route_paths
    assert "/api/internal/admin/users/{usuario_id}" in route_paths
    assert 'require_permission(LIST_INTERNAL_USERS_PERMISSION)' in source
    assert 'require_permission(CREATE_INTERNAL_USERS_PERMISSION)' in source
    assert EXPECTED_PERMISSION in source
    assert EXPECTED_CREATE_PERMISSION in source
    assert "require_internal_mutating_request_header" in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "DELETE" not in source.upper()
    assert "create_internal_user" not in source
    assert "update_internal_user_password" not in source
    assert "revoke_session" not in source


def test_admin_user_detail_returns_200_for_authenticated_user_with_permission(
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
        internal_admin_users,
        "get_internal_admin_user_by_id",
        lambda usuario_id: fake_user(),
    )
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "usuario": {
            "id": 7,
            "login": "admin.homologacao",
            "nome": "Administrador Homologacao",
            "email": None,
            "ativo": True,
            "bloqueado": False,
            "criado_em": "2026-05-29T09:30:00Z",
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }


def test_admin_user_detail_returns_404_when_user_does_not_exist(
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
        internal_admin_users,
        "get_internal_admin_user_by_id",
        lambda usuario_id: None,
    )
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert EXPECTED_PERMISSION not in response.text
    assert "admin.homologacao" not in response.text


def test_admin_user_detail_returns_403_without_required_permission(
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
        internal_admin_users,
        "get_internal_admin_user_by_id",
        lambda usuario_id: fake_user(),
    )
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "admin.homologacao" not in response.text


def test_admin_user_detail_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_get_admin_user_detail_does_not_require_internal_mutating_header(
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
        internal_admin_users,
        "get_internal_admin_user_by_id",
        lambda usuario_id: fake_user(),
    )
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    assert response.status_code == 200


def test_admin_user_detail_response_does_not_expose_sensitive_fields(
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
        internal_admin_users,
        "get_internal_admin_user_by_id",
        lambda usuario_id: fake_user(),
    )
    client = TestClient(app)

    response = client.get(ADMIN_USER_DETAIL_PATH)

    response_text = response.text
    body = response.json()
    assert response.status_code == 200
    assert set(body["usuario"]) == {
        "id",
        "login",
        "nome",
        "email",
        "ativo",
        "bloqueado",
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
        "bloqueado_ate",
        "atualizado_em",
        "ultimo_login_em",
    ):
        assert forbidden not in response_text


def test_create_admin_user_returns_201_for_authenticated_user_with_permission_and_header(
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
        return permission_code == EXPECTED_CREATE_PERMISSION

    created_kwargs: dict[str, object] = {}

    def fake_create_user(**kwargs: object) -> InternalAdminUserListItem:
        created_kwargs.update(kwargs)
        return fake_created_user()

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_admin_users,
        "create_basic_internal_admin_user",
        fake_create_user,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USERS_PATH,
        json=CREATE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 201
    assert response.json() == {
        "usuario": {
            "id": 8,
            "login": "usuario.exemplo",
            "nome": "Usuario Exemplo",
            "email": None,
            "ativo": True,
            "bloqueado": False,
            "criado_em": "2026-05-29T09:30:00Z",
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_CREATE_PERMISSION,
    }
    assert created_kwargs == {
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": None,
        "senha_inicial": "senha-ficticia-interna-123",
    }


def test_create_admin_user_returns_403_without_required_permission(
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
        internal_admin_users,
        "create_basic_internal_admin_user",
        lambda **kwargs: fake_created_user(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USERS_PATH,
        json=CREATE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_CREATE_PERMISSION not in response.text
    assert "usuario.exemplo" not in response.text


def test_create_admin_user_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.post(
        ADMIN_USERS_PATH,
        json=CREATE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_create_admin_user_requires_internal_mutating_header(
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
        internal_admin_users,
        "create_basic_internal_admin_user",
        lambda **kwargs: fake_created_user(),
    )
    client = TestClient(app)

    response = client.post(ADMIN_USERS_PATH, json=CREATE_PAYLOAD)

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}
    assert "usuario.exemplo" not in response.text


def test_create_admin_user_returns_409_on_login_or_email_conflict(
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

    def fake_create_user(**kwargs: object) -> InternalAdminUserListItem:
        raise InternalUserConflictError("internal user already exists")

    monkeypatch.setattr(
        internal_admin_users,
        "create_basic_internal_admin_user",
        fake_create_user,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USERS_PATH,
        json=CREATE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Conflict"}
    assert "constraint" not in response.text.lower()
    assert "mod_auth" not in response.text
    assert "usuario.exemplo" not in response.text


@pytest.mark.parametrize(
    "payload",
    [
        {**CREATE_PAYLOAD, "login": "   "},
        {**CREATE_PAYLOAD, "nome": "   "},
        {**CREATE_PAYLOAD, "email": "email-invalido"},
        {**CREATE_PAYLOAD, "senha_inicial": "   "},
        {**CREATE_PAYLOAD, "perfis": ["admin"]},
    ],
)
def test_create_admin_user_returns_422_for_invalid_payload(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, object],
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

    response = client.post(
        ADMIN_USERS_PATH,
        json=payload,
        headers=mutating_headers(),
    )

    assert response.status_code == 422
    for forbidden in (
        "senha-ficticia-interna-123",
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "mod_auth",
        "constraint",
    ):
        assert forbidden not in response.text


def test_create_admin_user_response_does_not_expose_sensitive_fields(
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
        internal_admin_users,
        "create_basic_internal_admin_user",
        lambda **kwargs: fake_created_user(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USERS_PATH,
        json=CREATE_PAYLOAD,
        headers=mutating_headers(),
    )

    response_text = response.text
    body = response.json()
    assert response.status_code == 201
    assert set(body["usuario"]) == {
        "id",
        "login",
        "nome",
        "email",
        "ativo",
        "bloqueado",
        "criado_em",
    }
    for forbidden in (
        "senha",
        "senha_inicial",
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
        "bloqueado_ate",
    ):
        assert forbidden not in response_text


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
