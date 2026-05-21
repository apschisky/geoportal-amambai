from datetime import datetime

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.iluminacao import (
    IluminacaoConsultaRepositoryRecord,
    IluminacaoConsultaRequest,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services import iluminacao_service
from app.services.exceptions import (
    DatabaseUnavailableError,
    PublicConsultaNotFoundError,
    SolicitacaoDuplicadaAtivaError,
)


def valid_solicitacao() -> IluminacaoSolicitacaoCreate:
    return IluminacaoSolicitacaoCreate.model_validate(
        {
            "localizacao_tipo": "poste_mapa",
            "poste_id": "POSTE-001",
            "coordenada": {
                "latitude": -23.105,
                "longitude": -55.225,
            },
            "tipo_problema": "lampada_apagada",
            "descricao": "Lampada apagada durante a noite.",
            "nome_solicitante": "Solicitante de teste",
            "contato_solicitante": "contato de teste",
        }
    )


def test_create_solicitacao_simulada_returns_protocol_without_repository(
    monkeypatch,
) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        False,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fail_if_called,
    )
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        fail_if_called,
    )

    response = iluminacao_service.create_solicitacao_simulada(valid_solicitacao())

    assert response.protocolo == "IP-2026-000001"
    assert response.status == "aberta"


def test_create_solicitacao_simulada_calls_repository_when_enabled(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_create_solicitacao(
        solicitacao: IluminacaoSolicitacaoCreate,
        protocolo: str,
    ) -> IluminacaoSolicitacaoResponse:
        calls["solicitacao"] = solicitacao
        calls["protocolo"] = protocolo
        return IluminacaoSolicitacaoResponse(
            protocolo=protocolo,
            status=StatusSolicitacaoIluminacao.aberta,
            message="Solicitação registrada em ambiente de teste.",
        )

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "existe_solicitacao_ativa_para_poste",
        lambda poste_id: False,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fake_create_solicitacao,
    )
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        lambda: "IP-2026-000123",
    )

    solicitacao = valid_solicitacao()
    response = iluminacao_service.create_solicitacao_simulada(solicitacao)

    assert calls["solicitacao"] is solicitacao
    assert calls["protocolo"] == "IP-2026-000123"
    assert response.protocolo == "IP-2026-000123"
    assert response.status == "aberta"


def test_create_solicitacao_blocks_active_duplicate_before_protocol_generation(
    monkeypatch,
) -> None:
    calls = {"protocol": 0, "create": 0}

    def fail_protocol() -> str:
        calls["protocol"] += 1
        raise AssertionError("protocol should not be generated for duplicate request")

    def fail_create(*args: object, **kwargs: object) -> None:
        calls["create"] += 1
        raise AssertionError("repository insert should not be called")

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "existe_solicitacao_ativa_para_poste",
        lambda poste_id: True,
    )
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        fail_protocol,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fail_create,
    )

    with pytest.raises(SolicitacaoDuplicadaAtivaError) as exc_info:
        iluminacao_service.create_solicitacao_simulada(valid_solicitacao())

    assert str(exc_info.value) == (
        "Já existe uma solicitação aberta para este poste. "
        "A equipe responsável já foi notificada."
    )
    assert calls == {"protocol": 0, "create": 0}


def test_create_solicitacao_allows_ponto_manual_without_active_poste_check(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("active poste check should not run for ponto_manual")

    def fake_create_solicitacao(
        solicitacao: IluminacaoSolicitacaoCreate,
        protocolo: str,
    ) -> IluminacaoSolicitacaoResponse:
        calls["solicitacao"] = solicitacao
        calls["protocolo"] = protocolo
        return IluminacaoSolicitacaoResponse(
            protocolo=protocolo,
            status=StatusSolicitacaoIluminacao.aberta,
            message="Solicitacao registrada em ambiente de teste.",
        )

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "existe_solicitacao_ativa_para_poste",
        fail_if_called,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fake_create_solicitacao,
    )
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        lambda: "IP-2026-000124",
    )

    solicitacao = IluminacaoSolicitacaoCreate.model_validate(
        {
            "localizacao_tipo": "ponto_manual",
            "poste_id": None,
            "coordenada": {
                "latitude": -23.105,
                "longitude": -55.225,
            },
            "tipo_problema": "lampada_apagada",
            "descricao": "Lampada apagada durante a noite.",
            "observacoes_localizacao": "Pin marcado manualmente no local do poste.",
            "nome_solicitante": "Solicitante de teste",
            "contato_solicitante": "contato de teste",
        }
    )

    response = iluminacao_service.create_solicitacao_simulada(solicitacao)

    assert calls["solicitacao"] is solicitacao
    assert response.protocolo == "IP-2026-000124"


