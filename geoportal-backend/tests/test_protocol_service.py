import pytest

from sqlalchemy.sql.elements import TextClause

from app.services.protocol_service import (
    generate_protocol,
    generate_protocol_from_database,
)


class FakeResult:
    def scalar_one(self) -> str:
        return "IP-2026-000123"


class FakeConnection:
    def __init__(self) -> None:
        self.statement: TextClause | None = None

    def execute(self, statement: TextClause) -> FakeResult:
        self.statement = statement
        return FakeResult()


class FakeConnect:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(self) -> None:
        self.connection = FakeConnection()

    def connect(self) -> FakeConnect:
        return FakeConnect(self.connection)


def test_generate_protocol_formats_expected_value() -> None:
    assert generate_protocol(prefix="IP", year=2026, sequence=1) == "IP-2026-000001"


def test_generate_protocol_uppercases_prefix() -> None:
    assert generate_protocol(prefix="ip", year=2026, sequence=1) == "IP-2026-000001"


def test_generate_protocol_formats_sequence_with_six_digits() -> None:
    assert generate_protocol(prefix="IP", year=2026, sequence=25) == "IP-2026-000025"


def test_generate_protocol_rejects_empty_prefix() -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="   ", year=2026, sequence=1)


@pytest.mark.parametrize("year", [999, 10000])
def test_generate_protocol_rejects_invalid_year(year: int) -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="IP", year=year, sequence=1)


@pytest.mark.parametrize("sequence", [0, -1])
def test_generate_protocol_rejects_invalid_sequence(sequence: int) -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="IP", year=2026, sequence=sequence)


def test_generate_protocol_from_database_uses_sequence_sql() -> None:
    engine = FakeEngine()

    protocolo = generate_protocol_from_database(engine=engine)

    assert engine.connection.statement is not None
    sql = str(engine.connection.statement)

    assert "nextval" in sql
    assert "solicitacoes_protocolo_seq" in sql
    assert "lpad" in sql
    assert "COUNT" not in sql.upper()
    assert protocolo == "IP-2026-000123"
