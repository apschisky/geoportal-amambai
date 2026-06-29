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
    ensure_permission,
    ensure_profile,
    ensure_profile_permission,
    ensure_user_profile,
    get_user_id_by_login,
)
from scripts.admin import bootstrap_internal_admin_profile as bootstrap_script


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


def params_history(engine: FakeEngine) -> list[dict[str, Any]]:
    return engine.connection.params


def test_script_can_run_from_backend_root_without_external_pythonpath() -> None:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)

    response = subprocess.run(
        [
            sys.executable,
            "scripts/admin/bootstrap_internal_admin_profile.py",
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

    response = bootstrap_script.run(
        ["--login", " Admin.Homologacao ", "--dry-run"],
        bootstrap_func=lambda **kwargs: calls.__setitem__("bootstrap", 1),
        stdout=output,
    )

    assert response == 0
    assert calls == {"bootstrap": 0}
    assert "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado." in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert TOKEN_VALUE not in output.getvalue()
    assert HASH_VALUE not in output.getvalue()
    assert SESSION_SECRET not in output.getvalue()
    assert DATABASE_URL_MARKER not in output.getvalue()


def test_empty_login_is_rejected_without_repository() -> None:
    output = StringIO()
    calls = {"bootstrap": 0}

    response = bootstrap_script.run(
        ["--login", "   "],
        bootstrap_func=lambda **kwargs: calls.__setitem__("bootstrap", 1),
        stdout=output,
    )

    assert response == 1
    assert calls == {"bootstrap": 0}
    assert "login nao pode ser vazio" in output.getvalue()


def test_missing_user_returns_controlled_error() -> None:
    output = StringIO()

    response = bootstrap_script.run(
        ["--login", "usuario.inexistente"],
        bootstrap_func=lambda **kwargs: (_ for _ in ()).throw(
            ValueError("internal user was not found")
        ),
        stdout=output,
    )

    assert response == 1
    assert "usuario interno nao encontrado" in output.getvalue()
    assert "Traceback" not in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert HASH_VALUE not in output.getvalue()


def test_valid_flow_calls_repository_with_normalized_login_and_seed_data() -> None:
    output = StringIO()
    bootstrap_kwargs: dict[str, Any] = {}

    response = bootstrap_script.run(
        ["--login", " Admin.Homologacao "],
        bootstrap_func=lambda **kwargs: bootstrap_kwargs.update(kwargs),
        stdout=output,
    )

    assert response == 0
    assert bootstrap_kwargs["login"] == "admin.homologacao"
    assert bootstrap_kwargs["perfil_chave"] == "administrador-interno-geoportal"
    assert bootstrap_kwargs["perfil_nome"] == "Administrador Interno do Geoportal"
    assert bootstrap_kwargs["permissoes"] == bootstrap_script.INITIAL_ADMIN_PERMISSIONS
    assert "Bootstrap do perfil administrativo interno concluido com sucesso." in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert HASH_VALUE not in output.getvalue()
    assert TOKEN_VALUE not in output.getvalue()


def test_initial_admin_permissions_are_complete() -> None:
    permission_codes = {
        f"{permission.modulo}.{permission.chave}"
        for permission in bootstrap_script.INITIAL_ADMIN_PERMISSIONS
    }

    assert permission_codes == {
        'admin.usuarios.remover_perfis',
        "admin.usuarios.ler",
        "admin.usuarios.criar",
        "admin.usuarios.bloquear",
        "admin.usuarios.redefinir_senha",
        "admin.usuarios.atribuir_perfis",
        "admin.perfis.ler",
        "admin.perfis.gerenciar",
        "admin.permissoes.ler",
        "admin.permissoes.gerenciar",
        "internal.auth.me",
        "iluminacao.dashboard.ler",
        "iluminacao.solicitacoes.corrigir_status",
    }


def test_script_rejects_password_cli_argument_without_printing_it() -> None:
    output = StringIO()

    response = bootstrap_script.run(
        ["--login", "admin.homologacao", "--password", RAW_PASSWORD],
        stdout=output,
    )

    assert response == 2
    assert "linha de comando" in output.getvalue()
    assert "--password" not in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()


def test_script_does_not_import_fastapi_or_create_endpoint() -> None:
    assert "fastapi" not in bootstrap_script.__dict__
    assert not hasattr(bootstrap_script, "router")
    assert not hasattr(bootstrap_script, "app")


def test_get_user_id_by_login_uses_bind_parameters() -> None:
    engine = FakeEngine([{"id": 7}])

    response = get_user_id_by_login(login=" Admin.Homologacao ", engine=engine)

    sql = sql_history(engine)
    params = params_history(engine)

    assert response == 7
    assert "FROM mod_auth.usuarios" in sql
    assert "lower(login) = lower(:login)" in sql
    assert params == [{"login": "admin.homologacao"}]
    assert "admin.homologacao" not in sql
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql
    assert DATABASE_URL_MARKER not in sql


def test_ensure_permission_uses_bind_parameters_and_does_not_interpolate_values() -> None:
    engine = FakeEngine([None, {"id": 10}])

    response = ensure_permission(
        modulo="Admin",
        chave="Usuarios.Ler",
        descricao="Permissao de teste",
        engine=engine,
    )

    sql = sql_history(engine)
    params = params_history(engine)

    assert response == 10
    assert "SELECT id, ativo" in sql
    assert "FROM mod_auth.permissoes" in sql
    assert "INSERT INTO mod_auth.permissoes" in sql
    assert "lower(modulo) = lower(:modulo)" in sql
    assert "lower(chave) = lower(:chave)" in sql
    assert ":descricao" in sql
    assert params[-1] == {
        "modulo": "admin",
        "chave": "usuarios.ler",
        "descricao": "Permissao de teste",
    }
    assert "Usuarios.Ler" not in sql
    assert "Permissao de teste" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_ensure_profile_uses_bind_parameters_and_does_not_interpolate_values() -> None:
    engine = FakeEngine([None, {"id": 20}])

    response = ensure_profile(
        chave="Administrador-Interno-Geoportal",
        nome="Administrador Interno do Geoportal",
        descricao="Perfil de teste",
        engine=engine,
    )

    sql = sql_history(engine)
    params = params_history(engine)

    assert response == 20
    assert "FROM mod_auth.perfis" in sql
    assert "INSERT INTO mod_auth.perfis" in sql
    assert "lower(chave) = lower(:chave)" in sql
    assert params[-1] == {
        "chave": "administrador-interno-geoportal",
        "nome": "Administrador Interno do Geoportal",
        "descricao": "Perfil de teste",
    }
    assert "Administrador Interno do Geoportal" not in sql
    assert "Perfil de teste" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_link_repositories_are_idempotent_with_bind_parameters() -> None:
    profile_permission_engine = FakeEngine([{"exists": 1}])
    user_profile_engine = FakeEngine([{"ativo": True}])

    profile_permission_created = ensure_profile_permission(
        perfil_id=20,
        permissao_id=10,
        engine=profile_permission_engine,
    )
    user_profile_created = ensure_user_profile(
        usuario_id=7,
        perfil_id=20,
        engine=user_profile_engine,
    )

    combined_sql = "\n".join(
        [sql_history(profile_permission_engine), sql_history(user_profile_engine)]
    )

    assert profile_permission_created is False
    assert user_profile_created is False
    assert "perfil_id = :perfil_id" in combined_sql
    assert "permissao_id = :permissao_id" in combined_sql
    assert "usuario_id = :usuario_id" in combined_sql
    assert "INSERT INTO" not in combined_sql
    assert "DELETE" not in combined_sql.upper()
    assert "UPDATE" not in combined_sql.upper()


def test_bootstrap_is_idempotent_when_records_already_exist() -> None:
    permission_rows = [{"id": index, "ativo": True} for index in range(101, 114)]
    profile_permission_rows = [{"exists": 1} for _ in range(13)]
    rows: list[dict[str, Any] | None] = [
        {"id": 7},
        *permission_rows,
        {"id": 20, "ativo": True},
        *profile_permission_rows,
        {"ativo": True},
    ]
    engine = FakeEngine(rows)

    response = bootstrap_internal_admin_profile(
        login="admin.homologacao",
        perfil_chave="administrador-interno-geoportal",
        perfil_nome="Administrador Interno do Geoportal",
        perfil_descricao="Perfil administrativo inicial.",
        permissoes=bootstrap_script.INITIAL_ADMIN_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)

    assert response.usuario_id == 7
    assert response.perfil_id == 20
    assert response.permissao_ids == tuple(range(101, 114))
    assert response.perfil_permissoes_criadas == 0
    assert response.usuario_perfil_criado is False
    assert "INSERT INTO" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()


def test_admin_bootstrap_creates_missing_dashboard_permission() -> None:
    existing_permission_rows = [{"id": index, "ativo": True} for index in range(101, 112)]
    rows: list[dict[str, Any] | None] = [
        {"id": 7},
        *existing_permission_rows,
        None,
        {"id": 112},
        {"id": 113, "ativo": True},
        {"id": 20, "ativo": True},
        *({"exists": 1} for _ in range(13)),
        {"ativo": True},
    ]
    engine = FakeEngine(rows)

    response = bootstrap_internal_admin_profile(
        login="admin.homologacao",
        perfil_chave="administrador-interno-geoportal",
        perfil_nome="Administrador Interno do Geoportal",
        perfil_descricao="Perfil administrativo inicial.",
        permissoes=bootstrap_script.INITIAL_ADMIN_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)
    params = params_history(engine)

    assert response.permissao_ids == tuple(range(101, 114))
    assert response.perfil_permissoes_criadas == 0
    assert any(
        params_item == {
            "modulo": "iluminacao",
            "chave": "dashboard.ler",
            "descricao": "Ler dashboard gerencial interno de solicitacoes de Iluminacao Publica.",
        }
        for params_item in params
    )
    assert "INSERT INTO mod_auth.permissoes" in sql
    assert "INSERT INTO mod_auth.perfil_permissoes" not in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()
def test_bootstrap_creates_missing_records_without_sensitive_output_or_delete() -> None:
    permission_insert_rows = [{"id": index} for index in range(101, 114)]
    rows: list[dict[str, Any] | None] = [{"id": 7}]
    for insert_row in permission_insert_rows:
        rows.extend([None, insert_row])
    rows.extend([None, {"id": 20}])
    rows.extend([None for _ in range(13)])
    rows.append(None)
    engine = FakeEngine(rows)

    response = bootstrap_internal_admin_profile(
        login="Admin.Homologacao",
        perfil_chave="Administrador-Interno-Geoportal",
        perfil_nome="Administrador Interno do Geoportal",
        perfil_descricao="Perfil administrativo inicial.",
        permissoes=bootstrap_script.INITIAL_ADMIN_PERMISSIONS,
        engine=engine,
    )

    sql = sql_history(engine)

    assert response.usuario_id == 7
    assert response.perfil_id == 20
    assert response.perfil_permissoes_criadas == 13
    assert response.usuario_perfil_criado is True
    assert "INSERT INTO mod_auth.permissoes" in sql
    assert "INSERT INTO mod_auth.perfis" in sql
    assert "INSERT INTO mod_auth.perfil_permissoes" in sql
    assert "INSERT INTO mod_auth.usuario_perfis" in sql
    assert "DELETE" not in sql.upper()
    assert "UPDATE" not in sql.upper()
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql
    assert HASH_VALUE not in sql
    assert SESSION_SECRET not in sql
    assert DATABASE_URL_MARKER not in sql


def test_bootstrap_rejects_inactive_profile_without_reactivation() -> None:
    rows: list[dict[str, Any] | None] = [
        {"id": 7},
        *({"id": index, "ativo": True} for index in range(101, 114)),
        {"id": 20, "ativo": False},
    ]
    engine = FakeEngine(rows)

    try:
        bootstrap_internal_admin_profile(
            login="admin.homologacao",
            perfil_chave="administrador-interno-geoportal",
            perfil_nome="Administrador Interno do Geoportal",
            perfil_descricao="Perfil administrativo inicial.",
            permissoes=bootstrap_script.INITIAL_ADMIN_PERMISSIONS,
            engine=engine,
        )
    except ValueError as exc:
        assert "inactive" in str(exc)
    else:
        raise AssertionError("inactive profile should not be reactivated automatically")

    sql = sql_history(engine)
    assert "UPDATE" not in sql.upper()
    assert "DELETE" not in sql.upper()


def test_admin_permission_seed_values_are_not_sensitive() -> None:
    for permission in bootstrap_script.INITIAL_ADMIN_PERMISSIONS:
        assert isinstance(permission, AdminPermissionSeed)
        rendered = f"{permission.modulo}.{permission.chave} {permission.descricao}"
        assert RAW_PASSWORD not in rendered
        assert TOKEN_VALUE not in rendered
        assert HASH_VALUE not in rendered
        assert SESSION_SECRET not in rendered
        assert DATABASE_URL_MARKER not in rendered
