import os
import subprocess
import sys
from io import StringIO
from pathlib import Path
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_profile_repository import (
    AdminPermissionSeed,
    bootstrap_profile_with_existing_permissions,
)
from scripts.admin import bootstrap_internal_authorization_profiles as profile_script


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


def permission_codes(permissions: tuple[AdminPermissionSeed, ...]) -> set[str]:
    return {f"{permission.modulo}.{permission.chave}" for permission in permissions}


def test_script_can_run_from_backend_root_without_external_pythonpath() -> None:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)

    response = subprocess.run(
        [
            sys.executable,
            "scripts/admin/bootstrap_internal_authorization_profiles.py",
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

    response = profile_script.run(
        ["--dry-run"],
        bootstrap_func=lambda **kwargs: calls.__setitem__("bootstrap", 1),
        stdout=output,
    )

    rendered_output = output.getvalue()

    assert response == 0
    assert calls == {"bootstrap": 0}
    assert "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado." in rendered_output
    assert "gestor-consulta-global" in rendered_output
    assert "administrador-modulo-iluminacao" in rendered_output
    assert RAW_PASSWORD not in rendered_output
    assert TOKEN_VALUE not in rendered_output
    assert HASH_VALUE not in rendered_output
    assert SESSION_SECRET not in rendered_output
    assert DATABASE_URL_MARKER not in rendered_output


def test_valid_flow_calls_repository_for_both_profiles() -> None:
    output = StringIO()
    calls: list[dict[str, Any]] = []

    response = profile_script.run(
        [],
        bootstrap_func=lambda **kwargs: calls.append(kwargs),
        stdout=output,
    )

    assert response == 0
    assert [call["perfil_chave"] for call in calls] == [
        "gestor-consulta-global",
        "administrador-modulo-iluminacao",
    ]
    assert calls[0]["permissoes"] == profile_script.GESTOR_CONSULTA_GLOBAL_PERMISSIONS
    assert calls[1]["permissoes"] == profile_script.ILUMINACAO_ADMIN_PERMISSIONS
    assert "concluido com sucesso" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert TOKEN_VALUE not in output.getvalue()


def test_can_bootstrap_single_selected_profile() -> None:
    output = StringIO()
    calls: list[dict[str, Any]] = []

    response = profile_script.run(
        ["--profile", "gestor-consulta-global"],
        bootstrap_func=lambda **kwargs: calls.append(kwargs),
        stdout=output,
    )

    assert response == 0
    assert len(calls) == 1
    assert calls[0]["perfil_chave"] == "gestor-consulta-global"


def test_missing_existing_permission_returns_controlled_error() -> None:
    output = StringIO()

    response = profile_script.run(
        ["--profile", "gestor-consulta-global"],
        bootstrap_func=lambda **kwargs: (_ for _ in ()).throw(
            ValueError("required permission was not found: iluminacao.dashboard.ler")
        ),
        stdout=output,
    )

    rendered_output = output.getvalue()

    assert response == 1
    assert "required permission was not found: iluminacao.dashboard.ler" in rendered_output
    assert "Traceback" not in rendered_output
    assert RAW_PASSWORD not in rendered_output
    assert HASH_VALUE not in rendered_output


def test_gestor_permissions_are_read_only_and_without_admin_permissions() -> None:
    codes = permission_codes(profile_script.GESTOR_CONSULTA_GLOBAL_PERMISSIONS)

    assert codes == {
        "internal.auth.me",
        "iluminacao.dashboard.ler",
        "iluminacao.solicitacoes.ler",
        "iluminacao.solicitacoes.ver_historico",
        "iluminacao.solicitacoes.ver_observacoes",
    }
    assert not any(code.startswith("admin.") for code in codes)
    assert "iluminacao.solicitacoes.comentar" not in codes
    assert "iluminacao.solicitacoes.atualizar_status" not in codes
    assert "iluminacao.solicitacoes.atualizar_prioridade" not in codes
    assert "iluminacao.solicitacoes.corrigir_status" not in codes


def test_iluminacao_admin_permissions_are_module_scoped_without_admin_permissions() -> None:
    codes = permission_codes(profile_script.ILUMINACAO_ADMIN_PERMISSIONS)

    assert codes == {
        "internal.auth.me",
        "iluminacao.dashboard.ler",
        "iluminacao.solicitacoes.ler",
        "iluminacao.solicitacoes.ver_historico",
        "iluminacao.solicitacoes.ver_observacoes",
        "iluminacao.solicitacoes.comentar",
        "iluminacao.solicitacoes.atualizar_status",
        "iluminacao.solicitacoes.atualizar_prioridade",
        "iluminacao.solicitacoes.corrigir_status",
    }
    assert not any(code.startswith("admin.") for code in codes)


def test_profile_names_and_keys_are_expected() -> None:
    assert profile_script.GESTOR_PROFILE_KEY == "gestor-consulta-global"
    assert profile_script.ILUMINACAO_ADMIN_PROFILE_KEY == "administrador-modulo-iluminacao"
    assert profile_script.PROFILE_PLANS["gestor-consulta-global"].name == (
        "Gestor - Consulta Global"
    )
    assert profile_script.PROFILE_PLANS["administrador-modulo-iluminacao"].name == (
        "Administrador do Modulo - Iluminacao Publica"
    )


def test_bootstrap_with_existing_permissions_is_idempotent() -> None:
    permission_rows = [{"id": index, "ativo": True} for index in range(101, 106)]
    profile_permission_rows = [{"exists": 1} for _ in range(5)]
    rows: list[dict[str, Any] | None] = [
        *permission_rows,
        {"id": 40, "ativo": True},
        *profile_permission_rows,
    ]
    engine = FakeEngine(rows)

    response = bootstrap_profile_with_existing_permissions(
        perfil_chave=profile_script.GESTOR_PROFILE_KEY,
        perfil_nome=profile_script.GESTOR_PROFILE_NAME,
        perfil_descricao=profile_script.GESTOR_PROFILE_DESCRIPTION,
        permissoes=profile_script.GESTOR_CONSULTA_GLOBAL_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)

    assert response.perfil_id == 40
    assert response.permissao_ids == tuple(range(101, 106))
    assert response.perfil_permissoes_criadas == 0
    assert "INSERT INTO" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_bootstrap_creates_profile_and_links_without_creating_permissions_or_users() -> None:
    permission_rows = [{"id": index, "ativo": True} for index in range(201, 210)]
    rows: list[dict[str, Any] | None] = [
        *permission_rows,
        None,
        {"id": 50},
        *(None for _ in range(9)),
    ]
    engine = FakeEngine(rows)

    response = bootstrap_profile_with_existing_permissions(
        perfil_chave=profile_script.ILUMINACAO_ADMIN_PROFILE_KEY,
        perfil_nome=profile_script.ILUMINACAO_ADMIN_PROFILE_NAME,
        perfil_descricao=profile_script.ILUMINACAO_ADMIN_PROFILE_DESCRIPTION,
        permissoes=profile_script.ILUMINACAO_ADMIN_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)

    assert response.perfil_id == 50
    assert response.permissao_ids == tuple(range(201, 210))
    assert response.perfil_permissoes_criadas == 9
    assert "INSERT INTO mod_auth.perfis" in sql
    assert "INSERT INTO mod_auth.perfil_permissoes" in sql
    assert "INSERT INTO mod_auth.permissoes" not in sql
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_bootstrap_fails_clearly_when_required_permission_does_not_exist() -> None:
    rows: list[dict[str, Any] | None] = [
        {"id": 101, "ativo": True},
        None,
    ]
    engine = FakeEngine(rows)

    try:
        bootstrap_profile_with_existing_permissions(
            perfil_chave=profile_script.GESTOR_PROFILE_KEY,
            perfil_nome=profile_script.GESTOR_PROFILE_NAME,
            perfil_descricao=profile_script.GESTOR_PROFILE_DESCRIPTION,
            permissoes=profile_script.GESTOR_CONSULTA_GLOBAL_PERMISSIONS,
            engine=engine,
        )
    except ValueError as exc:
        assert str(exc) == (
            "required permission was not found: iluminacao.dashboard.ler"
        )
    else:
        raise AssertionError("missing permission should fail clearly")

    sql = sql_history(engine)
    assert "INSERT INTO mod_auth.permissoes" not in sql
    assert "INSERT INTO mod_auth.perfis" not in sql
    assert "INSERT INTO mod_auth.perfil_permissoes" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_permission_seed_values_are_not_sensitive() -> None:
    for permission in (
        *profile_script.GESTOR_CONSULTA_GLOBAL_PERMISSIONS,
        *profile_script.ILUMINACAO_ADMIN_PERMISSIONS,
    ):
        assert isinstance(permission, AdminPermissionSeed)
        rendered = f"{permission.modulo}.{permission.chave} {permission.descricao}"
        assert RAW_PASSWORD not in rendered
        assert TOKEN_VALUE not in rendered
        assert HASH_VALUE not in rendered
        assert SESSION_SECRET not in rendered
        assert DATABASE_URL_MARKER not in rendered