def test_create_solicitacao_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        True,
    )
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        lambda: "IP-2026-000123",
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "existe_solicitacao_ativa_para_poste",
        lambda poste_id: False,
    )

    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.create_solicitacao_simulada(valid_solicitacao())

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def consulta_request(
    protocolo: str = "IP-2026-000017",
    contato_confirmacao: str = "9999",
) -> IluminacaoConsultaRequest:
    return IluminacaoConsultaRequest.model_validate(
        {
            "protocolo": protocolo,
            "contato_confirmacao": contato_confirmacao,
        }
    )


def repository_record(
    status: str = "aberta",
    contato_solicitante: str = "+5567999999999",
) -> IluminacaoConsultaRepositoryRecord:
    return IluminacaoConsultaRepositoryRecord.model_validate(
        {
            "protocolo": "IP-2026-000017",
            "status": status,
            "contato_solicitante": contato_solicitante,
            "criado_em": datetime(2026, 5, 20, 10, 30),
            "atualizado_em": None,
        }
    )


def test_consultar_solicitacao_publica_returns_filtered_response(monkeypatch) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_publica_por_protocolo",
        lambda protocolo: repository_record(),
    )

    response = iluminacao_service.consultar_solicitacao_publica(consulta_request())

    assert response.model_dump(mode="json") == {
        "protocolo": "IP-2026-000017",
        "status": "aberta",
        "status_publico": "Aberta",
        "data_abertura": "2026-05-20",
        "ultima_atualizacao": "2026-05-20",
        "mensagem": "Sua solicitacao foi registrada e esta aguardando analise.",
    }
    assert not hasattr(response, "contato_solicitante")
    assert not hasattr(response, "nome_solicitante")
    assert not hasattr(response, "id")


def test_consultar_solicitacao_publica_returns_generic_error_when_not_found(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_publica_por_protocolo",
        lambda protocolo: None,
    )

    with pytest.raises(PublicConsultaNotFoundError) as exc_info:
        iluminacao_service.consultar_solicitacao_publica(consulta_request())

    assert str(exc_info.value) == (
        "Solicitacao nao encontrada ou dados de confirmacao invalidos."
    )


def test_consultar_solicitacao_publica_returns_same_error_for_wrong_confirmation(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_publica_por_protocolo",
        lambda protocolo: repository_record(),
    )

    with pytest.raises(PublicConsultaNotFoundError) as exc_info:
        iluminacao_service.consultar_solicitacao_publica(
            consulta_request(contato_confirmacao="0000")
        )

    assert str(exc_info.value) == (
        "Solicitacao nao encontrada ou dados de confirmacao invalidos."
    )


@pytest.mark.parametrize(
    ("status", "status_publico", "mensagem"),
    [
        ("aberta", "Aberta", "Sua solicitacao foi registrada e esta aguardando analise."),
        (
            "em_triagem",
            "Em analise",
            "Sua solicitacao esta em analise pela equipe responsavel.",
        ),
        (
            "encaminhada",
            "Encaminhada",
            "Sua solicitacao foi encaminhada para atendimento.",
        ),
        (
            "em_execucao",
            "Em execucao",
            "O atendimento da solicitacao esta em execucao.",
        ),
        (
            "aguardando_material",
            "Aguardando material",
            "A solicitacao aguarda disponibilidade de material ou recurso necessario.",
        ),
        ("concluida", "Concluida", "A solicitacao foi concluida."),
        ("cancelada", "Encerrada", "A solicitacao foi encerrada."),
        (
            "status_desconhecido",
            "Em acompanhamento",
            "Sua solicitacao esta em acompanhamento.",
        ),
    ],
)
def test_consultar_solicitacao_publica_maps_internal_status_to_public_message(
    monkeypatch,
    status: str,
    status_publico: str,
    mensagem: str,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_publica_por_protocolo",
        lambda protocolo: repository_record(status=status),
    )

    response = iluminacao_service.consultar_solicitacao_publica(consulta_request())

    assert response.status == status
    assert response.status_publico == status_publico
    assert response.mensagem == mensagem


def test_consultar_solicitacao_publica_converts_database_error_to_safe_503(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_publica_por_protocolo",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.consultar_solicitacao_publica(consulta_request())

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message
