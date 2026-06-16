from datetime import date, datetime

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.iluminacao import (
    IluminacaoConsultaRepositoryRecord,
    IluminacaoConsultaRequest,
    IluminacaoRelatorioSolicitacaoInternaItem,
    IluminacaoRelatorioSolicitacoesInternasResult,
    IluminacaoSolicitacaoHistoricoInternoItem,
    IluminacaoSolicitacaoHistoricoInternoResult,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResult,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    IluminacaoSolicitacaoStatusInternaItem,
    IluminacaoSolicitacoesInternasResult,
    StatusSolicitacaoIluminacao,
    TipoProblemaIluminacao,
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
    assert "ambiente de teste" in response.message


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
            message="Solicitacao registrada com sucesso.",
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
    assert response.message == "Solicitacao registrada com sucesso."
    assert "ambiente de teste" not in response.message.lower()
    assert "teste" not in response.message.lower()


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


def internal_solicitacao_item() -> IluminacaoSolicitacaoInternaItem:
    return IluminacaoSolicitacaoInternaItem.model_validate(
        {
            "id": 10,
            "protocolo": "IP-2026-000010",
            "origem": "geoportal_publico",
            "localizacao_tipo": "poste_mapa",
            "poste_id": "POSTE-010",
            "tipo_problema": "lampada_apagada",
            "descricao": "Lampada apagada na rua principal.",
            "observacoes_localizacao": None,
            "ponto_referencia": "Perto da praca.",
            "poste_proximo_informado": None,
            "nome_solicitante": "Solicitante Interno",
            "contato_solicitante": "contato interno",
            "status": "aberta",
            "prioridade": "normal",
            "duplicidade_suspeita": False,
            "latitude": -23.105,
            "longitude": -55.225,
            "criado_em": datetime(2026, 5, 20, 10, 30),
            "atualizado_em": datetime(2026, 5, 21, 8, 15),
            "finalizado_em": None,
        }
    )


def historico_solicitacao_item() -> IluminacaoSolicitacaoHistoricoInternoItem:
    return IluminacaoSolicitacaoHistoricoInternoItem.model_validate(
        {
            "id": 50,
            "solicitacao_id": 10,
            "acao": "criacao",
            "status_anterior": None,
            "status_novo": "aberta",
            "prioridade_anterior": None,
            "prioridade_nova": "normal",
            "usuario_id": "7",
            "usuario_nome": "Administrador Interno",
            "origem_acao": "sistema",
            "observacao_resumida": "Solicitacao registrada.",
            "criado_em": datetime(2026, 5, 20, 11, 30),
        }
    )


def observacao_solicitacao_item() -> IluminacaoSolicitacaoObservacaoInternaItem:
    return IluminacaoSolicitacaoObservacaoInternaItem.model_validate(
        {
            "id": 70,
            "solicitacao_id": 10,
            "observacao": "Equipe acionada.",
            "visibilidade": "interna",
            "usuario_id": "7",
            "usuario_nome": "Administrador Interno",
            "criado_em": datetime(2026, 5, 20, 12, 30),
            "editado_em": None,
        }
    )


def relatorio_solicitacao_item(
    **overrides: object,
) -> IluminacaoRelatorioSolicitacaoInternaItem:
    return IluminacaoRelatorioSolicitacaoInternaItem.model_validate(
        {
            "protocolo": "IP-2026-000010",
            "status": "aberta",
            "prioridade": "normal",
            "tipo_problema": "lampada_apagada",
            "poste_id": "POSTE-010",
            "origem": "geoportal_publico",
            "localizacao_tipo": "poste_mapa",
            "criado_em": datetime(2026, 5, 20, 10, 30),
            "atualizado_em": datetime(2026, 5, 21, 8, 15),
            "finalizado_em": None,
            "duplicidade_suspeita": False,
            "tempo_finalizacao_segundos": None,
            **overrides,
        }
    )


def status_solicitacao_item(
    status: str = "em_execucao",
) -> IluminacaoSolicitacaoStatusInternaItem:
    return IluminacaoSolicitacaoStatusInternaItem.model_validate(
        {
            "id": 10,
            "status": status,
            "atualizado_em": datetime(2026, 5, 21, 8, 15),
            "finalizado_em": (
                datetime(2026, 5, 21, 9, 30)
                if status in iluminacao_service.TERMINAL_STATUS_SOLICITACAO
                else None
            ),
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


def test_listar_solicitacoes_internas_calls_repository_with_filters(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_list_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoSolicitacoesInternasResult:
        calls.update(kwargs)
        return IluminacaoSolicitacoesInternasResult(
            items=[internal_solicitacao_item()],
            total=12,
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_solicitacoes_internas",
        fake_list_solicitacoes_internas,
    )

    response = iluminacao_service.listar_solicitacoes_internas(
        status=StatusSolicitacaoIluminacao.aberta,
        protocolo=" IP-2026 ",
        poste_id=" POSTE-010 ",
        tipo_problema=TipoProblemaIluminacao.lampada_apagada,
        prioridade=" normal ",
        criado_de=datetime(2026, 5, 1, 0, 0),
        criado_ate=datetime(2026, 5, 31, 23, 59),
        ativos=True,
        limit=25,
        offset=5,
    )

    assert response.items[0].protocolo == "IP-2026-000010"
    assert response.total == 12
    assert calls == {
        "status": StatusSolicitacaoIluminacao.aberta,
        "protocolo": "IP-2026",
        "poste_id": "POSTE-010",
        "tipo_problema": TipoProblemaIluminacao.lampada_apagada,
        "prioridade": "normal",
        "criado_de": datetime(2026, 5, 1, 0, 0),
        "criado_ate": datetime(2026, 5, 31, 23, 59),
        "ativos": True,
        "limit": 25,
        "offset": 5,
    }


def test_listar_solicitacoes_internas_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_solicitacoes_internas",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_solicitacoes_internas(
            status=None,
            limit=50,
            offset=0,
        )

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_listar_solicitacoes_internas_rejects_invalid_period() -> None:
    with pytest.raises(ValueError) as exc_info:
        iluminacao_service.listar_solicitacoes_internas(
            criado_de=datetime(2026, 6, 1, 0, 0),
            criado_ate=datetime(2026, 5, 1, 0, 0),
        )

    assert str(exc_info.value) == "criado_de must be less than or equal to criado_ate"


def test_listar_relatorio_solicitacoes_internas_normalizes_filters_and_period(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_list_relatorio_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoRelatorioSolicitacoesInternasResult:
        calls.update(kwargs)
        return IluminacaoRelatorioSolicitacoesInternasResult(
            items=[relatorio_solicitacao_item()],
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_relatorio_solicitacoes_internas",
        fake_list_relatorio_solicitacoes_internas,
    )

    response = iluminacao_service.listar_relatorio_solicitacoes_internas(
        data_inicio=date(2026, 6, 1),
        data_fim=date(2026, 6, 30),
        status=StatusSolicitacaoIluminacao.aberta,
        prioridade=" normal ",
        tipo_problema=TipoProblemaIluminacao.lampada_apagada,
    )

    assert response.items[0].protocolo == "IP-2026-000010"
    assert calls == {
        "data_inicio": datetime(2026, 6, 1, 0, 0),
        "data_fim_exclusive": datetime(2026, 7, 1, 0, 0),
        "status": StatusSolicitacaoIluminacao.aberta,
        "prioridade": "normal",
        "tipo_problema": TipoProblemaIluminacao.lampada_apagada,
    }


def test_listar_relatorio_solicitacoes_internas_accepts_optional_dates(
    monkeypatch,
) -> None:
    calls: list[dict[str, object]] = []

    def fake_list_relatorio_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoRelatorioSolicitacoesInternasResult:
        calls.append(kwargs)
        return IluminacaoRelatorioSolicitacoesInternasResult(
            items=[relatorio_solicitacao_item()],
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_relatorio_solicitacoes_internas",
        fake_list_relatorio_solicitacoes_internas,
    )

    iluminacao_service.listar_relatorio_solicitacoes_internas()
    iluminacao_service.listar_relatorio_solicitacoes_internas(
        data_inicio=date(2026, 6, 1),
    )
    iluminacao_service.listar_relatorio_solicitacoes_internas(
        data_fim=date(2026, 6, 30),
    )

    assert calls == [
        {
            "data_inicio": None,
            "data_fim_exclusive": None,
            "status": None,
            "prioridade": None,
            "tipo_problema": None,
        },
        {
            "data_inicio": datetime(2026, 6, 1, 0, 0),
            "data_fim_exclusive": None,
            "status": None,
            "prioridade": None,
            "tipo_problema": None,
        },
        {
            "data_inicio": None,
            "data_fim_exclusive": datetime(2026, 7, 1, 0, 0),
            "status": None,
            "prioridade": None,
            "tipo_problema": None,
        },
    ]


def test_listar_relatorio_solicitacoes_internas_rejects_invalid_period_and_priority() -> None:
    with pytest.raises(ValueError) as period_error:
        iluminacao_service.listar_relatorio_solicitacoes_internas(
            data_inicio=date(2026, 6, 30),
            data_fim=date(2026, 6, 1),
        )

    assert str(period_error.value) == "data_fim must be greater than or equal to data_inicio"

    with pytest.raises(ValueError) as priority_error:
        iluminacao_service.listar_relatorio_solicitacoes_internas(
            data_inicio=date(2026, 6, 1),
            data_fim=date(2026, 6, 30),
            prioridade="critica",
        )

    assert str(priority_error.value) == "prioridade must be one of allowed values"


def test_montar_nome_arquivo_relatorio_solicitacoes_supports_optional_dates() -> None:
    assert (
        iluminacao_service.montar_nome_arquivo_relatorio_solicitacoes(None, None)
        == "relatorio_iluminacao_geral.csv"
    )
    assert (
        iluminacao_service.montar_nome_arquivo_relatorio_solicitacoes(
            date(2026, 6, 1),
            None,
        )
        == "relatorio_iluminacao_desde_2026-06-01.csv"
    )
    assert (
        iluminacao_service.montar_nome_arquivo_relatorio_solicitacoes(
            None,
            date(2026, 6, 30),
        )
        == "relatorio_iluminacao_ate_2026-06-30.csv"
    )


def test_listar_relatorio_solicitacoes_internas_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_relatorio_solicitacoes_internas",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_relatorio_solicitacoes_internas(
            data_inicio=date(2026, 6, 1),
            data_fim=date(2026, 6, 30),
        )

    message = str(exc_info.value)
    assert message == iluminacao_service.DATABASE_UNAVAILABLE_MESSAGE
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "SELECT" not in message


def test_build_relatorio_solicitacoes_csv_is_sanitized_and_excel_compatible() -> None:
    csv_content = iluminacao_service.build_relatorio_solicitacoes_csv(
        [
            relatorio_solicitacao_item(
                finalizado_em=datetime(2026, 5, 22, 9, 0),
                duplicidade_suspeita=True,
                tempo_finalizacao_segundos=171000.4,
            )
        ]
    )

    assert csv_content.startswith("\ufeff")
    assert "protocolo,status,prioridade,tipo_problema" in csv_content
    assert "IP-2026-000010,aberta,normal,lampada_apagada" in csv_content
    assert "sim,171000" in csv_content
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "observacao",
        "descricao",
        "DATABASE_URL",
        "session_secret",
    ):
        assert forbidden not in csv_content


def test_resumir_relatorio_solicitacoes_internas_aggregates_statuses_and_priority() -> None:
    summary = iluminacao_service.resumir_relatorio_solicitacoes_internas(
        [
            relatorio_solicitacao_item(status="aberta", prioridade="normal"),
            relatorio_solicitacao_item(status="encaminhada", prioridade="alta"),
            relatorio_solicitacao_item(status="resolvida", prioridade="alta"),
            relatorio_solicitacao_item(
                status="nao_localizado",
                prioridade="baixa",
                tipo_problema="fiacao_aparente",
            ),
        ]
    )

    assert summary.total == 4
    assert summary.abertas == 1
    assert summary.em_andamento == 1
    assert summary.resolvidas == 1
    assert summary.nao_localizadas == 1
    assert summary.por_prioridade == {"normal": 1, "alta": 2, "baixa": 1}
    assert summary.por_tipo_problema == {
        "lampada_apagada": 3,
        "fiacao_aparente": 1,
    }


def test_obter_solicitacao_interna_por_id_returns_found_item(monkeypatch) -> None:
    calls: dict[str, object] = {}

    def fake_get_solicitacao_interna_por_id(
        solicitacao_id: int,
    ) -> IluminacaoSolicitacaoInternaItem:
        calls["solicitacao_id"] = solicitacao_id
        return internal_solicitacao_item()

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_interna_por_id",
        fake_get_solicitacao_interna_por_id,
    )

    response = iluminacao_service.obter_solicitacao_interna_por_id(10)

    assert response.id == 10
    assert response.protocolo == "IP-2026-000010"
    assert calls == {"solicitacao_id": 10}


def test_obter_solicitacao_interna_por_id_raises_safe_not_found(monkeypatch) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_interna_por_id",
        lambda solicitacao_id: None,
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.obter_solicitacao_interna_por_id(999)

    message = str(exc_info.value)
    assert message == "Solicitacao nao encontrada."
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message
    assert "token" not in message


def test_obter_solicitacao_interna_por_id_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "get_solicitacao_interna_por_id",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.obter_solicitacao_interna_por_id(10)

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_listar_historico_solicitacao_interna_returns_history(monkeypatch) -> None:
    calls: dict[str, object] = {}

    def fake_list_historico_solicitacao_interna(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoHistoricoInternoResult:
        calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "limit": limit,
                "offset": offset,
            }
        )
        return IluminacaoSolicitacaoHistoricoInternoResult(
            items=[historico_solicitacao_item()],
            total=1,
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_historico_solicitacao_interna",
        fake_list_historico_solicitacao_interna,
    )

    response = iluminacao_service.listar_historico_solicitacao_interna(
        10,
        limit=25,
        offset=5,
    )

    assert response.items[0].id == 50
    assert response.total == 1
    assert calls == {
        "solicitacao_id": 10,
        "limit": 25,
        "offset": 5,
    }


