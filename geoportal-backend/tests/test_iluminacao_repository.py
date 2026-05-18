from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.iluminacao_repository import create_solicitacao
from app.schemas.iluminacao import IluminacaoSolicitacaoCreate


class FakeResult:
    def mappings(self) -> "FakeResult":
        return self

    def one(self) -> dict[str, str]:
        return {
            "protocolo": "IP-2026-000001",
            "status": "aberta",
        }


class FakeConnection:
    def __init__(self) -> None:
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        return FakeResult()


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(self) -> None:
        self.connection = FakeConnection()

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
