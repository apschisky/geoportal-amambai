from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_permission_repository import (
    get_effective_permissions_for_user,
)


PERMISSION_ROWS = [
    {"permissao": "admin.usuarios.ler"},
    {"permissao": "admin.usuarios.ler"},
    {"permissao": "iluminacao.solicitacoes.ler"},
]
RAW_TOKEN = "token-bruto-ficticio"
SESSION_SECRET = "segredo-ficticio"
DATABASE_CONFIG_MARKER = "database-config-ficticia"


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
        self.rows = rows if rows is not None else PERMISSION_ROWS

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


def test_get_effective_permissions_returns_unique_permission_codes() -> None:
    engine = FakeEngine()

    response = get_effective_permissions_for_user(usuario_id=7, engine=engine)

    assert response == {
        "admin.usuarios.ler",
        "iluminacao.solicitacoes.ler",
    }


def test_get_effective_permissions_uses_bind_params_and_active_filters() -> None:
    engine = FakeEngine()

    get_effective_permissions_for_user(usuario_id=7, engine=engine)

    sql = sql_for(engine)
    params = params_for(engine)

    assert "SELECT DISTINCT" in sql
    assert "lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave))" in sql
    assert "FROM mod_auth.usuario_perfis up" in sql
    assert "INNER JOIN mod_auth.perfis pf" in sql
    assert "INNER JOIN mod_auth.perfil_permissoes pp" in sql
    assert "INNER JOIN mod_auth.permissoes p" in sql
    assert "up.usuario_id = :usuario_id" in sql
    assert "up.ativo IS true" in sql
    assert "pf.ativo IS true" in sql
    assert "p.ativo IS true" in sql
    assert params == {"usuario_id": 7}


def test_get_effective_permissions_does_not_interpolate_user_or_sensitive_values() -> None:
    engine = FakeEngine()

    get_effective_permissions_for_user(usuario_id=7, engine=engine)

    sql = sql_for(engine)

    assert " 7" not in sql
    assert "admin.homologacao" not in sql
    assert RAW_TOKEN not in sql
    assert SESSION_SECRET not in sql
    assert DATABASE_CONFIG_MARKER not in sql
    assert "senha" not in sql.lower()
    assert "token_hash" not in sql.lower()
