import os
import subprocess
import sys
from io import StringIO
from pathlib import Path
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_profile_repository import (
    AdminPermissionSeed,
    bootstrap_internal_admin_profile,
)
from scripts.admin import bootstrap_internal_maintenance_profile as maintenance_script


BACKEND_ROOT = Path(__file__).resolve().parents[1]
RAW_PASSWORD = "senha-ficticia-nao-usada"
TOKEN_VALUE = "token-ficticio-nao-usado"
HASH_VALUE = "hash-ficticio-nao-usado"
SESSION_SECRET = "segredo-ficticio-nao-usado"
DATABASE_URL_MARKER = "database-url-ficticia-nao-usada"


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(self, rows: list[dict[str, Any] | None] | None = None) -> None:
        self.rows = list(rows or [])
        self.statements: list[TextClause] = []
        self.params: list[dict[str, Any]] = []

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statements.append(statement)
        self.params.append(params)
        row = self.rows.pop(0) if self.rows else None
        return FakeResult(row)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(self, rows: list[dict[str, Any] | None] | None = None) -> None:
        self.connection = FakeConnection(rows)
        self.begin_count = 0

    def begin(self) -> FakeBegin:
        self.begin_count += 1
        return FakeBegin(self.connection)


def sql_history(engine: FakeEngine) -> str:
    return "\n".join(str(statement) for statement in engine.connection.statements)


def test_script_can_run_from_backend_root_without_external_pythonpath() -> None:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)

    response = subprocess.run(
        [
            sys.executable,
            "scripts/admin/bootstrap_internal_maintenance_profile.py",
            "--help",
        ],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    combined_output = f"{response.stdout}\n{response.stderr}"
    assert response.returncode == 0
    assert "ModuleNotFoundError" not in combined_output
    assert "No module named 'app'" not in combined_output
    assert "--password" not in combined_output
    assert RAW_PASSWORD not in combined_output
    assert HASH_VALUE not in combined_output


def test_dry_run_does_not_call_repository_or_persist() -> None:
    output = StringIO()
    calls = {"bootstrap": 0}

    response = maintenance_script.run(
        ["--login", " Manutencao.Homologacao ", "--dry-run"],
        bootstrap_func=lambda **kwargs: calls.__setitem__("bootstrap", 1),
        stdout=output,
    )

    rendered_output = output.getvalue()

    assert response == 0
    assert calls == {"bootstrap": 0}
    assert "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado." in rendered_output
    assert "manutencao-iluminacao" in rendered_output
    assert "manutencao.homologacao" in rendered_output
    assert RAW_PASSWORD not in rendered_output
    assert TOKEN_VALUE not in rendered_output
    assert HASH_VALUE not in rendered_output
    assert SESSION_SECRET not in rendered_output
    assert DATABASE_URL_MARKER not in rendered_output


def test_missing_user_returns_controlled_error() -> None:
    output = StringIO()

    response = maintenance_script.run(
        ["--login", "usuario.inexistente"],
        bootstrap_func=lambda **kwargs: (_ for _ in ()).throw(
            ValueError("internal user was not found")
        ),
        stdout=output,
    )

    rendered_output = output.getvalue()

    assert response == 1
    assert "usuario interno nao encontrado" in rendered_output
    assert "Traceback" not in rendered_output
    assert RAW_PASSWORD not in rendered_output
    assert HASH_VALUE not in rendered_output


def test_valid_flow_calls_repository_with_normalized_login_and_seed_data() -> None:
    output = StringIO()
    bootstrap_kwargs: dict[str, Any] = {}

    response = maintenance_script.run(
        ["--login", " Manutencao.Homologacao "],
        bootstrap_func=lambda **kwargs: bootstrap_kwargs.update(kwargs),
        stdout=output,
    )

    assert response == 0
    assert bootstrap_kwargs["login"] == "manutencao.homologacao"
    assert bootstrap_kwargs["perfil_chave"] == "manutencao-iluminacao"
    assert bootstrap_kwargs["perfil_nome"] == "Manutencao - Iluminacao Publica"
    assert bootstrap_kwargs["permissoes"] == maintenance_script.MAINTENANCE_PERMISSIONS
    assert "Bootstrap do perfil operacional de manutencao concluido" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert HASH_VALUE not in output.getvalue()
    assert TOKEN_VALUE not in output.getvalue()


def test_maintenance_permissions_are_minimal_and_do_not_include_admin_or_priority() -> None:
    permission_codes = {
        f"{permission.modulo}.{permission.chave}"
        for permission in maintenance_script.MAINTENANCE_PERMISSIONS
    }

    assert permission_codes == {
        "internal.auth.me",
        "iluminacao.solicitacoes.ler",
        "iluminacao.solicitacoes.ver_observacoes",
        "iluminacao.solicitacoes.ver_dados_contato",
        "iluminacao.solicitacoes.comentar",
        "iluminacao.solicitacoes.atualizar_status",
    }
    assert not any(permission.startswith("admin.") for permission in permission_codes)
    assert "iluminacao.solicitacoes.atualizar_prioridade" not in permission_codes
    assert "iluminacao.solicitacoes.corrigir_status" not in permission_codes


def test_script_rejects_password_cli_argument_without_printing_it() -> None:
    output = StringIO()

    response = maintenance_script.run(
        ["--login", "manutencao.homologacao", "--password", RAW_PASSWORD],
        stdout=output,
    )

    assert response == 2
    assert "linha de comando" in output.getvalue()
    assert "--password" not in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()


def test_bootstrap_is_idempotent_when_records_already_exist() -> None:
    permission_rows = [{"id": index, "ativo": True} for index in range(101, 107)]
    profile_permission_rows = [{"exists": 1} for _ in range(6)]
    rows: list[dict[str, Any] | None] = [
        {"id": 8},
        *permission_rows,
        {"id": 30, "ativo": True},
        *profile_permission_rows,
        {"ativo": True},
    ]
    engine = FakeEngine(rows)

    response = bootstrap_internal_admin_profile(
        login="manutencao.homologacao",
        perfil_chave=maintenance_script.PROFILE_KEY,
        perfil_nome=maintenance_script.PROFILE_NAME,
        perfil_descricao=maintenance_script.PROFILE_DESCRIPTION,
        permissoes=maintenance_script.MAINTENANCE_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)

    assert response.usuario_id == 8
    assert response.perfil_id == 30
    assert response.permissao_ids == tuple(range(101, 107))
    assert response.perfil_permissoes_criadas == 0
    assert response.usuario_perfil_criado is False
    assert "INSERT INTO" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_maintenance_permission_seed_values_are_not_sensitive() -> None:
    for permission in maintenance_script.MAINTENANCE_PERMISSIONS:
        assert isinstance(permission, AdminPermissionSeed)
        rendered = f"{permission.modulo}.{permission.chave} {permission.descricao}"
        assert RAW_PASSWORD not in rendered
        assert TOKEN_VALUE not in rendered
        assert HASH_VALUE not in rendered
        assert SESSION_SECRET not in rendered
        assert DATABASE_URL_MARKER not in rendered
