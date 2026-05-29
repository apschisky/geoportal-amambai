import os
import subprocess
import sys
from io import StringIO
from pathlib import Path
from typing import Any

from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_repository import (
    update_internal_user_password_by_login,
)
from scripts.admin import reset_internal_user_password as reset_script


RAW_PASSWORD = "senha-ficticia-para-reset"
PASSWORD_HASH = "marcador-de-hash-ficticio-para-reset"
BACKEND_ROOT = Path(__file__).resolve().parents[1]


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(self, row: dict[str, Any] | None = None) -> None:
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
    def __init__(self, row: dict[str, Any] | None = None) -> None:
        self.connection = FakeConnection(row)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


def test_script_can_run_from_backend_root_without_external_pythonpath() -> None:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)

    response = subprocess.run(
        [
            sys.executable,
            "scripts/admin/reset_internal_user_password.py",
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
    assert PASSWORD_HASH not in combined_output


def test_dry_run_with_valid_login_and_password_does_not_call_repository() -> None:
    output = StringIO()
    calls = {"hash": [], "update": 0}

    response = reset_script.run(
        ["--login", " Admin.Homologacao ", "--dry-run"],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: calls["hash"].append(password) or PASSWORD_HASH,
        update_password_func=lambda **kwargs: calls.__setitem__("update", 1) or True,
        stdout=output,
    )

    assert response == 0
    assert calls == {"hash": [RAW_PASSWORD], "update": 0}
    assert "Dry-run validado" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_empty_password_is_rejected_without_hash_or_repository() -> None:
    output = StringIO()
    calls = {"hash": 0, "update": 0}

    response = reset_script.run(
        ["--login", "admin.homologacao"],
        getpass_func=lambda prompt: " ",
        hash_password_func=lambda password: calls.__setitem__("hash", 1) or PASSWORD_HASH,
        update_password_func=lambda **kwargs: calls.__setitem__("update", 1) or True,
        stdout=output,
    )

    assert response == 1
    assert calls == {"hash": 0, "update": 0}
    assert "senha nao pode ser vazia" in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_password_mismatch_is_rejected_without_hash_or_repository() -> None:
    output = StringIO()
    calls = {"hash": 0, "update": 0}
    passwords = iter(["senha-um", "senha-dois"])

    response = reset_script.run(
        ["--login", "admin.homologacao"],
        getpass_func=lambda prompt: next(passwords),
        hash_password_func=lambda password: calls.__setitem__("hash", 1) or PASSWORD_HASH,
        update_password_func=lambda **kwargs: calls.__setitem__("update", 1) or True,
        stdout=output,
    )

    assert response == 1
    assert calls == {"hash": 0, "update": 0}
    assert "senha e confirmacao nao conferem" in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_empty_login_is_rejected_without_getpass_hash_or_repository() -> None:
    output = StringIO()
    calls = {"getpass": 0, "hash": 0, "update": 0}

    response = reset_script.run(
        ["--login", "   "],
        getpass_func=lambda prompt: calls.__setitem__("getpass", 1) or RAW_PASSWORD,
        hash_password_func=lambda password: calls.__setitem__("hash", 1) or PASSWORD_HASH,
        update_password_func=lambda **kwargs: calls.__setitem__("update", 1) or True,
        stdout=output,
    )

    assert response == 1
    assert calls == {"getpass": 0, "hash": 0, "update": 0}
    assert "login nao pode ser vazio" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_script_rejects_password_cli_argument_without_printing_it() -> None:
    output = StringIO()

    response = reset_script.run(
        [
            "--login",
            "admin.homologacao",
            "--password",
            RAW_PASSWORD,
        ],
        getpass_func=lambda prompt: RAW_PASSWORD,
        stdout=output,
    )

    assert response == 2
    assert "linha de comando" in output.getvalue()
    assert "--password" not in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()


def test_valid_flow_calls_repository_with_login_and_hash_never_raw_password() -> None:
    output = StringIO()
    update_kwargs: dict[str, Any] = {}

    response = reset_script.run(
        ["--login", " Admin.Homologacao "],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: PASSWORD_HASH,
        update_password_func=lambda **kwargs: update_kwargs.update(kwargs) or True,
        stdout=output,
    )

    assert response == 0
    assert update_kwargs == {
        "login": "admin.homologacao",
        "senha_hash": PASSWORD_HASH,
    }
    assert RAW_PASSWORD not in update_kwargs.values()
    assert "password" not in update_kwargs
    assert "Senha do usuario interno atualizada com sucesso." in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_missing_login_returns_controlled_error_without_creating_user() -> None:
    output = StringIO()
    update_kwargs: dict[str, Any] = {}

    response = reset_script.run(
        ["--login", "usuario.inexistente"],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: PASSWORD_HASH,
        update_password_func=lambda **kwargs: update_kwargs.update(kwargs) or False,
        stdout=output,
    )

    assert response == 1
    assert update_kwargs == {
        "login": "usuario.inexistente",
        "senha_hash": PASSWORD_HASH,
    }
    assert "usuario interno nao encontrado" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_success_message_does_not_contain_password_or_hash() -> None:
    output = StringIO()

    response = reset_script.run(
        ["--login", "admin.homologacao"],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: PASSWORD_HASH,
        update_password_func=lambda **kwargs: True,
        stdout=output,
    )

    assert response == 0
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_script_does_not_import_fastapi_or_create_endpoint() -> None:
    assert "fastapi" not in reset_script.__dict__
    assert not hasattr(reset_script, "router")
    assert not hasattr(reset_script, "app")


def test_repository_updates_password_with_bind_params_only() -> None:
    engine = FakeEngine({"id": 10})

    response = update_internal_user_password_by_login(
        login=" Admin.Homologacao ",
        senha_hash=PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert response is True
    assert "UPDATE mod_auth.usuarios" in sql
    assert "senha_hash = :senha_hash" in sql
    assert "atualizado_em = now()" in sql
    assert "WHERE lower(login) = lower(:login)" in sql
    assert "RETURNING id" in sql
    assert "ultimo_login_em" not in sql
    assert "bloqueado_ate" not in sql
    assert "desativado_em" not in sql
    assert "ativo" not in sql
    assert "email" not in sql
    assert "nome" not in sql
    assert params == {
        "login": "admin.homologacao",
        "senha_hash": PASSWORD_HASH,
    }
    assert "admin.homologacao" not in sql
    assert PASSWORD_HASH not in sql
    assert RAW_PASSWORD not in sql


def test_repository_returns_false_when_login_is_not_found() -> None:
    engine = FakeEngine(None)

    response = update_internal_user_password_by_login(
        login="usuario.inexistente",
        senha_hash=PASSWORD_HASH,
        engine=engine,
    )

    assert response is False
