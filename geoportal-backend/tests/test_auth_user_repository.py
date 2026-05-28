from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_user_repository import (
    get_auth_user_by_login,
    record_successful_login,
)


USER_ROW = {
    "id": 20,
    "nome": "Usuario Ficticio",
    "email": "usuario.ficticio@example.test",
    "login": "usuario.ficticio",
    "senha_hash": "argon2id-hash-ficticio",
    "ativo": True,
    "bloqueado_ate": None,
    "desativado_em": None,
}
RAW_PASSWORD = "senha-ficticia-nao-deve-aparecer"
TOKEN_VALUE = "token-ficticio-nao-relacionado"


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(self, row: dict[str, Any] | None = USER_ROW) -> None:
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
    def __init__(self, row: dict[str, Any] | None = USER_ROW) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


@pytest.mark.parametrize("login_informado", ["", "   "])
def test_get_auth_user_by_login_returns_none_for_blank_login(
    login_informado: str,
) -> None:
    engine = FakeEngine()

    response = get_auth_user_by_login(login_informado, engine=engine)

    assert response is None
    assert engine.connection.statement is None


def test_get_auth_user_by_login_uses_parameterized_select() -> None:
    engine = FakeEngine()

    response = get_auth_user_by_login("  Usuario.Ficticio  ", engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)
    select_clause = sql.split("FROM", maxsplit=1)[0]

    assert response is not None
    assert "SELECT" in sql
    assert "SELECT *" not in sql.upper()
    assert "FROM mod_auth.usuarios" in sql
    assert "lower(login) = lower(:login_informado)" in sql
    assert "lower(email)" not in sql
    assert ":login_informado" in sql
    assert params == {"login_informado": "Usuario.Ficticio"}
    assert "Usuario.Ficticio" not in sql
    assert "senha_hash" in select_clause
    assert "token" not in sql.lower()
    assert "sess" not in sql.lower()
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql


def test_get_auth_user_by_login_returns_internal_auth_user_record() -> None:
    blocked_until = datetime(2026, 5, 26, 13, 0, tzinfo=UTC)
    deactivated_at = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)
    engine = FakeEngine(
        {
            **USER_ROW,
            "ativo": False,
            "bloqueado_ate": blocked_until,
            "desativado_em": deactivated_at,
        }
    )

    response = get_auth_user_by_login("usuario.ficticio", engine=engine)

    assert response is not None
    assert response.id == 20
    assert response.nome == "Usuario Ficticio"
    assert response.email == "usuario.ficticio@example.test"
    assert response.login == "usuario.ficticio"
    assert response.senha_hash == "argon2id-hash-ficticio"
    assert response.ativo is False
    assert response.bloqueado_ate == blocked_until
    assert response.desativado_em == deactivated_at
    assert not hasattr(response, "token_hash")


def test_get_auth_user_by_login_allows_optional_email_missing() -> None:
    engine = FakeEngine({**USER_ROW, "email": None})

    response = get_auth_user_by_login("usuario.ficticio", engine=engine)

    assert response is not None
    assert response.email is None
    assert response.login == "usuario.ficticio"


def test_get_auth_user_by_login_returns_none_when_not_found() -> None:
    engine = FakeEngine(None)

    response = get_auth_user_by_login("usuario.inexistente", engine=engine)

    assert response is None


def test_record_successful_login_uses_parameterized_update() -> None:
    engine = FakeEngine({"id": 20})

    response = record_successful_login(usuario_id=20, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert response is True
    assert "UPDATE mod_auth.usuarios" in sql
    assert "SET ultimo_login_em = now()" in sql
    assert "atualizado_em = now()" in sql
    assert "WHERE id = :usuario_id" in sql
    assert "senha_hash" not in sql
    assert "DELETE" not in sql.upper()
    assert "INSERT" not in sql.upper()
    assert params == {"usuario_id": 20}


def test_record_successful_login_returns_false_when_not_found() -> None:
    engine = FakeEngine(None)

    response = record_successful_login(usuario_id=999, engine=engine)

    assert response is False


def test_repository_does_not_use_real_database_or_sensitive_values() -> None:
    engine = FakeEngine()

    response = get_auth_user_by_login("usuario.ficticio", engine=engine)

    assert response is not None
    sql = sql_for(engine)
    assert "lower(email)" not in sql
    assert "DATABASE_URL" not in sql
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql
