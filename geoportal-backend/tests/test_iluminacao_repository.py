from datetime import datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.iluminacao_repository import (
    create_solicitacao,
    get_solicitacao_publica_por_protocolo,
)
from app.schemas.iluminacao import IluminacaoSolicitacaoCreate

DEFAULT_ROW = {
    "protocolo": "IP-2026-000001",
    "status": "aberta",
}


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def one(self) -> dict[str, Any]:
        if self.row is None:
            raise AssertionError("row should exist")
        return self.row

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(self, row: dict[str, Any] | None = DEFAULT_ROW) -> None:
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None
        self.row = row

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        return FakeResult(self.row)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(self, row: dict[str, Any] | None = DEFAULT_ROW) -> None:
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
