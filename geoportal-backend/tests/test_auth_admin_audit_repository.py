from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_audit_repository import AdminAuditContext
from app.repositories.auth_admin_audit_repository import record_admin_audit_event
from app.repositories.auth_admin_audit_repository import sanitize_admin_audit_text


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MIGRATION_PATH = (
    BACKEND_ROOT
    / "db"
    / "migrations"
    / "0011_create_mod_auth_admin_auditoria.sql"
)
ROLLBACK_PATH = (
    BACKEND_ROOT
    / "db"
    / "rollbacks"
    / "0011_drop_mod_auth_admin_auditoria.sql"
)


class FakeResult:
    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> None:
        return None


class FakeConnection:
    def __init__(self) -> None:
        self.statements: list[TextClause] = []
        self.params: list[dict[str, Any]] = []

    def execute(
        self,
        statement: TextClause,
        params: dict[str, Any],
    ) -> FakeResult:
        self.statements.append(statement)
        self.params.append(params)
        return FakeResult()


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class FakeEngine:
    def __init__(self) -> None:
        self.connection = FakeConnection()

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def test_admin_audit_migration_creates_append_only_structure() -> None:
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    rollback = ROLLBACK_PATH.read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS mod_auth.admin_auditoria" in migration
    assert "ator_usuario_id bigint NOT NULL" in migration
    assert "resultado IN ('sucesso', 'negada', 'erro_validacao')" in migration
    assert "senha_hash" not in migration
    assert "token_hash" not in migration
    assert "session_secret" not in migration.lower()
    assert "UPDATE mod_auth.admin_auditoria" not in migration
    assert "DELETE FROM mod_auth.admin_auditoria" not in migration
    assert "DROP TABLE IF EXISTS mod_auth.admin_auditoria" in rollback


def test_record_admin_audit_event_uses_insert_and_sanitized_params() -> None:
    engine = FakeEngine()

    record_admin_audit_event(
        context=AdminAuditContext(
            ator_usuario_id=7,
            ator_login=" admin.teste ",
            origem=" api_internal ",
            request_id=" request-123 ",
        ),
        acao=" admin.user.create ",
        entidade_tipo=" usuario ",
        entidade_id=8,
        resultado=" SUCESSO ",
        resumo=" Usuario criado. ",
        engine=engine,
    )

    sql = str(engine.connection.statements[0])
    params = engine.connection.params[0]
    assert "INSERT INTO mod_auth.admin_auditoria" in sql
    assert "UPDATE " not in sql.upper()
    assert "DELETE " not in sql.upper()
    assert params == {
        "ator_usuario_id": 7,
        "ator_login": "admin.teste",
        "acao": "admin.user.create",
        "entidade_tipo": "usuario",
        "entidade_id": "8",
        "resultado": "sucesso",
        "motivo": None,
        "resumo": "Usuario criado.",
        "justificativa": None,
        "origem": "api_internal",
        "request_id": "request-123",
    }


@pytest.mark.parametrize(
    "sensitive_value",
    [
        "senha=segredo-ficticio",
        "password=segredo-ficticio",
        "token=token-ficticio",
        "cookie=cookie-ficticio",
        "senha_hash=hash-ficticio",
        "session_secret=segredo-ficticio",
        "DATABASE_URL=valor-ficticio",
    ],
)
def test_admin_audit_sanitizer_redacts_sensitive_text(
    sensitive_value: str,
) -> None:
    assert (
        sanitize_admin_audit_text(sensitive_value, max_length=1000)
        == "[redacted]"
    )


def test_admin_audit_rejects_invalid_result_without_sql() -> None:
    engine = FakeEngine()

    with pytest.raises(ValueError, match="resultado is invalid"):
        record_admin_audit_event(
            context=AdminAuditContext(
                ator_usuario_id=7,
                ator_login="admin.teste",
            ),
            acao="admin.user.create",
            entidade_tipo="usuario",
            entidade_id=8,
            resultado="desconhecido",
            engine=engine,
        )

    assert engine.connection.statements == []


def test_admin_audit_preserves_controlled_reset_password_action() -> None:
    engine = FakeEngine()

    record_admin_audit_event(
        context=AdminAuditContext(
            ator_usuario_id=7,
            ator_login='admin.teste',
        ),
        acao='admin.user.reset_password',
        entidade_tipo='usuario',
        entidade_id=8,
        resultado='sucesso',
        resumo='Senha redefinida sem registrar seu valor.',
        engine=engine,
    )

    assert engine.connection.params[0]['acao'] == 'admin.user.reset_password'
    assert engine.connection.params[0]['resumo'] == '[redacted]'
