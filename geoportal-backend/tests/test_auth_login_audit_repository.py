from datetime import UTC, datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_login_audit_repository import (
    count_recent_failed_attempts,
    record_login_attempt,
)


AUDIT_ROW = {"id": 40}
COUNT_ROW = {"failed_count": 3}
LOGIN_FICTICIO = "usuario.ficticio"
ORIGEM_FICTICIA = "origem-ficticia-controlada"
SENHA_FICTICIA = "senha-ficticia-nao-auditar"
SENHA_HASH_FICTICIO = "senha-hash-ficticio-nao-auditar"
TOKEN_FICTICIO = "token-ficticio-nao-auditar"
TOKEN_HASH_FICTICIO = "token-hash-ficticio-nao-auditar"
SESSION_SECRET_FICTICIO = "segredo-ficticio-nao-auditar"


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def one(self) -> dict[str, Any]:
        if self.row is None:
            raise AssertionError("row should exist")
        return self.row


class FakeConnection:
    def __init__(self, row: dict[str, Any] | None = AUDIT_ROW) -> None:
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
    def __init__(self, row: dict[str, Any] | None = AUDIT_ROW) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


def assert_sensitive_values_absent(sql: str, params: dict[str, Any]) -> None:
    values = set(str(value) for value in params.values() if value is not None)
    assert SENHA_FICTICIA not in sql
    assert SENHA_HASH_FICTICIO not in sql
    assert TOKEN_FICTICIO not in sql
    assert TOKEN_HASH_FICTICIO not in sql
    assert SESSION_SECRET_FICTICIO not in sql
    assert SENHA_FICTICIA not in values
    assert SENHA_HASH_FICTICIO not in values
    assert TOKEN_FICTICIO not in values
    assert TOKEN_HASH_FICTICIO not in values
    assert SESSION_SECRET_FICTICIO not in values


def test_record_login_attempt_uses_insert_and_bind_params() -> None:
    engine = FakeEngine()

    response = record_login_attempt(
        usuario_id=20,
        login_informado=LOGIN_FICTICIO,
        sucesso=False,
        motivo_falha="credencial_invalida",
        origem=ORIGEM_FICTICIA,
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert response == 40
    assert "INSERT INTO mod_auth.login_auditoria" in sql
    assert "SELECT *" not in sql.upper()
    assert ":usuario_id" in sql
    assert ":login_informado" in sql
    assert ":sucesso" in sql
    assert ":motivo_falha" in sql
    assert ":origem" in sql
    assert params == {
        "usuario_id": 20,
        "login_informado": LOGIN_FICTICIO,
        "sucesso": False,
        "motivo_falha": "credencial_invalida",
        "origem": ORIGEM_FICTICIA,
    }
    assert_sensitive_values_absent(sql, params)


def test_record_login_attempt_allows_unknown_user_and_blank_optional_values() -> None:
    engine = FakeEngine()

    response = record_login_attempt(
        usuario_id=None,
        login_informado="   ",
        sucesso=False,
        motivo_falha="   ",
        origem="   ",
        engine=engine,
    )

    params = params_for(engine)

    assert response == 40
    assert params["usuario_id"] is None
    assert params["login_informado"] is None
    assert params["motivo_falha"] is None
    assert params["origem"] is None


def test_count_recent_failed_attempts_uses_count_and_bind_params() -> None:
    engine = FakeEngine(COUNT_ROW)
    since = datetime(2026, 5, 26, 12, 0, tzinfo=UTC)

    response = count_recent_failed_attempts(
        since=since,
        login_informado=LOGIN_FICTICIO,
        origem=ORIGEM_FICTICIA,
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert response == 3
    assert "SELECT count(*) AS failed_count" in sql
    assert "FROM mod_auth.login_auditoria" in sql
    assert "sucesso IS false" in sql
    assert "criado_em >= :since" in sql
    assert "login_informado = :login_informado" in sql
    assert "origem = :origem" in sql
    assert "SELECT *" not in sql.upper()
    assert "senha" not in sql.lower()
    assert "token" not in sql.lower()
    assert params == {
        "since": since,
        "login_informado": LOGIN_FICTICIO,
        "origem": ORIGEM_FICTICIA,
    }
    assert_sensitive_values_absent(sql, params)


def test_count_recent_failed_attempts_supports_generic_window_without_filters() -> None:
    engine = FakeEngine({"failed_count": 0})
    since = datetime(2026, 5, 26, 12, 0, tzinfo=UTC)

    response = count_recent_failed_attempts(
        since=since,
        login_informado=" ",
        origem=None,
        engine=engine,
    )

    params = params_for(engine)

    assert response == 0
    assert params == {
        "since": since,
        "login_informado": None,
        "origem": None,
    }
