from datetime import UTC, datetime
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_profile_repository import (
    InternalAdminProfileListItem,
    list_internal_admin_profiles,
)


CREATED_AT = datetime(2026, 5, 29, 15, 0, tzinfo=UTC)
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


def profile_row() -> dict[str, Any]:
    return {
        "id": 3,
        "chave": "administrador-interno-geoportal",
        "nome": "Administrador Interno do Geoportal",
        "ativo": True,
        "criado_em": CREATED_AT,
    }


def test_list_internal_admin_profiles_returns_safe_profile_items() -> None:
    engine = FakeEngine([profile_row()])

    response = list_internal_admin_profiles(engine=engine)

    assert response == [
        InternalAdminProfileListItem(
            id=3,
            chave="administrador-interno-geoportal",
            nome="Administrador Interno do Geoportal",
            ativo=True,
            criado_em=CREATED_AT,
        )
    ]
    assert not hasattr(response[0], "permissoes")


def test_list_internal_admin_profiles_uses_safe_sql_and_bind_parameters() -> None:
    engine = FakeEngine()

    list_internal_admin_profiles(limit=100, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert "FROM mod_auth.perfis" in sql
    assert "WHERE ativo = :active" in sql
    assert "ORDER BY lower(nome), lower(chave), id" in sql
    assert "LIMIT :limit" in sql
    assert params == {"active": True, "limit": 100}
    assert "administrador-interno-geoportal" not in sql
    for marker in SENSITIVE_MARKERS:
        assert marker.lower() not in sql.lower()


def test_list_internal_admin_profiles_selects_only_allowed_response_columns() -> None:
    engine = FakeEngine()

    list_internal_admin_profiles(engine=engine)

    sql = sql_for(engine)
    select_clause = sql.split("FROM mod_auth.perfis", maxsplit=1)[0]

    assert "id" in select_clause
    assert "chave" in select_clause
    assert "nome" in select_clause
    assert "ativo" in select_clause
    assert "criado_em" in select_clause
    assert "descricao" not in select_clause
    assert "permissao" not in select_clause
    assert "senha" not in select_clause
    assert "token" not in select_clause


def test_list_internal_admin_profiles_does_not_touch_sensitive_tables_or_write() -> None:
    engine = FakeEngine()

    list_internal_admin_profiles(engine=engine)

    sql = sql_for(engine).lower()
    assert "mod_auth.usuarios" not in sql
    assert "mod_auth.sessoes" not in sql
    assert "login_auditoria" not in sql
    assert "perfil_permissoes" not in sql
    assert "permissoes" not in sql
    assert "insert" not in sql
    assert "update" not in sql
    assert "delete" not in sql


def test_list_internal_admin_profiles_rejects_invalid_limit() -> None:
    engine = FakeEngine()

    try:
        list_internal_admin_profiles(limit=0, engine=engine)
    except ValueError as exc:
        assert str(exc) == "limit must be positive"
    else:
        raise AssertionError("limit=0 should be rejected")

    assert engine.connection.statement is None
