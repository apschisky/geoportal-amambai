from datetime import datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.iluminacao_repository import (
    create_solicitacao,
    existe_solicitacao_ativa_para_poste,
    get_solicitacao_interna_por_id,
    get_solicitacao_publica_por_protocolo,
    list_historico_solicitacao_interna,
    list_solicitacoes_internas,
    solicitacao_interna_existe,
)
from app.schemas.iluminacao import IluminacaoSolicitacaoCreate
from app.schemas.iluminacao import StatusSolicitacaoIluminacao
from app.schemas.iluminacao import TipoProblemaIluminacao

DEFAULT_ROW = {
    "protocolo": "IP-2026-000001",
    "status": "aberta",
}


class FakeResult:
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def one(self) -> dict[str, Any]:
        if self.row is None:
            raise AssertionError("row should exist")
        return self.row

    def first(self) -> dict[str, Any] | None:
        if isinstance(self.row, list):
            return self.row[0] if self.row else None
        return self.row

    def all(self) -> list[dict[str, Any]]:
        if self.row is None:
            return []
        if isinstance(self.row, list):
            return self.row
        return [self.row]


class FakeConnection:
    def __init__(
        self,
        row: dict[str, Any] | list[dict[str, Any]] | None = DEFAULT_ROW,
    ) -> None:
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None
        self.statements: list[TextClause] = []
        self.params_history: list[dict[str, Any]] = []
        self.row = row

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        self.statements.append(statement)
        self.params_history.append(params)
        if "COUNT(*) AS total" in str(statement):
            row_count = len(self.row) if isinstance(self.row, list) else int(self.row is not None)
            return FakeResult({"total": row_count})
        return FakeResult(self.row)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(
        self,
        row: dict[str, Any] | list[dict[str, Any]] | None = DEFAULT_ROW,
    ) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


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
            "ponto_referencia": "Proximo a praca central.",
            "nome_solicitante": "Solicitante de teste",
            "contato_solicitante": "contato de teste",
        }
    )


