import os
import subprocess
import sys
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_repository import (
    create_internal_user,
    internal_user_exists,
)
from scripts.admin import create_internal_user as admin_script


RAW_PASSWORD = "senha-ficticia-para-teste"
PASSWORD_HASH = "argon2id-hash-ficticio-nao-real"
TOKEN_VALUE = "token-ficticio-nao-deve-aparecer"
DATABASE_CONFIG_MARKER = "database-config-ficticia-nao-usada"
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
            "scripts/admin/create_internal_user.py",
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


def test_script_reads_password_with_getpass_and_not_cli_argument() -> None:
    output = StringIO()
    prompts: list[str] = []

    def fake_getpass(prompt: str) -> str:
        prompts.append(prompt)
        return RAW_PASSWORD

    response = admin_script.run(
        [
            "--login",
            "Usuario.Teste",
            "--email",
            "Usuario.Teste@Example.Test",
            "--nome",
            " Usuario Teste ",
            "--dry-run",
        ],
        getpass_func=fake_getpass,
        hash_password_func=lambda password: PASSWORD_HASH,
        stdout=output,
    )

    assert response == 0
    assert prompts == ["Senha inicial: ", "Confirme a senha inicial: "]
    assert "--password" not in admin_script.build_parser().format_help()
    assert RAW_PASSWORD not in output.getvalue()


