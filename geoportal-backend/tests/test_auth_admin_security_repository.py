from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_audit_repository import AdminAuditContext
from app.repositories.auth_admin_security_repository import (
    AdministrativeSecurityDeniedError,
)
from app.repositories.auth_admin_security_repository import (
    assign_internal_user_profile_audited,
)
from app.repositories.auth_admin_security_repository import (
    block_internal_user_audited,
)
from app.repositories.auth_admin_security_repository import (
    ensure_admin_capability_removal_allowed_with_connection,
)


CREATED_AT = datetime(2026, 6, 24, 10, 0, tzinfo=UTC)
AUDIT_CONTEXT = AdminAuditContext(
    ator_usuario_id=7,
    ator_login="admin.teste",
)


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class SequentialFakeConnection:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.rows = list(rows)
        self.statements: list[TextClause] = []
        self.params: list[dict[str, Any]] = []
        self.committed = False
        self.rolled_back = False

    def execute(
        self,
        statement: TextClause,
        params: dict[str, Any],
    ) -> FakeResult:
        self.statements.append(statement)
        self.params.append(params)
        row = self.rows.pop(0) if self.rows else None
        return FakeResult(row)


class FakeBegin:
    def __init__(self, connection: SequentialFakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> SequentialFakeConnection:
        return self.connection

    def __exit__(
        self,
        exc_type: object,
        exc_value: object,
        traceback: object,
    ) -> None:
        self.connection.committed = exc_type is None
        self.connection.rolled_back = exc_type is not None
        return None


class SequentialFakeEngine:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.connection = SequentialFakeConnection(rows)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_history(connection: SequentialFakeConnection) -> str:
    return "\n".join(str(statement) for statement in connection.statements)


def block_row() -> dict[str, Any]:
    return {
        "id": 8,
        "login": "admin.alvo",
        "nome": "Administrador Alvo",
        "email": None,
        "ativo": True,
        "bloqueado": True,
        "criado_em": CREATED_AT,
    }


def assert_safe_denied_event(params: dict[str, Any]) -> None:
    assert params['resultado'] == 'negada'
    serialized = str(params).lower()
    for forbidden in (
        'senha-ficticia',
        'token-ficticio',
        'cookie-ficticio',
        'hash-ficticio',
        'session_secret',
        'database_url',
    ):
        assert forbidden not in serialized


def test_last_effective_admin_block_is_denied_and_audited() -> None:
    engine = SequentialFakeEngine(
        [
            None,
            {"exists": 1},
            {"total": 1},
            None,
        ]
    )

    with pytest.raises(AdministrativeSecurityDeniedError):
        block_internal_user_audited(
            usuario_id=8,
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    sql = sql_history(engine.connection)
    assert "pg_advisory_xact_lock" in sql
    assert "count(DISTINCT u.id)" in sql
    assert "INSERT INTO mod_auth.admin_auditoria" in sql
    assert "UPDATE mod_auth.usuarios" not in sql
    assert engine.connection.params[-1]["acao"] == (
        "admin.security.denied_last_admin_disable"
    )
    assert engine.connection.params[-1]["resultado"] == "negada"


    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False


    assert_safe_denied_event(engine.connection.params[-1])


def test_actor_cannot_block_own_account() -> None:
    engine = SequentialFakeEngine([None])

    with pytest.raises(AdministrativeSecurityDeniedError):
        block_internal_user_audited(
            usuario_id=7,
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    sql = sql_history(engine.connection)
    assert 'INSERT INTO mod_auth.admin_auditoria' in sql
    assert 'UPDATE mod_auth.usuarios' not in sql
    assert engine.connection.params[-1]['acao'] == (
        'admin.security.denied_self_change'
    )


    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False


    assert_safe_denied_event(engine.connection.params[-1])


def test_block_is_allowed_when_another_effective_admin_exists() -> None:
    engine = SequentialFakeEngine(
        [
            None,
            {"exists": 1},
            {"total": 2},
            block_row(),
            None,
        ]
    )

    result = block_internal_user_audited(
        usuario_id=8,
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    sql = sql_history(engine.connection)
    assert result.bloqueado is True
    assert "UPDATE mod_auth.usuarios" in sql
    assert "UPDATE mod_auth.sessoes" in sql
    assert "INSERT INTO mod_auth.admin_auditoria" in sql
    assert engine.connection.params[-1]["acao"] == "admin.user.disable"
    assert engine.connection.params[-1]["resultado"] == "sucesso"


    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False


def test_non_admin_user_does_not_require_effective_admin_count() -> None:
    connection = SequentialFakeConnection([None, None])

    allowed = ensure_admin_capability_removal_allowed_with_connection(
        connection,
        target_usuario_id=8,
    )

    assert allowed is True
    sql = sql_history(connection)
    assert "pg_advisory_xact_lock" in sql
    assert "count(DISTINCT u.id)" not in sql


def test_self_assignment_of_critical_profile_is_denied_and_audited() -> None:
    engine = SequentialFakeEngine(
        [
            None,
            {"id": 7},
            {"id": 3},
            None,
            {"exists": 1},
            None,
        ]
    )

    with pytest.raises(AdministrativeSecurityDeniedError):
        assign_internal_user_profile_audited(
            usuario_id=7,
            perfil_id=3,
            modulo=None,
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    sql = sql_history(engine.connection)
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql
    assert "INSERT INTO mod_auth.admin_auditoria" in sql
    assert engine.connection.params[-1]["acao"] == (
        "admin.security.denied_self_elevation"
    )
    assert engine.connection.params[-1]["resultado"] == "negada"


    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False


    assert_safe_denied_event(engine.connection.params[-1])


def test_assignment_to_another_user_is_allowed_and_audited() -> None:
    engine = SequentialFakeEngine(
        [
            None,
            {"id": 8},
            {"id": 3},
            None,
            {
                "usuario_id": 8,
                "perfil_id": 3,
                "modulo": None,
                "ativo": True,
            },
            None,
        ]
    )

    result = assign_internal_user_profile_audited(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    sql = sql_history(engine.connection)
    assert result.created is True
    assert "INSERT INTO mod_auth.usuario_perfis" in sql
    assert "INSERT INTO mod_auth.admin_auditoria" in sql
    assert engine.connection.params[-1]["acao"] == "admin.user.assign_profile"