def internal_solicitacao_row() -> dict[str, Any]:
    return {
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


def historico_solicitacao_row() -> dict[str, Any]:
    return {
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


def test_create_solicitacao_uses_postgis_transform_and_bind_params() -> None:
    engine = FakeEngine()

    response = create_solicitacao(
        solicitacao=valid_solicitacao(),
        protocolo="IP-2026-000001",
        engine=engine,
    )

    assert engine.connection.statement is not None
    assert engine.connection.params is not None

    sql = str(engine.connection.statement)
    params = engine.connection.params

    assert "ST_Transform" in sql
    assert "ST_SetSRID" in sql
    assert "ST_MakePoint" in sql
    assert ":longitude" in sql
    assert ":latitude" in sql
    assert "duplicidade_suspeita" in sql
    assert "EXISTS" in sql
    assert "interval '24 hours'" in sql
    assert "'aberta'" in sql
    assert "'em_triagem'" in sql
    assert "'encaminhada'" in sql
    assert "'em_execucao'" in sql
    assert "'aguardando_material'" in sql
    assert ":poste_id" in sql
    assert ":tipo_problema" in sql
    assert "CAST(:poste_id AS varchar)" in sql
    assert "CAST(:tipo_problema AS varchar)" in sql
    assert "RAISE" not in sql.upper()
    assert "EXCEPTION" not in sql.upper()
    assert params["longitude"] == -55.225
    assert params["latitude"] == -23.105
    assert params["protocolo"] == "IP-2026-000001"
    assert params["poste_id"] == "POSTE-001"
    assert params["tipo_problema"] == "lampada_apagada"
    assert params["nome_solicitante"] == "Solicitante de teste"
    assert params["contato_solicitante"] == "contato de teste"
    assert "POSTE-001" not in sql
    assert "lampada_apagada" not in sql
    assert "Solicitante de teste" not in sql
    assert "contato de teste" not in sql
    assert response.protocolo == "IP-2026-000001"
    assert response.status == "aberta"
    assert response.message == "Solicitacao registrada com sucesso."
    assert "teste" not in response.message.lower()


def test_existe_solicitacao_ativa_para_poste_returns_boolean_without_sensitive_data() -> None:
    engine = FakeEngine({"existe": True})

    response = existe_solicitacao_ativa_para_poste(
        poste_id="POSTE-001",
        engine=engine,
    )

    assert response is True
    assert engine.connection.statement is not None
    assert engine.connection.params == {"poste_id": "POSTE-001"}

    sql = str(engine.connection.statement)
    assert "SELECT EXISTS" in sql
    assert "mod_iluminacao.solicitacoes" in sql
    assert "deleted_at IS NULL" in sql
    assert "poste_id = :poste_id" in sql
    assert "'aberta'" in sql
    assert "'em_triagem'" in sql
    assert "'encaminhada'" in sql
    assert "'em_execucao'" in sql
    assert "'aguardando_material'" in sql
    assert "protocolo" not in sql
    assert "nome_solicitante" not in sql
    assert "contato_solicitante" not in sql
    assert "descricao" not in sql
    assert "POSTE-001" not in sql


def test_existe_solicitacao_ativa_para_poste_returns_false_when_not_found() -> None:
    engine = FakeEngine({"existe": False})

    response = existe_solicitacao_ativa_para_poste(
        poste_id="POSTE-001",
        engine=engine,
    )

    assert response is False


def test_get_solicitacao_publica_por_protocolo_uses_filtered_columns_and_bind_params() -> None:
    row = {
        "protocolo": "IP-2026-000017",
        "status": "aberta",
        "contato_solicitante": "+5567999999999",
        "criado_em": datetime(2026, 5, 20, 10, 30),
        "atualizado_em": datetime(2026, 5, 21, 8, 15),
    }
    engine = FakeEngine(row)

    response = get_solicitacao_publica_por_protocolo(
        protocolo="IP-2026-000017",
        engine=engine,
    )

    assert engine.connection.statement is not None
    assert engine.connection.params == {"protocolo": "IP-2026-000017"}

    sql = str(engine.connection.statement)
    assert "protocolo" in sql
    assert "status" in sql
    assert "contato_solicitante" in sql
    assert "criado_em" in sql
    assert "COALESCE(atualizado_em, criado_em)" in sql
    assert "nome_solicitante" not in sql
    assert "descricao" not in sql
    assert "geom" not in sql
    assert "SELECT *" not in sql.upper()
    assert ":protocolo" in sql
    assert "IP-2026-000017" not in sql
    assert response is not None
    assert response.protocolo == "IP-2026-000017"
    assert response.contato_solicitante == "+5567999999999"


def test_get_solicitacao_publica_por_protocolo_returns_none_when_not_found() -> None:
    engine = FakeEngine(None)

    response = get_solicitacao_publica_por_protocolo(
        protocolo="IP-2026-000017",
        engine=engine,
    )

    assert response is None


def test_list_solicitacoes_internas_uses_explicit_columns_and_postgis_transform() -> None:
    engine = FakeEngine([internal_solicitacao_row()])

    response = list_solicitacoes_internas(
        status=StatusSolicitacaoIluminacao.aberta,
        limit=25,
        offset=5,
        engine=engine,
    )

    assert engine.connection.statement is not None
    assert engine.connection.params_history[0] == {
        "status": "aberta",
        "protocolo": None,
        "poste_id": None,
        "tipo_problema": None,
        "prioridade": None,
        "criado_de": None,
        "criado_ate": None,
        "limit": 25,
        "offset": 5,
    }
    assert engine.connection.params_history[1] == {
        "status": "aberta",
        "protocolo": None,
        "poste_id": None,
        "tipo_problema": None,
        "prioridade": None,
        "criado_de": None,
        "criado_ate": None,
    }

    sql = str(engine.connection.statements[0])
    count_sql = str(engine.connection.statements[1])
    select_clause = sql.split("FROM", maxsplit=1)[0]
    assert "FROM mod_iluminacao.solicitacoes" in sql
    assert "deleted_at IS NULL" in sql
    assert "COUNT(*) AS total" in count_sql
    assert "FROM mod_iluminacao.solicitacoes" in count_sql
    assert "deleted_at IS NULL" in count_sql
    assert "ST_Y(ST_Transform(geom, 4326)) AS latitude" in sql
    assert "ST_X(ST_Transform(geom, 4326)) AS longitude" in sql
    assert "SELECT *" not in sql.upper()
    assert "id" in select_clause
    assert "protocolo" in select_clause
    assert "nome_solicitante" in select_clause
    assert "contato_solicitante" in select_clause
    assert "deleted_at" not in select_clause
    assert "deleted_reason" not in select_clause
    assert ":status" in sql
    assert "CAST(:status AS varchar)" in sql
    assert "status = CAST(:status AS varchar)" in sql
    assert ":protocolo" in sql
    assert "protocolo ILIKE ('%' || CAST(:protocolo AS varchar) || '%')" in sql
    assert ":poste_id" in sql
    assert "poste_id ILIKE ('%' || CAST(:poste_id AS varchar) || '%')" in sql
    assert ":tipo_problema" in sql
    assert "tipo_problema = CAST(:tipo_problema AS varchar)" in sql
    assert ":prioridade" in sql
    assert "prioridade = CAST(:prioridade AS varchar)" in sql
    assert ":criado_de" in sql
    assert "criado_em >= CAST(:criado_de AS timestamp)" in sql
    assert ":criado_ate" in sql
    assert "criado_em <= CAST(:criado_ate AS timestamp)" in sql
    assert "LIMIT :limit" in sql
    assert "OFFSET :offset" in sql
    assert "ORDER BY criado_em DESC, id DESC" in sql
    assert "LIMIT :limit" not in count_sql
    assert "OFFSET :offset" not in count_sql
    assert "ORDER BY" not in count_sql
    assert "aberta" not in sql
    assert "POSTE-010" not in sql
    assert response.items[0].id == 10
    assert response.items[0].latitude == -23.105
    assert response.items[0].longitude == -55.225
    assert response.total == 1


def test_list_solicitacoes_internas_allows_empty_status_filter_with_bind_param() -> None:
    engine = FakeEngine([internal_solicitacao_row()])

    response = list_solicitacoes_internas(
        status=None,
        limit=50,
        offset=0,
        engine=engine,
    )

    assert response.items[0].protocolo == "IP-2026-000010"
    assert engine.connection.params_history[0] == {
        "status": None,
        "protocolo": None,
        "poste_id": None,
        "tipo_problema": None,
        "prioridade": None,
        "criado_de": None,
        "criado_ate": None,
        "limit": 50,
        "offset": 0,
    }
    sql = str(engine.connection.statements[0])
    assert "CAST(:status AS varchar) IS NULL" in sql


def test_list_solicitacoes_internas_filters_use_bind_params_without_interpolation() -> None:
    created_from = datetime(2026, 5, 1, 0, 0)
    created_to = datetime(2026, 5, 31, 23, 59)
    engine = FakeEngine([internal_solicitacao_row()])

    response = list_solicitacoes_internas(
        status=StatusSolicitacaoIluminacao.em_triagem,
        protocolo="IP-2026",
        poste_id="POSTE-010",
        tipo_problema=TipoProblemaIluminacao.lampada_apagada,
        prioridade="alta",
        criado_de=created_from,
        criado_ate=created_to,
        limit=10,
        offset=20,
        engine=engine,
    )

    sql = str(engine.connection.statements[0])
    count_sql = str(engine.connection.statements[1])
    assert response.total == 1
    assert engine.connection.params_history[0] == {
        "status": "em_triagem",
        "protocolo": "IP-2026",
        "poste_id": "POSTE-010",
        "tipo_problema": "lampada_apagada",
        "prioridade": "alta",
        "criado_de": created_from,
        "criado_ate": created_to,
        "limit": 10,
        "offset": 20,
    }
    assert engine.connection.params_history[1] == {
        "status": "em_triagem",
        "protocolo": "IP-2026",
        "poste_id": "POSTE-010",
        "tipo_problema": "lampada_apagada",
        "prioridade": "alta",
        "criado_de": created_from,
        "criado_ate": created_to,
    }
    for value in ("IP-2026", "POSTE-010", "lampada_apagada", "alta", "em_triagem"):
        assert value not in sql
        assert value not in count_sql


def test_list_solicitacoes_internas_rejects_invalid_pagination_without_sql() -> None:
    engine = FakeEngine([internal_solicitacao_row()])

    for kwargs in (
        {"limit": 0, "offset": 0},
        {"limit": 101, "offset": 0},
        {"limit": 50, "offset": -1},
    ):
        try:
            list_solicitacoes_internas(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid pagination should be rejected")

    assert engine.connection.statement is None


def test_get_solicitacao_interna_por_id_uses_bind_param_and_postgis_transform() -> None:
    engine = FakeEngine(internal_solicitacao_row())

    response = get_solicitacao_interna_por_id(
        solicitacao_id=10,
        engine=engine,
    )

    assert engine.connection.statement is not None
    assert engine.connection.params == {"solicitacao_id": 10}

    sql = str(engine.connection.statement)
    select_clause = sql.split("FROM", maxsplit=1)[0]
    assert "FROM mod_iluminacao.solicitacoes" in sql
    assert "WHERE id = :solicitacao_id" in sql
    assert "deleted_at IS NULL" in sql
    assert "ST_Y(ST_Transform(geom, 4326)) AS latitude" in sql
    assert "ST_X(ST_Transform(geom, 4326)) AS longitude" in sql
    assert "LIMIT 1" in sql
    assert "SELECT *" not in sql.upper()
    assert "id" in select_clause
    assert "protocolo" in select_clause
    assert "nome_solicitante" in select_clause
    assert "contato_solicitante" in select_clause
    assert "deleted_at" not in select_clause
    assert "deleted_reason" not in select_clause
    assert "10" not in sql
    assert "POSTE-010" not in sql
    assert response is not None
    assert response.id == 10
    assert response.protocolo == "IP-2026-000010"
    assert response.latitude == -23.105
    assert response.longitude == -55.225


def test_get_solicitacao_interna_por_id_returns_none_when_not_found() -> None:
    engine = FakeEngine(None)

    response = get_solicitacao_interna_por_id(
        solicitacao_id=999,
        engine=engine,
    )

    assert response is None
    assert engine.connection.params == {"solicitacao_id": 999}


def test_get_solicitacao_interna_por_id_rejects_invalid_id_without_sql() -> None:
    engine = FakeEngine(internal_solicitacao_row())

    try:
        get_solicitacao_interna_por_id(solicitacao_id=0, engine=engine)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid solicitacao_id should be rejected")

    assert engine.connection.statement is None


def test_solicitacao_interna_existe_uses_bind_param_and_deleted_filter() -> None:
    engine = FakeEngine({"existe": True})

    response = solicitacao_interna_existe(solicitacao_id=10, engine=engine)

    assert response is True
    assert engine.connection.statement is not None
    assert engine.connection.params == {"solicitacao_id": 10}

    sql = str(engine.connection.statement)
    assert "SELECT EXISTS" in sql
    assert "FROM mod_iluminacao.solicitacoes" in sql
    assert "WHERE id = :solicitacao_id" in sql
    assert "deleted_at IS NULL" in sql
    assert "SELECT *" not in sql.upper()
    assert "10" not in sql


def test_solicitacao_interna_existe_returns_false_when_not_found() -> None:
    engine = FakeEngine({"existe": False})

    response = solicitacao_interna_existe(solicitacao_id=999, engine=engine)

    assert response is False
    assert engine.connection.params == {"solicitacao_id": 999}


def test_solicitacao_interna_existe_rejects_invalid_id_without_sql() -> None:
    engine = FakeEngine({"existe": True})

    try:
        solicitacao_interna_existe(solicitacao_id=0, engine=engine)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid solicitacao_id should be rejected")

    assert engine.connection.statement is None


def test_list_historico_solicitacao_interna_uses_explicit_columns_and_total() -> None:
    engine = FakeEngine([historico_solicitacao_row()])

    response = list_historico_solicitacao_interna(
        solicitacao_id=10,
        limit=25,
        offset=5,
        engine=engine,
    )

    assert engine.connection.params_history[0] == {
        "solicitacao_id": 10,
        "limit": 25,
        "offset": 5,
    }
    assert engine.connection.params_history[1] == {"solicitacao_id": 10}

    sql = str(engine.connection.statements[0])
    count_sql = str(engine.connection.statements[1])
    select_clause = sql.split("FROM", maxsplit=1)[0]

    assert "FROM mod_iluminacao.solicitacoes_historico" in sql
    assert "WHERE solicitacao_id = :solicitacao_id" in sql
    assert "ORDER BY criado_em ASC, id ASC" in sql
    assert "LIMIT :limit" in sql
    assert "OFFSET :offset" in sql
    assert "COUNT(*) AS total" in count_sql
    assert "FROM mod_iluminacao.solicitacoes_historico" in count_sql
    assert "WHERE solicitacao_id = :solicitacao_id" in count_sql
    assert "LIMIT :limit" not in count_sql
    assert "OFFSET :offset" not in count_sql
    assert "ORDER BY" not in count_sql
    assert "SELECT *" not in sql.upper()
    assert "id" in select_clause
    assert "solicitacao_id" in select_clause
    assert "acao" in select_clause
    assert "status_anterior" in select_clause
    assert "status_novo" in select_clause
    assert "prioridade_anterior" in select_clause
    assert "prioridade_nova" in select_clause
    assert "usuario_id" in select_clause
    assert "usuario_nome" in select_clause
    assert "origem_acao" in select_clause
    assert "observacao_resumida" in select_clause
    assert "criado_em" in select_clause
    assert "10" not in sql
    assert "Administrador Interno" not in sql
    assert response.total == 1
    assert response.items[0].id == 50
    assert response.items[0].solicitacao_id == 10


def test_list_historico_solicitacao_interna_returns_empty_result() -> None:
    engine = FakeEngine([])

    response = list_historico_solicitacao_interna(
        solicitacao_id=10,
        limit=50,
        offset=0,
        engine=engine,
    )

    assert response.items == []
    assert response.total == 0
    assert engine.connection.params_history[0] == {
        "solicitacao_id": 10,
        "limit": 50,
        "offset": 0,
    }
    assert engine.connection.params_history[1] == {"solicitacao_id": 10}


def test_list_historico_solicitacao_interna_rejects_invalid_params_without_sql() -> None:
    engine = FakeEngine([historico_solicitacao_row()])

    for kwargs in (
        {"solicitacao_id": 0, "limit": 50, "offset": 0},
        {"solicitacao_id": 10, "limit": 0, "offset": 0},
        {"solicitacao_id": 10, "limit": 101, "offset": 0},
        {"solicitacao_id": 10, "limit": 50, "offset": -1},
    ):
        try:
            list_historico_solicitacao_interna(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid params should be rejected")

    assert engine.connection.statement is None
