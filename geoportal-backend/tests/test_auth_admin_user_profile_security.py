from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_audit_repository import AdminAuditContext
from app.repositories.auth_admin_security_repository import (
    AdministrativeSecurityDeniedError,
)
from app.repositories.auth_admin_security_repository import (
    deactivate_internal_user_profile_audited,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkInactiveConflictError,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkNotFoundError,
)


CREATED_AT = datetime(2026, 6, 25, 10, 0, tzinfo=UTC)
AUDIT_CONTEXT = AdminAuditContext(ator_usuario_id=7, ator_login="admin.teste")


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
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
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(
        self,
        exc_type: object,
        exc_value: object,
        traceback: object,
    ) -> None:
        self.connection.committed = exc_type is None
        self.connection.rolled_back = exc_type is not None


class FakeEngine:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.connection = FakeConnection(rows)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def profile_link_row(
    *,
    usuario_id: int = 8,
    modulo: str | None = None,
    ativo: bool = True,
) -> dict[str, Any]:
    return {
        "usuario_id": usuario_id,
        "perfil_id": 3,
        "chave": "administrador-interno-geoportal",
        "nome": "Administrador Interno",
        "modulo": modulo,
        "ativo": ativo,
        "criado_em": CREATED_AT,
    }


def sql_history(engine: FakeEngine) -> str:
    return "\n".join(str(statement) for statement in engine.connection.statements)


def test_self_profile_deactivation_is_denied_and_persisted() -> None:
    engine = FakeEngine([None, profile_link_row(usuario_id=7), None])

    with pytest.raises(AdministrativeSecurityDeniedError):
        deactivate_internal_user_profile_audited(
            usuario_id=7,
            perfil_id=3,
            modulo=None,
            justificativa="Remocao administrativa controlada.",
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    assert "UPDATE mod_auth.usuario_perfis" not in sql_history(engine)
    assert engine.connection.params[-1]["acao"] == (
        "admin.security.denied_self_demotion"
    )
    assert engine.connection.params[-1]["motivo"] == "self_demotion"
    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False


def test_last_effective_admin_profile_deactivation_is_denied() -> None:
    engine = FakeEngine(
        [None, profile_link_row(), {"exists": 1}, {"total": 0}, None]
    )

    with pytest.raises(AdministrativeSecurityDeniedError):
        deactivate_internal_user_profile_audited(
            usuario_id=8,
            perfil_id=3,
            modulo=None,
            justificativa="Remocao administrativa controlada.",
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    sql = sql_history(engine)
    assert "pg_advisory_xact_lock" in sql
    assert "AND NOT" in sql
    assert "UPDATE mod_auth.usuario_perfis" not in sql
    assert engine.connection.params[-1]["acao"] == (
        "admin.security.denied_last_admin_removal"
    )
    assert engine.connection.params[-1]["motivo"] == "last_effective_admin"
    assert engine.connection.committed is True


def test_same_user_remains_admin_through_another_critical_profile() -> None:
    engine = FakeEngine(
        [
            None,
            profile_link_row(),
            {"exists": 1},
            {"total": 1},
            profile_link_row(ativo=False),
            None,
        ]
    )

    result = deactivate_internal_user_profile_audited(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        justificativa="Remocao preserva outro perfil critico do usuario.",
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    count_statement = next(
        str(statement)
        for statement in engine.connection.statements
        if "count(DISTINCT u.id) AS total" in str(statement)
    )
    assert result.ativo is False
    assert "up.usuario_id = :usuario_id" in count_statement
    assert "up.perfil_id = :perfil_id" in count_statement
    assert "UPDATE mod_auth.usuario_perfis" in sql_history(engine)
    assert engine.connection.params[-1]["acao"] == "admin.user.remove_profile"
    assert engine.connection.committed is True


@pytest.mark.parametrize("remaining_admins", [1, 2])
def test_deactivation_is_allowed_when_admin_capability_remains(
    remaining_admins: int,
) -> None:
    engine = FakeEngine(
        [
            None,
            profile_link_row(),
            {"exists": 1},
            {"total": remaining_admins},
            profile_link_row(ativo=False),
            None,
        ]
    )

    result = deactivate_internal_user_profile_audited(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        justificativa="Remocao administrativa controlada.",
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    sql = sql_history(engine)
    update_sql = next(
        str(statement)
        for statement in engine.connection.statements
        if "UPDATE mod_auth.usuario_perfis" in str(statement)
    )
    assert result.ativo is False
    assert "SET ativo = false" in update_sql
    assert "DELETE" not in sql.upper()
    assert "SET modulo" not in update_sql
    assert "SET perfil_id" not in update_sql
    assert "SET usuario_id" not in update_sql
    assert engine.connection.params[-1]["acao"] == "admin.user.remove_profile"
    assert engine.connection.params[-1]["justificativa"] == (
        "Remocao administrativa controlada."
    )
    assert engine.connection.committed is True


def test_module_scoped_deactivation_uses_module_filter() -> None:
    engine = FakeEngine(
        [
            None,
            profile_link_row(modulo="iluminacao"),
            None,
            profile_link_row(modulo="iluminacao", ativo=False),
            None,
        ]
    )

    result = deactivate_internal_user_profile_audited(
        usuario_id=8,
        perfil_id=3,
        modulo="iluminacao",
        justificativa="Remocao administrativa por modulo.",
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    assert result.modulo == "iluminacao"
    assert "lower(up.modulo) = lower(:modulo)" in sql_history(engine)


def test_missing_profile_link_returns_not_found_without_update() -> None:
    engine = FakeEngine([None, None])

    with pytest.raises(InternalUserProfileLinkNotFoundError):
        deactivate_internal_user_profile_audited(
            usuario_id=8,
            perfil_id=999,
            modulo=None,
            justificativa="Remocao administrativa controlada.",
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    assert "UPDATE mod_auth.usuario_perfis" not in sql_history(engine)
    assert engine.connection.rolled_back is True


def test_inactive_profile_link_returns_conflict_without_update() -> None:
    engine = FakeEngine([None, profile_link_row(ativo=False)])

    with pytest.raises(InternalUserProfileLinkInactiveConflictError):
        deactivate_internal_user_profile_audited(
            usuario_id=8,
            perfil_id=3,
            modulo=None,
            justificativa="Remocao administrativa controlada.",
            audit_context=AUDIT_CONTEXT,
            engine=engine,
        )

    assert "UPDATE mod_auth.usuario_perfis" not in sql_history(engine)
    assert engine.connection.rolled_back is True


def test_audit_event_does_not_contain_sensitive_payload() -> None:
    engine = FakeEngine(
        [
            None,
            profile_link_row(),
            None,
            profile_link_row(ativo=False),
            None,
        ]
    )

    deactivate_internal_user_profile_audited(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        justificativa="Remocao administrativa autorizada.",
        audit_context=AUDIT_CONTEXT,
        engine=engine,
    )

    serialized = str(engine.connection.params[-1]).lower()
    for forbidden in ("senha", "hash", "token", "cookie", "database_url"):
        assert forbidden not in serialized
