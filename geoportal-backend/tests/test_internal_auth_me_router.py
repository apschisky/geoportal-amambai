from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import internal_auth_me
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.services.auth_current_session_service import AuthenticatedCurrentSession


ME_PATH = "/api/internal/auth/me"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_auth_me.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def test_internal_me_returns_authenticated_user_and_sorted_permissions(
    monkeypatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        internal_auth_me,
        "get_user_permissions",
        lambda usuario_id: {
            "iluminacao.solicitacoes.ler",
            "admin.usuarios.ler",
        },
    )
    client = TestClient(app)

    response = client.get(ME_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "usuario_id": 7,
        "permissoes": [
            "admin.usuarios.ler",
            "iluminacao.solicitacoes.ler",
        ],
    }


def test_internal_me_response_does_not_expose_sensitive_fields(monkeypatch) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        internal_auth_me,
        "get_user_permissions",
        lambda usuario_id: {"admin.usuarios.ler"},
    )
    client = TestClient(app)

    response = client.get(ME_PATH)

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
    assert "session_secret" not in response_text
    assert "DATABASE_URL" not in response_text


def test_internal_me_requires_authentication() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(ME_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