def test_listar_historico_solicitacao_interna_returns_empty_when_exists_without_history(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_historico_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoHistoricoInternoResult(items=[], total=0)
        ),
    )

    response = iluminacao_service.listar_historico_solicitacao_interna(10)

    assert response.items == []
    assert response.total == 0


def test_listar_historico_solicitacao_interna_raises_safe_not_found(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: False,
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.listar_historico_solicitacao_interna(999)

    message = str(exc_info.value)
    assert message == "Solicitacao nao encontrada."
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message
    assert "token" not in message


def test_listar_historico_solicitacao_interna_rejects_invalid_params(monkeypatch) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        fail_if_called,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_historico_solicitacao_interna",
        fail_if_called,
    )

    for kwargs in (
        {"solicitacao_id": 0, "limit": 50, "offset": 0},
        {"solicitacao_id": 10, "limit": 0, "offset": 0},
        {"solicitacao_id": 10, "limit": 101, "offset": 0},
        {"solicitacao_id": 10, "limit": 50, "offset": -1},
    ):
        with pytest.raises(ValueError):
            iluminacao_service.listar_historico_solicitacao_interna(**kwargs)


def test_listar_historico_solicitacao_interna_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )

    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_historico_solicitacao_interna",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_historico_solicitacao_interna(10)

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_listar_historico_solicitacao_interna_converts_exists_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_historico_solicitacao_interna(10)

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_listar_observacoes_solicitacao_interna_returns_observations(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_list_observacoes_solicitacao_interna(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoObservacoesInternasResult:
        calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "limit": limit,
                "offset": offset,
            }
        )
        return IluminacaoSolicitacaoObservacoesInternasResult(
            items=[observacao_solicitacao_item()],
            total=1,
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_observacoes_solicitacao_interna",
        fake_list_observacoes_solicitacao_interna,
    )

    response = iluminacao_service.listar_observacoes_solicitacao_interna(
        10,
        limit=25,
        offset=5,
    )

    assert response.items[0].id == 70
    assert response.items[0].visibilidade == "interna"
    assert response.total == 1
    assert calls == {
        "solicitacao_id": 10,
        "limit": 25,
        "offset": 5,
    }


