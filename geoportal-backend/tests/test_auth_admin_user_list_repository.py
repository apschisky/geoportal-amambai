from datetime import UTC, datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_list_repository import (
    InternalAdminUserListItem,
    list_internal_admin_users,
)


CREATED_AT = datetime(2026, 5, 29, 9, 30, tzinfo=UTC)
SENSITIVE_MARKERS = (
    "senha",
    "senha_hash",
    "token",
    "token_hash",
    "cookie",
    "session_secret",
    "DATABASE_URL",
    "role",
    "GRANT",
)


class FakeResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def mappings(self) -> "FakeResult":
        return self

    def all(self) -> list[dict[str, Any]]:
        return self.rows


class FakeConnection:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None
        self.rows = rows or []

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        return FakeResult(self.rows)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.connection = FakeConnection(rows)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


def test_list_internal_admin_users_returns_safe_user_items() -> None:
    engine = FakeEngine(
        [
            {
                "id": 7,
                "login": "admin.homologacao",
                "nome": "Administrador Homologacao",
                "email": None,
                "ativo": True,
                "bloqueado": False,
                "criado_em": CREATED_AT,
            }
        ]
    )

    response = list_internal_admin_users(engine=engine)

    assert response == [
        InternalAdminUserListItem(
            id=7,
            login="admin.homologacao",
            nome="Administrador Homologacao",
            email=None,
            ativo=True,
            bloqueado=False,
            criado_em=CREATED_AT,
        )
    ]


def test_list_internal_admin_users_uses_safe_sql_and_bind_parameters() -> None:
    engine = FakeEngine()

    list_internal_admin_users(limit=100, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert "FROM mod_auth.usuarios" in sql
    assert "LIMIT :limit" in sql
    assert "ORDER BY lower(login), id" in sql
    assert "(bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado" in sql
    assert params == {"limit": 100}
    assert "admin.homologacao" not in sql
    for marker in SENSITIVE_MARKERS:
        assert marker.lower() not in sql.lower()


def test_list_internal_admin_users_selects_only_allowed_response_columns() -> None:
    engine = FakeEngine()

    list_internal_admin_users(engine=engine)

    sql = sql_for(engine)
    select_clause = sql.split("FROM mod_auth.usuarios", maxsplit=1)[0]

    assert "id" in select_clause
    assert "login" in select_clause
    assert "nome" in select_clause
    assert "email" in select_clause
    assert "ativo" in select_clause
    assert "bloqueado" in select_clause
    assert "criado_em" in select_clause
    assert "atualizado_em" not in select_clause
    assert "ultimo_login_em" not in select_clause
    assert "senha_hash" not in select_clause
    assert "token_hash" not in select_clause


def test_list_internal_admin_users_rejects_invalid_limit() -> None:
    engine = FakeEngine()

    try:
        list_internal_admin_users(limit=0, engine=engine)
    except ValueError as exc:
        assert str(exc) == "limit must be positive"
    else:
        raise AssertionError("limit=0 should be rejected")
