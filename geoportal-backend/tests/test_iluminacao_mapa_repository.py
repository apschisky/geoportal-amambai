from datetime import datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.iluminacao_repository import (
    get_mapa_ocorrencia_popup_interno,
    list_mapa_ocorrencias_internas,
)
from app.schemas.iluminacao import StatusSolicitacaoIluminacao


CREATED_AT = datetime(2026, 5, 20, 10, 30)
UPDATED_AT = datetime(2026, 5, 21, 8, 15)


def mapa_row(**overrides: Any) -> dict[str, Any]:
    return {
        "id": 10,
        "protocolo": "IP-2026-000010",
        "origem": "geoportal_publico",
        "localizacao_tipo": "poste_mapa",
        "poste_id": "POSTE-010",
        "referencia_localizacao": "Poste POSTE-010",
        "tipo_problema": "lampada_apagada",
        "status": "aberta",
        "prioridade": "normal",
        "latitude": -23.105,
        "longitude": -55.225,
        "criado_em": CREATED_AT,
        "atualizado_em": UPDATED_AT,
        "finalizado_em": None,
        "dados_pessoais_disponiveis": False,
        **overrides,
    }


class FakeResult:
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def all(self) -> list[dict[str, Any]]:
        if self.row is None:
            return []
        if isinstance(self.row, list):
            return self.row
        return [self.row]

    def one(self) -> dict[str, Any]:
        if self.row is None:
            raise AssertionError("row should exist")
        if isinstance(self.row, list):
            return self.row[0]
        return self.row

    def first(self) -> dict[str, Any] | None:
        if isinstance(self.row, list):
            return self.row[0] if self.row else None
        return self.row


class FakeConnection:
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None) -> None:
        self.row = row
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None
        self.statements: list[TextClause] = []
        self.params_history: list[dict[str, Any]] = []

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
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def test_list_mapa_ocorrencias_uses_minimized_columns_and_filters() -> None:
    engine = FakeEngine([mapa_row()])

    response = list_mapa_ocorrencias_internas(
        status=StatusSolicitacaoIluminacao.aberta,
        prioridade="normal",
        ativos=True,
        limit=25,
        offset=5,
        engine=engine,
    )

    sql = str(engine.connection.statements[0])
    count_sql = str(engine.connection.statements[1])
    select_clause = sql.split("FROM", maxsplit=1)[0]
    all_sql = f"{sql}\n{count_sql}"

    assert response.total == 1
    assert response.items[0].protocolo == "IP-2026-000010"
    assert response.items[0].latitude == -23.105
    assert response.items[0].longitude == -55.225
    assert engine.connection.params_history[0] == {
        "status": "aberta",
        "prioridade": "normal",
        "ativos": True,
        "limit": 25,
        "offset": 5,
    }
    assert engine.connection.params_history[1] == {
        "status": "aberta",
        "prioridade": "normal",
        "ativos": True,
    }
    for expected in (
        "FROM mod_iluminacao.solicitacoes",
        "deleted_at IS NULL",
        "geom IS NOT NULL",
        "ST_Y(ST_Transform(geom, 4326)) BETWEEN -90 AND 90",
        "ST_X(ST_Transform(geom, 4326)) BETWEEN -180 AND 180",
        "status = CAST(:status AS varchar)",
        "prioridade = CAST(:prioridade AS varchar)",
        "status NOT IN",
        "ORDER BY criado_em DESC, id DESC",
        "LIMIT :limit",
        "OFFSET :offset",
    ):
        assert expected in all_sql
    assert "COUNT(*) AS total" in count_sql
    assert "LIMIT :limit" not in count_sql
    assert "OFFSET :offset" not in count_sql
    assert "ORDER BY" not in count_sql
    for expected in (
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
    ):
        assert expected in select_clause
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "descricao",
        "observacoes_localizacao",
        "ponto_referencia",
        "poste_proximo_informado",
        "deleted_reason",
        "SELECT *",
        "aberta",
        "normal",
        "POSTE-010",
    ):
        assert forbidden not in all_sql


def test_list_mapa_ocorrencias_rejects_invalid_pagination_without_sql() -> None:
    engine = FakeEngine([mapa_row()])

    for kwargs in (
        {"limit": 0, "offset": 0},
        {"limit": 501, "offset": 0},
        {"limit": 250, "offset": -1},
    ):
        try:
            list_mapa_ocorrencias_internas(engine=engine, **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid pagination should be rejected")

    assert engine.connection.statement is None


def test_get_mapa_ocorrencia_popup_uses_conservative_columns() -> None:
    engine = FakeEngine(mapa_row())

    response = get_mapa_ocorrencia_popup_interno(10, engine=engine)

    assert response is not None
    assert response.protocolo == "IP-2026-000010"
    assert response.dados_pessoais_disponiveis is False
    assert engine.connection.params == {"solicitacao_id": 10}
    sql = str(engine.connection.statement)
    assert "id = :solicitacao_id" in sql
    assert "deleted_at IS NULL" in sql
    assert "geom IS NOT NULL" in sql
    assert "ST_Y(ST_Transform(geom, 4326)) BETWEEN -90 AND 90" in sql
    assert "ST_X(ST_Transform(geom, 4326)) BETWEEN -180 AND 180" in sql
    assert "false AS dados_pessoais_disponiveis" in sql
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "descricao",
        "observacoes_localizacao",
        "ponto_referencia",
        "poste_proximo_informado",
        "deleted_reason",
        "SELECT *",
        "IP-2026-000010",
    ):
        assert forbidden not in sql


def test_get_mapa_ocorrencia_popup_returns_none_when_not_found() -> None:
    engine = FakeEngine(None)

    response = get_mapa_ocorrencia_popup_interno(999, engine=engine)

    assert response is None