def test_listar_observacoes_solicitacao_interna_returns_empty_when_exists_without_observations(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_observacoes_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoObservacoesInternasResult(items=[], total=0)
        ),
    )

    response = iluminacao_service.listar_observacoes_solicitacao_interna(10)

    assert response.items == []
    assert response.total == 0


def test_listar_observacoes_solicitacao_interna_raises_safe_not_found(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: False,
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.listar_observacoes_solicitacao_interna(999)

    message = str(exc_info.value)
    assert message == "Solicitacao nao encontrada."
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message
    assert "token" not in message


def test_listar_observacoes_solicitacao_interna_rejects_invalid_params(
    monkeypatch,
) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        fail_if_called,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_observacoes_solicitacao_interna",
        fail_if_called,
    )

    for kwargs in (
        {"solicitacao_id": 0, "limit": 50, "offset": 0},
        {"solicitacao_id": 10, "limit": 0, "offset": 0},
        {"solicitacao_id": 10, "limit": 101, "offset": 0},
        {"solicitacao_id": 10, "limit": 50, "offset": -1},
    ):
        with pytest.raises(ValueError):
            iluminacao_service.listar_observacoes_solicitacao_interna(**kwargs)


def test_listar_observacoes_solicitacao_interna_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        lambda solicitacao_id: True,
    )

    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "list_observacoes_solicitacao_interna",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_observacoes_solicitacao_interna(10)

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_listar_observacoes_solicitacao_interna_converts_exists_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 SELECT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "solicitacao_interna_existe",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.listar_observacoes_solicitacao_interna(10)

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "SELECT" not in message


