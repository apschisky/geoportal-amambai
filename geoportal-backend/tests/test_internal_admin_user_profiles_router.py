from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_admin_users
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_NAME
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_VALUE
from app.repositories.auth_admin_security_repository import (
    AdministrativeSecurityDeniedError,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalAdminUserProfileLink,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkInactiveConflictError,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkNotFoundError,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession


CREATED_AT = datetime(2026, 6, 25, 10, 0, tzinfo=UTC)
EXPIRES_AT = datetime(2030, 6, 25, 10, 0, tzinfo=UTC)
LIST_PATH = "/api/internal/admin/users/8/profiles"
DEACTIVATE_PATH = "/api/internal/admin/users/8/profiles/3/deactivate"
DEACTIVATE_PAYLOAD = {
    "modulo": None,
    "justificativa": "Remocao administrativa controlada.",
}


def build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_admin_users.router)
    return app


def authenticated_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def profile_link(
    *,
    modulo: str | None = None,
    ativo: bool = True,
) -> InternalAdminUserProfileLink:
    return InternalAdminUserProfileLink(
        usuario_id=8,
        perfil_id=3,
        chave="administrador-interno-geoportal",
        nome="Administrador Interno",
        modulo=modulo,
        ativo=ativo,
        criado_em=CREATED_AT,
    )


def headers() -> dict[str, str]:
    return {
        INTERNAL_MUTATING_REQUEST_HEADER_NAME:
            INTERNAL_MUTATING_REQUEST_HEADER_VALUE,
    }


def allow_permission(
    monkeypatch: pytest.MonkeyPatch,
    *,
    expected: str,
) -> None:
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: permission_code == expected,
    )


def test_lists_user_profile_links_with_read_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(monkeypatch, expected="admin.usuarios.ler")
    monkeypatch.setattr(
        internal_admin_users,
        "list_internal_admin_user_profiles",
        lambda **kwargs: [profile_link(), profile_link(modulo="iluminacao")],
    )

    response = TestClient(app).get(LIST_PATH)

    assert response.status_code == 200
    assert response.json()["vinculos"] == [
        {
            "perfil_id": 3,
            "chave": "administrador-interno-geoportal",
            "nome": "Administrador Interno",
            "modulo": None,
            "ativo": True,
            "criado_em": CREATED_AT.isoformat().replace("+00:00", "Z"),
        },
        {
            "perfil_id": 3,
            "chave": "administrador-interno-geoportal",
            "nome": "Administrador Interno",
            "modulo": "iluminacao",
            "ativo": True,
            "criado_em": CREATED_AT.isoformat().replace("+00:00", "Z"),
        },
    ]


def test_list_requires_session() -> None:
    app = build_app()

    def unauthenticated() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = unauthenticated

    response = TestClient(app).get(LIST_PATH)

    assert response.status_code == 401


def test_list_requires_read_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )

    response = TestClient(app).get(LIST_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


def test_list_missing_user_returns_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(monkeypatch, expected="admin.usuarios.ler")

    def missing(**kwargs: object) -> list[InternalAdminUserProfileLink]:
        raise InternalUserProfileLinkNotFoundError("missing")

    monkeypatch.setattr(
        internal_admin_users,
        "list_internal_admin_user_profiles",
        missing,
    )

    response = TestClient(app).get(LIST_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_deactivates_profile_with_new_permission_and_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(
        monkeypatch,
        expected="admin.usuarios.remover_perfis",
    )
    calls: dict[str, object] = {}

    def deactivate(**kwargs: object) -> InternalAdminUserProfileLink:
        calls.update(kwargs)
        return profile_link(ativo=False)

    monkeypatch.setattr(
        internal_admin_users,
        "deactivate_internal_admin_user_profile",
        deactivate,
    )

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=DEACTIVATE_PAYLOAD,
        headers=headers(),
    )

    assert response.status_code == 200
    assert response.json()["vinculo"]["ativo"] is False
    assert calls["usuario_id"] == 8
    assert calls["perfil_id"] == 3
    assert calls["justificativa"] == "Remocao administrativa controlada."
    assert calls["ator_usuario_id"] == 7


def test_deactivation_requires_internal_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(
        monkeypatch,
        expected="admin.usuarios.remover_perfis",
    )

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=DEACTIVATE_PAYLOAD,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}


def test_deactivation_requires_new_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=DEACTIVATE_PAYLOAD,
        headers=headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert "remover_perfis" not in response.text


@pytest.mark.parametrize(
    "payload",
    [
        {"modulo": None},
        {"modulo": None, "justificativa": "curta"},
        {
            "modulo": None,
            "justificativa": "Remocao administrativa controlada.",
            "campo_extra": True,
        },
    ],
)
def test_deactivation_rejects_invalid_payload(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, object],
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(
        monkeypatch,
        expected="admin.usuarios.remover_perfis",
    )

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=payload,
        headers=headers(),
    )

    assert response.status_code == 422
    assert "campo_extra" not in response.text


@pytest.mark.parametrize(
    ("exception", "expected_status", "expected_detail"),
    [
        (
            AdministrativeSecurityDeniedError("security reason"),
            403,
            "Forbidden",
        ),
        (
            InternalUserProfileLinkNotFoundError("missing"),
            404,
            "Not found",
        ),
        (
            InternalUserProfileLinkInactiveConflictError("inactive"),
            409,
            "Conflict",
        ),
    ],
)
def test_deactivation_errors_are_sanitized(
    monkeypatch: pytest.MonkeyPatch,
    exception: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    app = build_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_session
    )
    allow_permission(
        monkeypatch,
        expected="admin.usuarios.remover_perfis",
    )

    def fail(**kwargs: object) -> InternalAdminUserProfileLink:
        raise exception

    monkeypatch.setattr(
        internal_admin_users,
        "deactivate_internal_admin_user_profile",
        fail,
    )

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=DEACTIVATE_PAYLOAD,
        headers=headers(),
    )

    assert response.status_code == expected_status
    assert response.json() == {"detail": expected_detail}
    assert str(exception) not in response.text


def test_deactivation_returns_401_without_session() -> None:
    app = build_app()

    def unauthenticated() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = unauthenticated

    response = TestClient(app).post(
        DEACTIVATE_PATH,
        json=DEACTIVATE_PAYLOAD,
        headers=headers(),
    )

    assert response.status_code == 401
