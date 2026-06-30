from datetime import datetime

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.iluminacao import (
    IluminacaoMapaOcorrenciaItem,
    IluminacaoMapaOcorrenciaPopupResponse,
    IluminacaoMapaOcorrenciasResult,
    StatusSolicitacaoIluminacao,
)
from app.services import iluminacao_service
from app.services.exceptions import DatabaseUnavailableError


CREATED_AT = datetime(2026, 5, 20, 10, 30)
UPDATED_AT = datetime(2026, 5, 21, 8, 15)


def mapa_item() -> IluminacaoMapaOcorrenciaItem:
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


def popup_item() -> IluminacaoMapaOcorrenciaPopupResponse:
    return IluminacaoMapaOcorrenciaPopupResponse(
        **mapa_item().model_dump(),
        dados_pessoais_disponiveis=False,
    )


def test_listar_mapa_ocorrencias_internas_calls_repository_with_safe_filters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_list_mapa_ocorrencias_internas(**kwargs: object):
        calls.update(kwargs)
        return IluminacaoMapaOcorrenciasResult(items=[mapa_item()], total=1)

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_mapa_ocorrencias_internas",
        fake_list_mapa_ocorrencias_internas,
    )

    response = iluminacao_service.listar_mapa_ocorrencias_internas(
        status=StatusSolicitacaoIluminacao.aberta,
        prioridade=" normal ",
        ativos=True,
        limit=25,
        offset=5,
    )

    assert response.total == 1
    assert response.items[0].protocolo == "IP-2026-000010"
    assert calls == {
        "status": StatusSolicitacaoIluminacao.aberta,
        "prioridade": "normal",
        "ativos": True,
        "limit": 25,
        "offset": 5,
    }


@pytest.mark.parametrize(
    "kwargs",
    [
        {"limit": 0, "offset": 0},
        {"limit": 501, "offset": 0},
        {"limit": 250, "offset": -1},
        {"prioridade": "critica", "limit": 250, "offset": 0},
    ],
)
def test_listar_mapa_ocorrencias_internas_rejects_invalid_filters(
    kwargs: dict[str, object],
) -> None:
    with pytest.raises(ValueError):
        iluminacao_service.listar_mapa_ocorrencias_internas(**kwargs)


def test_listar_mapa_ocorrencias_internas_converts_database_error_to_safe_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_with_database_error(**kwargs: object) -> None:
        raise SQLAlchemyError("DATABASE_URL host internal SELECT nome_solicitante")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_mapa_ocorrencias_internas",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_mapa_ocorrencias_internas()

    message = str(exc_info.value)
    assert message == iluminacao_service.DATABASE_UNAVAILABLE_MESSAGE
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message
    assert "nome_solicitante" not in message


def test_obter_mapa_ocorrencia_popup_interno_returns_conservative_popup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_mapa_ocorrencia_popup_interno",
        lambda solicitacao_id: popup_item(),
    )

    response = iluminacao_service.obter_mapa_ocorrencia_popup_interno(10)

    assert response.id == 10
    assert response.protocolo == "IP-2026-000010"
    assert response.dados_pessoais_disponiveis is False
    assert not hasattr(response, "nome_solicitante")
    assert not hasattr(response, "contato_solicitante")


def test_obter_mapa_ocorrencia_popup_interno_raises_safe_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_mapa_ocorrencia_popup_interno",
        lambda solicitacao_id: None,
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.obter_mapa_ocorrencia_popup_interno(999)

    assert str(exc_info.value) == iluminacao_service.SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE


def test_obter_mapa_ocorrencia_popup_interno_converts_database_error_to_safe_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_with_database_error(solicitacao_id: int) -> None:
        raise SQLAlchemyError("DATABASE_URL host internal SELECT contato_solicitante")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_mapa_ocorrencia_popup_interno",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.obter_mapa_ocorrencia_popup_interno(10)

    message = str(exc_info.value)
    assert message == iluminacao_service.DATABASE_UNAVAILABLE_MESSAGE
    assert "DATABASE_URL" not in message
    assert "contato_solicitante" not in message
