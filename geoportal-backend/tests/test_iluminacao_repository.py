from datetime import datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.iluminacao_repository import (
    create_observacao_solicitacao_interna,
    create_solicitacao,
    existe_solicitacao_ativa_para_poste,
    get_solicitacao_interna_por_id,
    get_solicitacao_publica_por_protocolo,
    list_historico_solicitacao_interna,
    list_observacoes_solicitacao_interna,
    list_solicitacoes_internas,
    solicitacao_interna_existe,
    update_status_solicitacao_interna,
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


class FakeCreateObservacaoConnection(FakeConnection):
    def __init__(self, *, exists: bool = True) -> None:
        super().__init__(observacao_solicitacao_row())
        self.exists = exists

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        self.statements.append(statement)
        self.params_history.append(params)

        sql = str(statement)
        if "SELECT EXISTS" in sql:
            return FakeResult({"existe": self.exists})
        if "INSERT INTO mod_iluminacao.solicitacoes_observacoes" in sql:
            row = observacao_solicitacao_row()
            row["observacao"] = params["observacao"]
            row["usuario_id"] = params["usuario_id"]
            row["usuario_nome"] = params["usuario_nome"]
            return FakeResult(row)
        if "INSERT INTO mod_iluminacao.solicitacoes_historico" in sql:
            return FakeResult({"id": 1})
        raise AssertionError(f"unexpected SQL statement: {sql}")


class FakeCreateObservacaoEngine:
    def __init__(self, *, exists: bool = True) -> None:
        self.connection = FakeCreateObservacaoConnection(exists=exists)
        self.begin_count = 0

    def begin(self) -> FakeBegin:
        self.begin_count += 1
        return FakeBegin(self.connection)


class FakeUpdateStatusConnection(FakeConnection):
    def __init__(
        self,
        *,
        current_status: str | None = "encaminhada",
        fail_history: bool = False,
    ) -> None:
        super().__init__(status_solicitacao_row(status=current_status or "encaminhada"))
        self.current_status = current_status
        self.fail_history = fail_history

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        self.statements.append(statement)
        self.params_history.append(params)

        sql = str(statement)
        if "FOR UPDATE" in sql:
            if self.current_status is None:
                return FakeResult(None)
            return FakeResult(status_solicitacao_row(status=self.current_status))
        if "UPDATE mod_iluminacao.solicitacoes" in sql:
            return FakeResult(
                status_solicitacao_row(
                    status=params["status_novo"],
                    finalizado=params["is_terminal_status"],
                )
            )
        if "INSERT INTO mod_iluminacao.solicitacoes_historico" in sql:
            if self.fail_history:
                raise RuntimeError("history insert failed with SQL details")
            return FakeResult({"id": 1})
        raise AssertionError(f"unexpected SQL statement: {sql}")


class FakeUpdateStatusBegin(FakeBegin):
    def __init__(self, connection: FakeUpdateStatusConnection) -> None:
        super().__init__(connection)
        self.rolled_back = False

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.rolled_back = exc_type is not None
        return None


class FakeUpdateStatusEngine:
    def __init__(
        self,
        *,
        current_status: str | None = "encaminhada",
        fail_history: bool = False,
    ) -> None:
        self.connection = FakeUpdateStatusConnection(
            current_status=current_status,
            fail_history=fail_history,
        )
        self.begin_count = 0
        self.begin_context: FakeUpdateStatusBegin | None = None

    def begin(self) -> FakeUpdateStatusBegin:
        self.begin_count += 1
        self.begin_context = FakeUpdateStatusBegin(self.connection)
        return self.begin_context


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


def observacao_solicitacao_row() -> dict[str, Any]:
    return {
        "id": 70,
        "solicitacao_id": 10,
        "observacao": "Equipe acionada.",
        "visibilidade": "interna",
        "usuario_id": "7",
        "usuario_nome": "Administrador Interno",
        "criado_em": datetime(2026, 5, 20, 12, 30),
        "editado_em": None,
    }


def status_solicitacao_row(
    status: str = "em_execucao",
    *,
    finalizado: bool = False,
) -> dict[str, Any]:
    return {
        "id": 10,
        "status": status,
        "atualizado_em": datetime(2026, 5, 21, 8, 15),
        "finalizado_em": datetime(2026, 5, 21, 9, 30) if finalizado else None,
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


def test_list_observacoes_solicitacao_interna_uses_explicit_columns_and_total() -> None:
    engine = FakeEngine([observacao_solicitacao_row()])

    response = list_observacoes_solicitacao_interna(
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

    assert "FROM mod_iluminacao.solicitacoes_observacoes" in sql
    assert "WHERE solicitacao_id = :solicitacao_id" in sql
    assert "deleted_at IS NULL" in sql
    assert "visibilidade = 'interna'" in sql
    assert "ORDER BY criado_em ASC, id ASC" in sql
    assert "LIMIT :limit" in sql
    assert "OFFSET :offset" in sql
    assert "COUNT(*) AS total" in count_sql
    assert "FROM mod_iluminacao.solicitacoes_observacoes" in count_sql
    assert "WHERE solicitacao_id = :solicitacao_id" in count_sql
    assert "deleted_at IS NULL" in count_sql
    assert "visibilidade = 'interna'" in count_sql
    assert "LIMIT :limit" not in count_sql
    assert "OFFSET :offset" not in count_sql
    assert "ORDER BY" not in count_sql
    assert "SELECT *" not in sql.upper()
    assert "id" in select_clause
    assert "solicitacao_id" in select_clause
    assert "observacao" in select_clause
    assert "visibilidade" in select_clause
    assert "usuario_id" in select_clause
    assert "usuario_nome" in select_clause
    assert "criado_em" in select_clause
    assert "editado_em" in select_clause
    assert "deleted_at" not in select_clause
    assert "10" not in sql
    assert "Equipe acionada" not in sql
    assert "publica_futura" not in sql
    assert response.total == 1
    assert response.items[0].id == 70
    assert response.items[0].solicitacao_id == 10
    assert response.items[0].visibilidade == "interna"


def test_list_observacoes_solicitacao_interna_returns_empty_result() -> None:
    engine = FakeEngine([])

    response = list_observacoes_solicitacao_interna(
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


def test_list_observacoes_solicitacao_interna_rejects_invalid_params_without_sql() -> None:
    engine = FakeEngine([observacao_solicitacao_row()])

    for kwargs in (
        {"solicitacao_id": 0, "limit": 50, "offset": 0},
        {"solicitacao_id": 10, "limit": 0, "offset": 0},
        {"solicitacao_id": 10, "limit": 101, "offset": 0},
        {"solicitacao_id": 10, "limit": 50, "offset": -1},
    ):
        try:
            list_observacoes_solicitacao_interna(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid params should be rejected")

    assert engine.connection.statement is None


def test_create_observacao_solicitacao_interna_uses_transaction_and_history() -> None:
    engine = FakeCreateObservacaoEngine()

    response = create_observacao_solicitacao_interna(
        solicitacao_id=10,
        observacao="  Equipe acionada.  ",
        usuario_id="7",
        usuario_nome=None,
        engine=engine,
    )

    assert engine.begin_count == 1
    assert len(engine.connection.statements) == 3
    assert engine.connection.params_history[0] == {"solicitacao_id": 10}
    assert engine.connection.params_history[1] == {
        "solicitacao_id": 10,
        "observacao": "Equipe acionada.",
        "visibilidade": "interna",
        "usuario_id": "7",
        "usuario_nome": None,
    }
    assert engine.connection.params_history[2] == {
        "solicitacao_id": 10,
        "acao": "observacao_interna",
        "usuario_id": "7",
        "usuario_nome": None,
        "origem_acao": "usuario_interno",
        "observacao_resumida": "Equipe acionada.",
    }

    exists_sql = str(engine.connection.statements[0])
    observacao_sql = str(engine.connection.statements[1])
    historico_sql = str(engine.connection.statements[2])
    assert "SELECT EXISTS" in exists_sql
    assert "FROM mod_iluminacao.solicitacoes" in exists_sql
    assert "WHERE id = :solicitacao_id" in exists_sql
    assert "deleted_at IS NULL" in exists_sql
    assert "INSERT INTO mod_iluminacao.solicitacoes_observacoes" in observacao_sql
    assert "solicitacao_id" in observacao_sql
    assert "observacao" in observacao_sql
    assert "visibilidade" in observacao_sql
    assert "usuario_id" in observacao_sql
    assert "usuario_nome" in observacao_sql
    assert "RETURNING" in observacao_sql
    assert "deleted_at" not in observacao_sql.split("RETURNING", maxsplit=1)[1]
    assert "INSERT INTO mod_iluminacao.solicitacoes_historico" in historico_sql
    assert "acao" in historico_sql
    assert "origem_acao" in historico_sql
    assert "observacao_resumida" in historico_sql
    assert "SELECT *" not in exists_sql.upper()
    assert "SELECT *" not in observacao_sql.upper()
    assert "SELECT *" not in historico_sql.upper()
    combined_sql = (exists_sql + observacao_sql + historico_sql).upper()
    assert "DELETE FROM" not in combined_sql
    assert "UPDATE " not in combined_sql
    assert "Equipe acionada" not in observacao_sql
    assert "Equipe acionada" not in historico_sql
    assert "observacao_interna" not in historico_sql
    assert "usuario_interno" not in historico_sql
    assert "publica_futura" not in observacao_sql
    assert response is not None
    assert response.observacao == "Equipe acionada."
    assert response.visibilidade == "interna"
    assert response.usuario_id == "7"


def test_create_observacao_solicitacao_interna_truncates_historico_summary() -> None:
    engine = FakeCreateObservacaoEngine()
    observacao = "a" * 1500

    response = create_observacao_solicitacao_interna(
        solicitacao_id=10,
        observacao=observacao,
        usuario_id="7",
        usuario_nome=" Administrador Interno ",
        engine=engine,
    )

    assert response is not None
    assert response.observacao == observacao
    assert engine.connection.params_history[1]["usuario_nome"] == "Administrador Interno"
    assert engine.connection.params_history[2]["usuario_nome"] == "Administrador Interno"
    assert engine.connection.params_history[2]["observacao_resumida"] == "a" * 1000


def test_create_observacao_solicitacao_interna_returns_none_when_not_found() -> None:
    engine = FakeCreateObservacaoEngine(exists=False)

    response = create_observacao_solicitacao_interna(
        solicitacao_id=999,
        observacao="Equipe acionada.",
        usuario_id="7",
        engine=engine,
    )

    assert response is None
    assert engine.begin_count == 1
    assert len(engine.connection.statements) == 1
    assert engine.connection.params_history[0] == {"solicitacao_id": 999}


def test_create_observacao_solicitacao_interna_rejects_invalid_input_without_sql() -> None:
    engine = FakeCreateObservacaoEngine()

    for kwargs in (
        {"solicitacao_id": 0, "observacao": "Equipe acionada.", "usuario_id": "7"},
        {"solicitacao_id": 10, "observacao": "", "usuario_id": "7"},
        {"solicitacao_id": 10, "observacao": " ab ", "usuario_id": "7"},
        {"solicitacao_id": 10, "observacao": "a" * 2001, "usuario_id": "7"},
        {"solicitacao_id": 10, "observacao": "Equipe acionada.", "usuario_id": " "},
    ):
        try:
            create_observacao_solicitacao_interna(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid input should be rejected")

    assert engine.begin_count == 0
    assert engine.connection.statement is None


def test_update_status_solicitacao_interna_uses_transaction_update_and_history() -> None:
    engine = FakeUpdateStatusEngine(current_status="encaminhada")

    result = update_status_solicitacao_interna(
        solicitacao_id=10,
        status_novo="em_execucao",
        allowed_current_statuses={"encaminhada", "aguardando_material"},
        is_terminal_status=False,
        observacao_resumida="Equipe iniciou atendimento.",
        usuario_id="7",
        usuario_nome=None,
        engine=engine,
    )

    assert engine.begin_count == 1
    assert len(engine.connection.statements) == 3
    assert engine.connection.params_history[0] == {"solicitacao_id": 10}
    assert engine.connection.params_history[1] == {
        "solicitacao_id": 10,
        "status_novo": "em_execucao",
        "is_terminal_status": False,
    }
    assert engine.connection.params_history[2] == {
        "solicitacao_id": 10,
        "acao": "alteracao_status",
        "status_anterior": "encaminhada",
        "status_novo": "em_execucao",
        "usuario_id": "7",
        "usuario_nome": None,
        "origem_acao": "usuario_interno",
        "observacao_resumida": "Equipe iniciou atendimento.",
    }

    select_sql = str(engine.connection.statements[0])
    update_sql = str(engine.connection.statements[1])
    historico_sql = str(engine.connection.statements[2])
    update_set_clause = update_sql.split("WHERE", maxsplit=1)[0]
    combined_sql = (select_sql + update_sql + historico_sql).upper()

    assert "FROM mod_iluminacao.solicitacoes" in select_sql
    assert "WHERE id = :solicitacao_id" in select_sql
    assert "deleted_at IS NULL" in select_sql
    assert "FOR UPDATE" in select_sql
    assert "UPDATE mod_iluminacao.solicitacoes" in update_sql
    assert "status = :status_novo" in update_sql
    assert "atualizado_em = now()" in update_sql
    assert "finalizado_em = CASE" in update_sql
    assert "RETURNING" in update_sql
    assert "INSERT INTO mod_iluminacao.solicitacoes_historico" in historico_sql
    assert "status_anterior" in historico_sql
    assert "status_novo" in historico_sql
    assert "prioridade_anterior" in historico_sql
    assert "prioridade_nova" in historico_sql
    assert "observacao_resumida" in historico_sql
    assert "SELECT *" not in combined_sql
    assert "DELETE FROM" not in combined_sql
    for forbidden in (
        "protocolo",
        "origem",
        "localizacao_tipo",
        "poste_id",
        "geom",
        "tipo_problema",
        "descricao",
        "nome_solicitante",
        "contato_solicitante",
        "prioridade =",
        "duplicidade_suspeita",
        "deleted_reason",
    ):
        assert forbidden not in update_set_clause
    for value in (
        "Equipe iniciou atendimento",
        "em_execucao",
        "encaminhada",
        "alteracao_status",
        "usuario_interno",
    ):
        assert value not in update_sql
        assert value not in historico_sql
    assert result.outcome == "updated"
    assert result.solicitacao is not None
    assert result.solicitacao.status == "em_execucao"
    assert result.solicitacao.finalizado_em is None


def test_update_status_solicitacao_interna_sets_finalizado_for_terminal_status() -> None:
    engine = FakeUpdateStatusEngine(current_status="em_execucao")

    result = update_status_solicitacao_interna(
        solicitacao_id=10,
        status_novo="resolvida",
        allowed_current_statuses={"em_execucao"},
        is_terminal_status=True,
        observacao_resumida="Atendimento concluido.",
        usuario_id="7",
        engine=engine,
    )

    assert result.outcome == "updated"
    assert result.solicitacao is not None
    assert result.solicitacao.status == "resolvida"
    assert result.solicitacao.finalizado_em == datetime(2026, 5, 21, 9, 30)
    assert engine.connection.params_history[1]["is_terminal_status"] is True


def test_update_status_solicitacao_interna_is_idempotent_without_update_or_history() -> None:
    engine = FakeUpdateStatusEngine(current_status="aberta")

    result = update_status_solicitacao_interna(
        solicitacao_id=10,
        status_novo="aberta",
        allowed_current_statuses=set(),
        is_terminal_status=False,
        observacao_resumida="Reenvio idempotente.",
        usuario_id="7",
        engine=engine,
    )

    assert result.outcome == "idempotent"
    assert result.solicitacao is not None
    assert result.solicitacao.status == "aberta"
    assert len(engine.connection.statements) == 1
    assert "FOR UPDATE" in str(engine.connection.statements[0])


def test_update_status_solicitacao_interna_returns_invalid_transition_without_update() -> None:
    engine = FakeUpdateStatusEngine(current_status="resolvida")

    result = update_status_solicitacao_interna(
        solicitacao_id=10,
        status_novo="em_execucao",
        allowed_current_statuses={"encaminhada", "aguardando_material"},
        is_terminal_status=False,
        observacao_resumida="Tentativa de reabertura.",
        usuario_id="7",
        engine=engine,
    )

    assert result.outcome == "invalid_transition"
    assert result.status_atual == "resolvida"
    assert result.solicitacao is None
    assert len(engine.connection.statements) == 1


def test_update_status_solicitacao_interna_returns_not_found_without_update() -> None:
    engine = FakeUpdateStatusEngine(current_status=None)

    result = update_status_solicitacao_interna(
        solicitacao_id=999,
        status_novo="em_execucao",
        allowed_current_statuses={"encaminhada"},
        is_terminal_status=False,
        observacao_resumida="Equipe iniciou atendimento.",
        usuario_id="7",
        engine=engine,
    )

    assert result.outcome == "not_found"
    assert result.solicitacao is None
    assert len(engine.connection.statements) == 1


def test_update_status_solicitacao_interna_rolls_back_when_history_fails() -> None:
    engine = FakeUpdateStatusEngine(current_status="encaminhada", fail_history=True)

    try:
        update_status_solicitacao_interna(
            solicitacao_id=10,
            status_novo="em_execucao",
            allowed_current_statuses={"encaminhada"},
            is_terminal_status=False,
            observacao_resumida="Equipe iniciou atendimento.",
            usuario_id="7",
            engine=engine,
        )
    except RuntimeError:
        pass
    else:
        raise AssertionError("history failure should propagate to trigger rollback")

    assert engine.begin_count == 1
    assert engine.begin_context is not None
    assert engine.begin_context.rolled_back is True
    assert len(engine.connection.statements) == 3


def test_update_status_solicitacao_interna_rejects_invalid_input_without_sql() -> None:
    engine = FakeUpdateStatusEngine()

    for kwargs in (
        {
            "solicitacao_id": 0,
            "status_novo": "em_execucao",
            "allowed_current_statuses": {"encaminhada"},
            "is_terminal_status": False,
            "observacao_resumida": "Equipe iniciou atendimento.",
            "usuario_id": "7",
        },
        {
            "solicitacao_id": 10,
            "status_novo": "em_execucao",
            "allowed_current_statuses": {"encaminhada"},
            "is_terminal_status": False,
            "observacao_resumida": " ab ",
            "usuario_id": "7",
        },
        {
            "solicitacao_id": 10,
            "status_novo": "em_execucao",
            "allowed_current_statuses": {"encaminhada"},
            "is_terminal_status": False,
            "observacao_resumida": "a" * 1001,
            "usuario_id": "7",
        },
        {
            "solicitacao_id": 10,
            "status_novo": "em_execucao",
            "allowed_current_statuses": {"encaminhada"},
            "is_terminal_status": False,
            "observacao_resumida": "Equipe iniciou atendimento.",
            "usuario_id": " ",
        },
    ):
        try:
            update_status_solicitacao_interna(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid input should be rejected")

    assert engine.begin_count == 0
    assert engine.connection.statement is None
