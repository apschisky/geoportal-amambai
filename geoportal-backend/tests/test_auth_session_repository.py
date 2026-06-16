from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_session_repository import (
    create_session,
    get_active_session_by_token_hash,
    revoke_session,
    revoke_user_sessions,
)


SESSION_ROW = {
    "id": 10,
    "usuario_id": 20,
    "login": "usuario.ficticio",
    "nome": "Usuario Ficticio",
    "criado_em": datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
    "expira_em": datetime(2026, 5, 26, 13, 0, tzinfo=UTC),
    "revogado_em": None,
}
TOKEN_HASH = "hmac-sha256:hash-ficticio-de-token"
RAW_TOKEN = "token-bruto-ficticio-nao-deve-ser-persistido"


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
    def __init__(self, row: dict[str, Any] | None = SESSION_ROW) -> None:
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
    def __init__(self, row: dict[str, Any] | None = SESSION_ROW) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


def test_create_session_uses_insert_and_bind_params_without_raw_token() -> None:
    engine = FakeEngine()
    expira_em = datetime(2026, 5, 26, 13, 0, tzinfo=UTC)

    response = create_session(
        usuario_id=20,
        token_hash=TOKEN_HASH,
        expira_em=expira_em,
        ip_hash="ip-hash-ficticio",
        user_agent_hash="ua-hash-ficticio",
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert "INSERT INTO mod_auth.sessoes" in sql
    assert "SELECT *" not in sql.upper()
    assert ":usuario_id" in sql
    assert ":token_hash" in sql
    assert ":expira_em" in sql
    assert ":ip_hash" in sql
    assert ":user_agent_hash" in sql
    assert RAW_TOKEN not in sql
    assert RAW_TOKEN not in params.values()
    assert params == {
        "usuario_id": 20,
        "token_hash": TOKEN_HASH,
        "expira_em": expira_em,
        "ip_hash": "ip-hash-ficticio",
        "user_agent_hash": "ua-hash-ficticio",
    }
    assert response.id == 10
    assert response.usuario_id == 20
    assert response.expira_em == SESSION_ROW["expira_em"]
    assert not hasattr(response, "token_hash")


@pytest.mark.parametrize("token_hash", ["", "   "])
def test_create_session_requires_non_empty_token_hash(token_hash: str) -> None:
    with pytest.raises(ValueError):
        create_session(
            usuario_id=20,
            token_hash=token_hash,
            expira_em=datetime(2026, 5, 26, 13, 0, tzinfo=UTC),
            engine=FakeEngine(),
        )


def test_create_session_requires_expira_em() -> None:
    with pytest.raises(ValueError):
        create_session(
            usuario_id=20,
            token_hash=TOKEN_HASH,
            expira_em=None,
            engine=FakeEngine(),
        )


def test_get_active_session_by_token_hash_filters_active_session_safely() -> None:
    engine = FakeEngine()

    response = get_active_session_by_token_hash(TOKEN_HASH, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)
    select_clause = sql.split("FROM", maxsplit=1)[0]

    assert response is not None
    assert response.id == 10
    assert response.usuario_id == 20
    assert response.login == "usuario.ficticio"
    assert response.nome == "Usuario Ficticio"
    assert params == {"token_hash": TOKEN_HASH}
    assert "s.token_hash = :token_hash" in sql
    assert "s.revogado_em IS NULL" in sql
    assert "s.expira_em > now()" in sql
    assert "u.ativo IS true" in sql
    assert "u.desativado_em IS NULL" in sql
    assert "u.bloqueado_ate <= now()" in sql
    assert "senha_hash" not in sql
    assert "token_bruto" not in sql
    assert "token_hash" not in select_clause
    assert "SELECT *" not in sql.upper()
    assert RAW_TOKEN not in sql
    assert RAW_TOKEN not in params.values()
    assert not hasattr(response, "token_hash")


def test_get_active_session_by_token_hash_returns_none_when_not_found() -> None:
    engine = FakeEngine(None)

    response = get_active_session_by_token_hash(TOKEN_HASH, engine=engine)

    assert response is None


def test_get_active_session_by_token_hash_returns_none_for_blank_hash() -> None:
    engine = FakeEngine()

    response = get_active_session_by_token_hash("   ", engine=engine)

    assert response is None
    assert engine.connection.statement is None


def test_revoke_session_uses_update_and_sets_revogado_em() -> None:
    engine = FakeEngine({"id": 10})

    response = revoke_session(session_id=10, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert response is True
    assert "UPDATE mod_auth.sessoes" in sql
    assert "SET revogado_em = now()" in sql
    assert "WHERE id = :session_id" in sql
    assert "DELETE" not in sql.upper()
    assert params == {"session_id": 10}


def test_revoke_session_returns_false_when_not_found() -> None:
    engine = FakeEngine(None)

    response = revoke_session(session_id=999, engine=engine)

    assert response is False


def test_revoke_user_sessions_uses_update_and_usuario_id_bind_param() -> None:
    engine = FakeEngine({"revoked_count": 2})

    response = revoke_user_sessions(usuario_id=20, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert response is True
    assert "UPDATE mod_auth.sessoes" in sql
    assert "SET revogado_em = now()" in sql
    assert "WHERE usuario_id = :usuario_id" in sql
    assert "DELETE" not in sql.upper()
    assert params == {"usuario_id": 20}


def test_revoke_user_sessions_returns_false_when_no_rows_change() -> None:
    engine = FakeEngine({"revoked_count": 0})

    response = revoke_user_sessions(usuario_id=20, engine=engine)

    assert response is False


def test_repository_does_not_require_real_database_or_sensitive_values() -> None:
    engine = FakeEngine(
        {
            **SESSION_ROW,
            "expira_em": SESSION_ROW["criado_em"] + timedelta(hours=1),
        }
    )

    response = create_session(
        usuario_id=20,
        token_hash=TOKEN_HASH,
        expira_em=SESSION_ROW["expira_em"],
        engine=engine,
    )

    assert response.usuario_id == 20
    assert "DATABASE_URL" not in sql_for(engine)
    assert RAW_TOKEN not in sql_for(engine)