def test_criar_observacao_solicitacao_interna_creates_normalized_observation(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_create_observacao_solicitacao_interna(
        solicitacao_id: int,
        *,
        observacao: str,
        usuario_id: str,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoObservacaoInternaItem:
        calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "observacao": observacao,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        return observacao_solicitacao_item()

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_observacao_solicitacao_interna",
        fake_create_observacao_solicitacao_interna,
    )

    response = iluminacao_service.criar_observacao_solicitacao_interna(
        10,
        observacao="  Equipe acionada.  ",
        usuario_id=7,
        usuario_nome=None,
    )

    assert response.id == 70
    assert response.visibilidade == "interna"
    assert calls == {
        "solicitacao_id": 10,
        "observacao": "Equipe acionada.",
        "usuario_id": "7",
        "usuario_nome": None,
    }


def test_criar_observacao_solicitacao_interna_rejects_invalid_input(
    monkeypatch,
) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_observacao_solicitacao_interna",
        fail_if_called,
    )

    for kwargs in (
        {"solicitacao_id": 0, "observacao": "Equipe acionada.", "usuario_id": 7},
        {"solicitacao_id": 10, "observacao": "", "usuario_id": 7},
        {"solicitacao_id": 10, "observacao": "  ", "usuario_id": 7},
        {"solicitacao_id": 10, "observacao": " ab ", "usuario_id": 7},
        {"solicitacao_id": 10, "observacao": "a" * 2001, "usuario_id": 7},
        {"solicitacao_id": 10, "observacao": "Equipe acionada.", "usuario_id": 0},
    ):
        with pytest.raises(ValueError):
            iluminacao_service.criar_observacao_solicitacao_interna(**kwargs)


def test_criar_observacao_solicitacao_interna_raises_safe_not_found(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_observacao_solicitacao_interna",
        lambda solicitacao_id, *, observacao, usuario_id, usuario_nome=None: None,
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.criar_observacao_solicitacao_interna(
            999,
            observacao="Equipe acionada.",
            usuario_id=7,
        )

    message = str(exc_info.value)
    assert message == "Solicitacao nao encontrada."
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message
    assert "token" not in message


def test_criar_observacao_solicitacao_interna_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 INSERT"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_observacao_solicitacao_interna",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.criar_observacao_solicitacao_interna(
            10,
            observacao="Equipe acionada.",
            usuario_id=7,
        )

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "INSERT" not in message


def test_atualizar_status_solicitacao_interna_updates_valid_transition(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_update_status_solicitacao_interna(
        solicitacao_id: int,
        *,
        status_novo: str,
        allowed_current_statuses: set[str],
        is_terminal_status: bool,
        observacao_resumida: str,
        usuario_id: str,
        usuario_nome: str | None = None,
    ) -> object:
        calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "status_novo": status_novo,
                "allowed_current_statuses": allowed_current_statuses,
                "is_terminal_status": is_terminal_status,
                "observacao_resumida": observacao_resumida,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        return iluminacao_service.iluminacao_repository.UpdateStatusSolicitacaoInternaResult(
            outcome=iluminacao_service.iluminacao_repository.STATUS_UPDATE_OUTCOME_UPDATED,
            solicitacao=status_solicitacao_item(status_novo),
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        fake_update_status_solicitacao_interna,
    )

    response = iluminacao_service.atualizar_status_solicitacao_interna(
        10,
        status=StatusSolicitacaoIluminacao.em_execucao,
        observacao="  Equipe iniciou atendimento.  ",
        usuario_id=7,
        usuario_nome=None,
    )

    assert response.status == "em_execucao"
    assert response.finalizado_em is None
    assert calls == {
        "solicitacao_id": 10,
        "status_novo": "em_execucao",
        "allowed_current_statuses": {"encaminhada", "aguardando_material"},
        "is_terminal_status": False,
        "observacao_resumida": "Equipe iniciou atendimento.",
        "usuario_id": "7",
        "usuario_nome": None,
    }


def test_atualizar_status_solicitacao_interna_marks_terminal_status(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_update_status_solicitacao_interna(
        *args: object,
        **kwargs: object,
    ) -> object:
        calls.update(kwargs)
        calls["solicitacao_id"] = args[0]
        return iluminacao_service.iluminacao_repository.UpdateStatusSolicitacaoInternaResult(
            outcome=iluminacao_service.iluminacao_repository.STATUS_UPDATE_OUTCOME_UPDATED,
            solicitacao=status_solicitacao_item("resolvida"),
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        fake_update_status_solicitacao_interna,
    )

    response = iluminacao_service.atualizar_status_solicitacao_interna(
        10,
        status="resolvida",
        observacao="Atendimento concluido.",
        usuario_id=7,
    )

    assert response.status == "resolvida"
    assert response.finalizado_em == datetime(2026, 5, 21, 9, 30)
    assert calls["allowed_current_statuses"] == {"em_execucao"}
    assert calls["is_terminal_status"] is True


def test_atualizar_status_solicitacao_interna_allows_idempotent_status(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        lambda *args, **kwargs: (
            iluminacao_service.iluminacao_repository.UpdateStatusSolicitacaoInternaResult(
                outcome=iluminacao_service.iluminacao_repository.STATUS_UPDATE_OUTCOME_IDEMPOTENT,
                solicitacao=status_solicitacao_item("aberta"),
            )
        ),
    )

    response = iluminacao_service.atualizar_status_solicitacao_interna(
        10,
        status="aberta",
        observacao="Reenvio idempotente.",
        usuario_id=7,
    )

    assert response.status == "aberta"


def test_atualizar_status_solicitacao_interna_raises_safe_not_found(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        lambda *args, **kwargs: (
            iluminacao_service.iluminacao_repository.UpdateStatusSolicitacaoInternaResult(
                outcome=iluminacao_service.iluminacao_repository.STATUS_UPDATE_OUTCOME_NOT_FOUND
            )
        ),
    )

    with pytest.raises(iluminacao_service.SolicitacaoInternaNotFoundError) as exc_info:
        iluminacao_service.atualizar_status_solicitacao_interna(
            999,
            status="em_execucao",
            observacao="Equipe iniciou atendimento.",
            usuario_id=7,
        )

    message = str(exc_info.value)
    assert message == "Solicitacao nao encontrada."
    assert "DATABASE_URL" not in message
    assert "SELECT" not in message


def test_atualizar_status_solicitacao_interna_rejects_invalid_transition(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        lambda *args, **kwargs: (
            iluminacao_service.iluminacao_repository.UpdateStatusSolicitacaoInternaResult(
                outcome=(
                    iluminacao_service.iluminacao_repository
                    .STATUS_UPDATE_OUTCOME_INVALID_TRANSITION
                )
            )
        ),
    )

    with pytest.raises(
        iluminacao_service.SolicitacaoInternaStatusTransitionError
    ) as exc_info:
        iluminacao_service.atualizar_status_solicitacao_interna(
            10,
            status="aberta",
            observacao="Tentativa de reabertura.",
            usuario_id=7,
        )

    assert str(exc_info.value) == "Transicao de status invalida."


def test_atualizar_status_solicitacao_interna_rejects_invalid_input(
    monkeypatch,
) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        fail_if_called,
    )

    for kwargs in (
        {"solicitacao_id": 0, "status": "em_execucao", "observacao": "Ok.", "usuario_id": 7},
        {"solicitacao_id": 10, "status": "rejeitada", "observacao": "Ok.", "usuario_id": 7},
        {"solicitacao_id": 10, "status": "em_execucao", "observacao": "", "usuario_id": 7},
        {"solicitacao_id": 10, "status": "em_execucao", "observacao": " ab ", "usuario_id": 7},
        {
            "solicitacao_id": 10,
            "status": "em_execucao",
            "observacao": "a" * 1001,
            "usuario_id": 7,
        },
        {"solicitacao_id": 10, "status": "em_execucao", "observacao": "Ok.", "usuario_id": 0},
    ):
        with pytest.raises(ValueError):
            iluminacao_service.atualizar_status_solicitacao_interna(**kwargs)


def test_atualizar_status_solicitacao_interna_converts_database_error_to_safe_error(
    monkeypatch,
) -> None:
    def fail_with_database_error(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError(
            "could not connect using DATABASE_URL on host db.internal:5432 UPDATE"
        )

    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "update_status_solicitacao_interna",
        fail_with_database_error,
    )

    with pytest.raises(DatabaseUnavailableError) as exc_info:
        iluminacao_service.atualizar_status_solicitacao_interna(
            10,
            status="em_execucao",
            observacao="Equipe iniciou atendimento.",
            usuario_id=7,
        )

    message = str(exc_info.value)
    assert message == "Servico temporariamente indisponivel. Tente novamente mais tarde."
    assert "DATABASE_URL" not in message
    assert "db.internal" not in message
    assert "senha" not in message.lower()
    assert "UPDATE" not in message
