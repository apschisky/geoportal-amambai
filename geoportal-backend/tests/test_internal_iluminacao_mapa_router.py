from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_iluminacao
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.schemas.iluminacao import (
    IluminacaoMapaOcorrenciaItem,
    IluminacaoMapaOcorrenciaPopupResponse,
    IluminacaoMapaOcorrenciasResult,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import (
    DATABASE_UNAVAILABLE_MESSAGE,
    SolicitacaoInternaNotFoundError,
)


MAPA_PATH = "/api/internal/iluminacao/mapa/ocorrencias"
POPUP_PATH = "/api/internal/iluminacao/mapa/ocorrencias/10/popup"
EXPECTED_PERMISSION = "iluminacao.solicitacoes.ler"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 20, 10, 30, tzinfo=UTC)
UPDATED_AT = datetime(2026, 5, 21, 8, 15, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_iluminacao.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def fake_mapa_item() -> IluminacaoMapaOcorrenciaItem:
    return IluminacaoMapaOcorrenciaItem(
        id=10,
        protocolo="IP-2026-000010",
        origem="geoportal_publico",
        localizacao_tipo="poste_mapa",
        poste_id="POSTE-010",
        referencia_localizacao="Poste POSTE-010",
        tipo_problema="lampada_apagada",
        status="aberta",
        prioridade="normal",
        latitude=-23.105,
        longitude=-55.225,
        criado_em=CREATED_AT,
        atualizado_em=UPDATED_AT,
        finalizado_em=None,
    )


def fake_popup() -> IluminacaoMapaOcorrenciaPopupResponse:
    return IluminacaoMapaOcorrenciaPopupResponse(
        **fake_mapa_item().model_dump(),
        dados_pessoais_disponiveis=False,
    )


def test_mapa_ocorrencias_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(MAPA_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_mapa_ocorrencias_returns_403_without_required_permission(
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
        internal_iluminacao,
        "listar_mapa_ocorrencias_internas",
        lambda **kwargs: IluminacaoMapaOcorrenciasResult(
            items=[fake_mapa_item()],
            total=1,
        ),
    )
    client = TestClient(app)

    response = client.get(MAPA_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "IP-2026-000010" not in response.text


def test_mapa_ocorrencias_returns_operational_points_without_personal_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: permission_code == EXPECTED_PERMISSION,
    )
    calls: dict[str, object] = {}

    def fake_listar_mapa_ocorrencias_internas(**kwargs: object):
        calls.update(kwargs)
        return IluminacaoMapaOcorrenciasResult(items=[fake_mapa_item()], total=1)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_mapa_ocorrencias_internas",
        fake_listar_mapa_ocorrencias_internas,
    )
    client = TestClient(app)

    response = client.get(
        f"{MAPA_PATH}?status=aberta&prioridade=normal&ativos=true&limit=25&offset=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"items", "limit", "offset", "total"}
    assert body["limit"] == 25
    assert body["offset"] == 5
    assert body["total"] == 1
    assert set(body["items"][0]) == {
        "id",
        "protocolo",
        "origem",
        "localizacao_tipo",
        "poste_id",
        "referencia_localizacao",
        "tipo_problema",
        "status",
        "prioridade",
        "latitude",
        "longitude",
        "criado_em",
        "atualizado_em",
        "finalizado_em",
    }
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "telefone",
        "email",
        "documento",
        "descricao",
        "observacoes_localizacao",
        "ponto_referencia",
        "poste_proximo_informado",
        "deleted_at",
        "deleted_reason",
        "DATABASE_URL",
        "token",
        "cookie",
    ):
        assert forbidden not in response.text
    assert calls == {
        "status": internal_iluminacao.StatusSolicitacaoIluminacao.aberta,
        "prioridade": "normal",
        "ativos": True,
        "limit": 25,
        "offset": 5,
    }


def test_mapa_ocorrencias_validates_query_params(
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

    assert client.get(f"{MAPA_PATH}?limit=0").status_code == 422
    assert client.get(f"{MAPA_PATH}?limit=501").status_code == 422
    assert client.get(f"{MAPA_PATH}?offset=-1").status_code == 422


def test_mapa_ocorrencias_database_error_is_sanitized(
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

    def fail_with_database_error(**kwargs: object) -> None:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_mapa_ocorrencias_internas",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(MAPA_PATH)

    assert response.status_code == 503
    assert response.json() == {"detail": DATABASE_UNAVAILABLE_MESSAGE}
    assert "DATABASE_URL" not in response.text
    assert "SELECT" not in response.text


def test_mapa_popup_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(POPUP_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_mapa_popup_returns_403_without_required_permission(
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
        internal_iluminacao,
        "obter_mapa_ocorrencia_popup_interno",
        lambda solicitacao_id: fake_popup(),
    )
    client = TestClient(app)

    response = client.get(POPUP_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert "IP-2026-000010" not in response.text


def test_mapa_popup_is_conservative_and_does_not_return_personal_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: permission_code == EXPECTED_PERMISSION,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "obter_mapa_ocorrencia_popup_interno",
        lambda solicitacao_id: fake_popup(),
    )
    client = TestClient(app)

    response = client.get(POPUP_PATH)

    assert response.status_code == 200
    body = response.json()
    assert body["protocolo"] == "IP-2026-000010"
    assert body["dados_pessoais_disponiveis"] is False
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "telefone",
        "email",
        "documento",
        "descricao",
        "observacoes_localizacao",
        "deleted_at",
        "DATABASE_URL",
    ):
        assert forbidden not in response.text


def test_mapa_popup_returns_404_for_missing_occurrence(
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

    def fail_not_found(solicitacao_id: int) -> None:
        raise SolicitacaoInternaNotFoundError("Solicitacao nao encontrada.")

    monkeypatch.setattr(
        internal_iluminacao,
        "obter_mapa_ocorrencia_popup_interno",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.get(POPUP_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text