def test_script_rejects_password_cli_argument() -> None:
    output = StringIO()

    response = admin_script.run(
        [
            "--login",
            "usuario.teste",
            "--email",
            "usuario.teste@example.test",
            "--nome",
            "Usuario Teste",
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


def test_password_mismatch_aborts_without_hash_or_repository() -> None:
    output = StringIO()
    calls = {"hash": 0, "exists": 0, "create": 0}
    passwords = iter(["senha-um", "senha-dois"])

    response = admin_script.run(
        [
            "--login",
            "usuario.teste",
            "--email",
            "usuario.teste@example.test",
            "--nome",
            "Usuario Teste",
        ],
        getpass_func=lambda prompt: next(passwords),
        hash_password_func=lambda password: calls.__setitem__("hash", 1) or PASSWORD_HASH,
        user_exists_func=lambda **kwargs: calls.__setitem__("exists", 1) or False,
        create_user_func=lambda **kwargs: calls.__setitem__("create", 1),
        stdout=output,
    )

    assert response == 1
    assert calls == {"hash": 0, "exists": 0, "create": 0}
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


@pytest.mark.parametrize("password", ["", "   "])
def test_empty_password_aborts_without_hash_or_repository(password: str) -> None:
    output = StringIO()
    calls = {"hash": 0, "exists": 0, "create": 0}

    response = admin_script.run(
        [
            "--login",
            "usuario.teste",
            "--email",
            "usuario.teste@example.test",
            "--nome",
            "Usuario Teste",
        ],
        getpass_func=lambda prompt: password,
        hash_password_func=lambda value: calls.__setitem__("hash", 1) or PASSWORD_HASH,
        user_exists_func=lambda **kwargs: calls.__setitem__("exists", 1) or False,
        create_user_func=lambda **kwargs: calls.__setitem__("create", 1),
        stdout=output,
    )

    assert response == 1
    assert calls == {"hash": 0, "exists": 0, "create": 0}
    assert PASSWORD_HASH not in output.getvalue()


def test_dry_run_hashes_in_memory_without_calling_repository() -> None:
    output = StringIO()
    calls = {"hash": [], "exists": 0, "create": 0}

    response = admin_script.run(
        [
            "--login",
            "Usuario.Teste",
            "--email",
            "Usuario.Teste@Example.Test",
            "--nome",
            "Usuario Teste",
            "--dry-run",
        ],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: calls["hash"].append(password) or PASSWORD_HASH,
        user_exists_func=lambda **kwargs: calls.__setitem__("exists", 1) or False,
        create_user_func=lambda **kwargs: calls.__setitem__("create", 1),
        stdout=output,
    )

    assert response == 0
    assert calls == {"hash": [RAW_PASSWORD], "exists": 0, "create": 0}
    assert "Dry-run validado" in output.getvalue()
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_valid_flow_calls_repository_with_hash_and_never_raw_password() -> None:
    output = StringIO()
    created_kwargs: dict[str, Any] = {}
    exists_kwargs: dict[str, Any] = {}

    response = admin_script.run(
        [
            "--login",
            " Usuario.Teste ",
            "--email",
            " Usuario.Teste@Example.Test ",
            "--nome",
            " Usuario Teste ",
        ],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: PASSWORD_HASH,
        user_exists_func=lambda **kwargs: exists_kwargs.update(kwargs) or False,
        create_user_func=lambda **kwargs: created_kwargs.update(kwargs),
        stdout=output,
    )

    assert response == 0
    assert exists_kwargs == {
        "login": "usuario.teste",
        "email": "usuario.teste@example.test",
    }
    assert created_kwargs == {
        "nome": "Usuario Teste",
        "email": "usuario.teste@example.test",
        "login": "usuario.teste",
        "senha_hash": PASSWORD_HASH,
    }
    assert RAW_PASSWORD not in created_kwargs.values()
    assert "password" not in created_kwargs
    assert RAW_PASSWORD not in output.getvalue()
    assert PASSWORD_HASH not in output.getvalue()


def test_existing_user_aborts_without_creating() -> None:
    output = StringIO()
    calls = {"create": 0}

    response = admin_script.run(
        [
            "--login",
            "usuario.teste",
            "--email",
            "usuario.teste@example.test",
            "--nome",
            "Usuario Teste",
        ],
        getpass_func=lambda prompt: RAW_PASSWORD,
        hash_password_func=lambda password: PASSWORD_HASH,
        user_exists_func=lambda **kwargs: True,
        create_user_func=lambda **kwargs: calls.__setitem__("create", 1),
        stdout=output,
    )

    assert response == 1
    assert calls["create"] == 0
    assert PASSWORD_HASH not in output.getvalue()


def test_script_does_not_import_fastapi_or_create_endpoint() -> None:
    assert "fastapi" not in admin_script.__dict__
    assert not hasattr(admin_script, "router")
    assert not hasattr(admin_script, "app")


def test_internal_user_exists_uses_bind_params() -> None:
    engine = FakeEngine({"exists": 1})

    response = internal_user_exists(
        login=" Usuario.Teste ",
        email=" Usuario.Teste@Example.Test ",
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert response is True
    assert "FROM mod_auth.usuarios" in sql
    assert "lower(login) = lower(:login)" in sql
    assert "lower(email) = lower(:email)" in sql
    assert params == {
        "login": "Usuario.Teste",
        "email": "Usuario.Teste@Example.Test",
    }
    assert "Usuario.Teste" not in sql
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql
    assert DATABASE_CONFIG_MARKER not in sql


def test_create_internal_user_uses_parameterized_insert_with_hash_only() -> None:
    engine = FakeEngine(
        {
            "id": 10,
            "login": "usuario.teste",
            "email": "usuario.teste@example.test",
        }
    )

    response = create_internal_user(
        nome=" Usuario Teste ",
        email=" Usuario.Teste@Example.Test ",
        login=" Usuario.Teste ",
        senha_hash=PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert response.id == 10
    assert response.login == "usuario.teste"
    assert response.email == "usuario.teste@example.test"
    assert "INSERT INTO mod_auth.usuarios" in sql
    assert ":nome" in sql
    assert ":email" in sql
    assert ":login" in sql
    assert ":senha_hash" in sql
    assert params == {
        "nome": "Usuario Teste",
        "email": "usuario.teste@example.test",
        "login": "usuario.teste",
        "senha_hash": PASSWORD_HASH,
    }
    assert "Usuario Teste" not in sql
    assert "usuario.teste@example.test" not in sql
    assert PASSWORD_HASH not in sql
    assert RAW_PASSWORD not in sql
    assert TOKEN_VALUE not in sql
    assert DATABASE_CONFIG_MARKER not in sql
