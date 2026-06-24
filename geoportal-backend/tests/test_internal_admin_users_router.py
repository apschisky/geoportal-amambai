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
from app.services.auth_admin_user_service import AssignedInternalUserProfile
from app.services.auth_admin_user_service import AdministrativeSecurityDeniedError
from app.services.auth_admin_user_service import InternalUserConflictError
from app.services.auth_admin_user_service import InternalUserNotFoundError
from app.services.auth_admin_user_service import InternalUserProfileInactiveConflictError
from app.services.auth_admin_user_service import InternalUserProfileNotFoundError
from app.services.auth_admin_user_service import UpdatedInternalUserBlockStatus
from app.services.auth_admin_user_service import UpdatedInternalUserPasswordStatus
from app.services.auth_current_session_service import AuthenticatedCurrentSession


ADMIN_USERS_PATH = "/api/internal/admin/users"
ADMIN_USER_DETAIL_PATH = "/api/internal/admin/users/7"
ADMIN_USER_PROFILES_PATH = "/api/internal/admin/users/8/profiles"
ADMIN_USER_BLOCK_PATH = "/api/internal/admin/users/8/block"
ADMIN_USER_UNBLOCK_PATH = "/api/internal/admin/users/8/unblock"
ADMIN_USER_RESET_PASSWORD_PATH = "/api/internal/admin/users/8/reset-password"
EXPECTED_PERMISSION = "admin.usuarios.ler"
EXPECTED_CREATE_PERMISSION = "admin.usuarios.criar"
EXPECTED_ASSIGN_PROFILE_PERMISSION = "admin.usuarios.atribuir_perfis"
EXPECTED_BLOCK_PERMISSION = "admin.usuarios.bloquear"
EXPECTED_RESET_PASSWORD_PERMISSION = "admin.usuarios.redefinir_senha"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 29, 9, 30, tzinfo=UTC)
CREATE_PAYLOAD = {
    "login": " usuario.exemplo ",
    "nome": " Usuario Exemplo ",
    "email": None,
    "senha_inicial": "senha-ficticia-interna-123",
}
PROFILE_PAYLOAD = {
    "perfil_id": 3,
    "modulo": None,
}
RESET_PASSWORD_PAYLOAD = {
    "nova_senha": "nova-senha-ficticia-interna-456",
    "confirmar_nova_senha": "nova-senha-ficticia-interna-456",
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


def fake_profile_assignment(
    *,
    created: bool = True,
    modulo: str | None = None,
) -> AssignedInternalUserProfile:
    return AssignedInternalUserProfile(
        usuario_id=8,
        perfil_id=3,
        modulo=modulo,
        ativo=True,
        created=created,
    )


def fake_block_status(*, bloqueado: bool) -> UpdatedInternalUserBlockStatus:
    return UpdatedInternalUserBlockStatus(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=bloqueado,
        criado_em=CREATED_AT,
    )


def fake_password_status(
    *,
    bloqueado: bool = False,
) -> UpdatedInternalUserPasswordStatus:
    return UpdatedInternalUserPasswordStatus(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=bloqueado,
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
    assert "/api/internal/admin/users/{usuario_id}/profiles" in route_paths
    assert "/api/internal/admin/users/{usuario_id}/block" in route_paths
    assert "/api/internal/admin/users/{usuario_id}/unblock" in route_paths
    assert "/api/internal/admin/users/{usuario_id}/reset-password" in route_paths
    assert 'require_permission(LIST_INTERNAL_USERS_PERMISSION)' in source
    assert 'require_permission(CREATE_INTERNAL_USERS_PERMISSION)' in source
    assert 'require_permission(ASSIGN_INTERNAL_USER_PROFILE_PERMISSION)' in source
    assert 'require_permission(BLOCK_INTERNAL_USERS_PERMISSION)' in source
    assert 'require_permission(RESET_INTERNAL_USER_PASSWORD_PERMISSION)' in source
    assert EXPECTED_PERMISSION in source
    assert EXPECTED_CREATE_PERMISSION in source
    assert EXPECTED_ASSIGN_PROFILE_PERMISSION in source
    assert EXPECTED_BLOCK_PERMISSION in source
    assert EXPECTED_RESET_PASSWORD_PERMISSION in source
    assert "require_internal_mutating_request_header" in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "DELETE" not in source.upper()
    assert "create_internal_user" not in source
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
        'ator_usuario_id': 7,
        'ator_login': None,
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


@pytest.mark.parametrize(
    "weak_password",
    [
        "abc12",
        "abcdef",
        "123456",
        "usuario.exemplo",
        "Usuario Exemplo",
        "senha123",
    ],
)
def test_create_admin_user_returns_422_for_weak_initial_password_without_leaking_it(
    monkeypatch: pytest.MonkeyPatch,
    weak_password: str,
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
        json={**CREATE_PAYLOAD, "senha_inicial": weak_password},
        headers=mutating_headers(),
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid payload"}
    assert "senha_inicial" not in response.text
    assert weak_password not in response.text


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


@pytest.mark.parametrize(
    ("path", "attribute", "expected_blocked"),
    [
        (ADMIN_USER_BLOCK_PATH, "block_internal_admin_user", True),
        (ADMIN_USER_UNBLOCK_PATH, "unblock_internal_admin_user", False),
    ],
)
def test_block_actions_return_200_for_authenticated_user_with_permission_and_header(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    attribute: str,
    expected_blocked: bool,
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
        return permission_code == EXPECTED_BLOCK_PERMISSION

    action_kwargs: dict[str, object] = {}

    def fake_block_action(**kwargs: object) -> UpdatedInternalUserBlockStatus:
        assert kwargs.pop('ator_usuario_id') == 7
        assert kwargs.pop('ator_login') is None
        action_kwargs.update(kwargs)
        return fake_block_status(bloqueado=expected_blocked)

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(internal_admin_users, attribute, fake_block_action)
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

    assert response.status_code == 200
    assert response.json() == {
        "usuario": {
            "id": 8,
            "login": "usuario.exemplo",
            "nome": "Usuario Exemplo",
            "email": None,
            "ativo": True,
            "bloqueado": expected_blocked,
            "criado_em": "2026-05-29T09:30:00Z",
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_BLOCK_PERMISSION,
    }
    assert action_kwargs == {"usuario_id": 8}


@pytest.mark.parametrize("path", [ADMIN_USER_BLOCK_PATH, ADMIN_USER_UNBLOCK_PATH])
def test_block_actions_return_401_without_valid_session(path: str) -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


@pytest.mark.parametrize(
    ("path", "attribute"),
    [
        (ADMIN_USER_BLOCK_PATH, "block_internal_admin_user"),
        (ADMIN_USER_UNBLOCK_PATH, "unblock_internal_admin_user"),
    ],
)
def test_block_actions_return_403_without_required_permission(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    attribute: str,
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
        attribute,
        lambda **kwargs: fake_block_status(bloqueado=True),
    )
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_BLOCK_PERMISSION not in response.text
    assert "usuario.exemplo" not in response.text


@pytest.mark.parametrize("path", [ADMIN_USER_BLOCK_PATH, ADMIN_USER_UNBLOCK_PATH])
def test_block_actions_require_internal_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
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

    response = client.post(path)

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}


@pytest.mark.parametrize(
    ("path", "attribute"),
    [
        (ADMIN_USER_BLOCK_PATH, "block_internal_admin_user"),
        (ADMIN_USER_UNBLOCK_PATH, "unblock_internal_admin_user"),
    ],
)
def test_block_actions_return_404_when_user_does_not_exist(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    attribute: str,
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

    def fake_block_action(**kwargs: object) -> UpdatedInternalUserBlockStatus:
        raise InternalUserNotFoundError("internal user was not found")

    monkeypatch.setattr(internal_admin_users, attribute, fake_block_action)
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "mod_auth" not in response.text


@pytest.mark.parametrize(
    ("path", "attribute"),
    [
        ("/api/internal/admin/users/0/block", "block_internal_admin_user"),
        ("/api/internal/admin/users/0/unblock", "unblock_internal_admin_user"),
    ],
)
def test_block_actions_return_422_for_invalid_user_id(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    attribute: str,
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

    def fake_block_action(**kwargs: object) -> UpdatedInternalUserBlockStatus:
        raise ValueError("usuario_id must be positive")

    monkeypatch.setattr(internal_admin_users, attribute, fake_block_action)
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid payload"}


@pytest.mark.parametrize(
    ("path", "attribute", "expected_blocked"),
    [
        (ADMIN_USER_BLOCK_PATH, "block_internal_admin_user", True),
        (ADMIN_USER_UNBLOCK_PATH, "unblock_internal_admin_user", False),
    ],
)
def test_block_actions_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    attribute: str,
    expected_blocked: bool,
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
        attribute,
        lambda **kwargs: fake_block_status(bloqueado=expected_blocked),
    )
    client = TestClient(app)

    response = client.post(path, headers=mutating_headers())

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


def test_reset_password_returns_200_for_authenticated_user_with_permission_and_header(
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
        return permission_code == EXPECTED_RESET_PASSWORD_PERMISSION

    reset_kwargs: dict[str, object] = {}

    def fake_reset_password(**kwargs: object) -> UpdatedInternalUserPasswordStatus:
        reset_kwargs.update(kwargs)
        return fake_password_status()

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_admin_users,
        "reset_internal_admin_user_password",
        fake_reset_password,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 200
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
        "permission_code": EXPECTED_RESET_PASSWORD_PERMISSION,
    }
    assert reset_kwargs == {
        'ator_usuario_id': 7,
        'ator_login': None,
        "usuario_id": 8,
        "nova_senha": "nova-senha-ficticia-interna-456",
        "confirmar_nova_senha": "nova-senha-ficticia-interna-456",
    }


def test_reset_password_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_reset_password_returns_403_without_required_permission(
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
        "reset_internal_admin_user_password",
        lambda **kwargs: fake_password_status(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_RESET_PASSWORD_PERMISSION not in response.text
    assert "nova-senha-ficticia-interna-456" not in response.text


def test_reset_password_requires_internal_mutating_header(
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
        "reset_internal_admin_user_password",
        lambda **kwargs: fake_password_status(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}


def test_reset_password_returns_404_when_user_does_not_exist(
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

    def fake_reset_password(**kwargs: object) -> UpdatedInternalUserPasswordStatus:
        raise InternalUserNotFoundError("internal user was not found")

    monkeypatch.setattr(
        internal_admin_users,
        "reset_internal_admin_user_password",
        fake_reset_password,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "mod_auth" not in response.text


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"nova_senha": " ", "confirmar_nova_senha": " "},
        {
            "nova_senha": "nova-senha-ficticia-interna-456",
            "confirmar_nova_senha": "nova-senha-ficticia-interna-456",
            "usuario_id": 8,
        },
        {
            "nova_senha": "nova-senha-ficticia-interna-456",
            "confirmar_nova_senha": "nova-senha-ficticia-interna-456",
            "senha_hash": "hash-ficticio-nao-real",
        },
    ],
)
def test_reset_password_returns_422_for_invalid_payload(
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
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=payload,
        headers=mutating_headers(),
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid payload"}
    for forbidden in (
        "nova_senha",
        "confirmar_nova_senha",
        "hash-ficticio-nao-real",
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "mod_auth",
        "constraint",
    ):
        assert forbidden not in response.text


@pytest.mark.parametrize(
    "payload",
    [
        {
            "nova_senha": "nova-senha-ficticia-interna-456",
            "confirmar_nova_senha": "outra-senha-ficticia-interna-789",
        },
        {
            "nova_senha": "abc12",
            "confirmar_nova_senha": "abc12",
        },
    ],
)
def test_reset_password_returns_422_for_mismatch_or_weak_password(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, str],
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

    def fake_reset_password(**kwargs: object) -> UpdatedInternalUserPasswordStatus:
        raise ValueError("password does not meet policy")

    monkeypatch.setattr(
        internal_admin_users,
        "reset_internal_admin_user_password",
        fake_reset_password,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=payload,
        headers=mutating_headers(),
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid payload"}
    assert payload["nova_senha"] not in response.text
    assert payload["confirmar_nova_senha"] not in response.text
    assert "password does not meet policy" not in response.text


def test_reset_password_response_does_not_expose_sensitive_fields(
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
        "reset_internal_admin_user_password",
        lambda **kwargs: fake_password_status(bloqueado=True),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_RESET_PASSWORD_PATH,
        json=RESET_PASSWORD_PAYLOAD,
        headers=mutating_headers(),
    )

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
    assert body["usuario"]["bloqueado"] is True
    for forbidden in (
        "senha",
        "nova_senha",
        "confirmar_nova_senha",
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


def test_assign_admin_user_profile_returns_201_for_authenticated_user_with_permission_and_header(
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
        return permission_code == EXPECTED_ASSIGN_PROFILE_PERMISSION

    assignment_kwargs: dict[str, object] = {}

    def fake_assign_profile(**kwargs: object) -> AssignedInternalUserProfile:
        assignment_kwargs.update(kwargs)
        return fake_profile_assignment(created=True)

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_admin_users,
        "assign_internal_admin_user_profile",
        fake_assign_profile,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 201
    assert response.json() == {
        "vinculo": {
            "usuario_id": 8,
            "perfil_id": 3,
            "modulo": None,
            "ativo": True,
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_ASSIGN_PROFILE_PERMISSION,
    }
    assert assignment_kwargs == {
        'ator_usuario_id': 7,
        'ator_login': None,
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": None,
    }


def test_assign_admin_user_profile_returns_200_when_active_link_exists(
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
        "assign_internal_admin_user_profile",
        lambda **kwargs: fake_profile_assignment(created=False),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json()["vinculo"] == {
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": None,
        "ativo": True,
    }


def test_assign_admin_user_profile_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_assign_admin_user_profile_returns_403_without_required_permission(
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
        "assign_internal_admin_user_profile",
        lambda **kwargs: fake_profile_assignment(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_ASSIGN_PROFILE_PERMISSION not in response.text
    assert "perfil_id" not in response.text


def test_assign_admin_user_profile_requires_internal_mutating_header(
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
        "assign_internal_admin_user_profile",
        lambda **kwargs: fake_profile_assignment(),
    )
    client = TestClient(app)

    response = client.post(ADMIN_USER_PROFILES_PATH, json=PROFILE_PAYLOAD)

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}


def test_assign_admin_user_profile_returns_404_when_user_or_profile_is_missing(
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

    def fake_assign_profile(**kwargs: object) -> AssignedInternalUserProfile:
        raise InternalUserProfileNotFoundError("internal user or profile not found")

    monkeypatch.setattr(
        internal_admin_users,
        "assign_internal_admin_user_profile",
        fake_assign_profile,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "mod_auth" not in response.text


def test_assign_admin_user_profile_returns_409_for_inactive_existing_link(
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

    def fake_assign_profile(**kwargs: object) -> AssignedInternalUserProfile:
        raise InternalUserProfileInactiveConflictError("inactive link")

    monkeypatch.setattr(
        internal_admin_users,
        "assign_internal_admin_user_profile",
        fake_assign_profile,
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Conflict"}
    assert "inactive" not in response.text


@pytest.mark.parametrize(
    "payload",
    [
        {"perfil_id": 0, "modulo": None},
        {"perfil_id": -1, "modulo": None},
        {"perfil_id": 3, "usuario_id": 8},
        {"perfil_id": 3, "perfil_chave": "administrador-interno-geoportal"},
        {"perfil_id": 3, "permissoes": ["internal.auth.me"]},
        {"perfil_id": 3, "senha_hash": "hash-ficticio-nao-real"},
    ],
)
def test_assign_admin_user_profile_returns_422_for_invalid_payload(
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
        ADMIN_USER_PROFILES_PATH,
        json=payload,
        headers=mutating_headers(),
    )

    assert response.status_code == 422
    for forbidden in (
        "hash-ficticio-nao-real",
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "mod_auth",
        "constraint",
    ):
        assert forbidden not in response.text


def test_assign_admin_user_profile_response_does_not_expose_sensitive_fields(
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
        "assign_internal_admin_user_profile",
        lambda **kwargs: fake_profile_assignment(),
    )
    client = TestClient(app)

    response = client.post(
        ADMIN_USER_PROFILES_PATH,
        json=PROFILE_PAYLOAD,
        headers=mutating_headers(),
    )

    response_text = response.text
    body = response.json()
    assert response.status_code == 201
    assert set(body["vinculo"]) == {
        "usuario_id",
        "perfil_id",
        "modulo",
        "ativo",
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
    ):
        assert forbidden not in response_text


@pytest.mark.parametrize(
    ('path', 'service_name', 'payload'),
    [
        (ADMIN_USER_BLOCK_PATH, 'block_internal_admin_user', None),
        (
            ADMIN_USER_RESET_PASSWORD_PATH,
            'reset_internal_admin_user_password',
            RESET_PASSWORD_PAYLOAD,
        ),
        (
            ADMIN_USER_PROFILES_PATH,
            'assign_internal_admin_user_profile',
            PROFILE_PAYLOAD,
        ),
    ],
)
def test_administrative_security_denial_returns_sanitized_403(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    service_name: str,
    payload: dict[str, object] | None,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        'has_permission',
        lambda usuario_id, permission_code: True,
    )

    def deny_action(**kwargs: object) -> object:
        raise AdministrativeSecurityDeniedError('internal security reason')

    monkeypatch.setattr(internal_admin_users, service_name, deny_action)
    client = TestClient(app)

    response = client.post(
        path,
        json=payload,
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {'detail': 'Forbidden'}
    assert 'internal security reason' not in response.text
    assert 'last_effective_admin' not in response.text


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
