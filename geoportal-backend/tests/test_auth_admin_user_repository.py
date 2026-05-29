from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_repository import (
    CreatedBasicInternalUser,
    InternalUserConflictError,
    create_basic_internal_user,
)
from app.services import auth_admin_user_service


RAW_PASSWORD = "senha-ficticia-interna-123"
PASSWORD_HASH = "argon2id-hash-ficticio-nao-real"
CREATED_AT = datetime(2026, 5, 29, 10, 45, tzinfo=UTC)
SENSITIVE_MARKERS = (
    RAW_PASSWORD,
    "senha_inicial",
    "token",
    "token_hash",
    "cookie",
    "session_secret",
    "DATABASE_URL",
    "role",
    "GRANT",
)


class FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(
        self,
        row: dict[str, Any] | None = None,
        exc: Exception | None = None,
    ) -> None:
        self.statement: TextClause | None = None
        self.params: dict[str, Any] | None = None
        self.row = row
        self.exc = exc

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statement = statement
        self.params = params
        if self.exc is not None:
            raise self.exc
        return FakeResult(self.row)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None


class FakeEngine:
    def __init__(
        self,
        row: dict[str, Any] | None = None,
        exc: Exception | None = None,
    ) -> None:
        self.connection = FakeConnection(row=row, exc=exc)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def sql_for(engine: FakeEngine) -> str:
    assert engine.connection.statement is not None
    return str(engine.connection.statement)


def params_for(engine: FakeEngine) -> dict[str, Any]:
    assert engine.connection.params is not None
    return engine.connection.params


def created_row() -> dict[str, Any]:
    return {
        "id": 8,
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": None,
        "ativo": True,
        "bloqueado": False,
        "criado_em": CREATED_AT,
    }


def test_create_basic_internal_user_creates_user_with_normalized_data() -> None:
    engine = FakeEngine(created_row())

    response = create_basic_internal_user(
        login=" Usuario.Exemplo ",
        nome=" Usuario Exemplo ",
        email="",
        senha_hash=f" {PASSWORD_HASH} ",
        engine=engine,
    )

    assert response == CreatedBasicInternalUser(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=False,
        criado_em=CREATED_AT,
    )
    assert not hasattr(response, "senha_hash")
    assert params_for(engine) == {
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": None,
        "senha_hash": PASSWORD_HASH,
    }


def test_create_basic_internal_user_uses_bind_parameters_without_interpolation() -> None:
    engine = FakeEngine(created_row())

    create_basic_internal_user(
        login=" Usuario.Exemplo ",
        nome=" Usuario Exemplo ",
        email=" Usuario.Exemplo@Example.Test ",
        senha_hash=PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine)
    params = params_for(engine)

    assert "INSERT INTO mod_auth.usuarios" in sql
    assert ":login" in sql
    assert ":nome" in sql
    assert ":email" in sql
    assert ":senha_hash" in sql
    assert params == {
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": "usuario.exemplo@example.test",
        "senha_hash": PASSWORD_HASH,
    }
    assert "Usuario Exemplo" not in sql
    assert "usuario.exemplo@example.test" not in sql
    assert PASSWORD_HASH not in sql
    for marker in SENSITIVE_MARKERS:
        assert marker not in sql


def test_create_basic_internal_user_does_not_create_profiles_sessions_or_audit() -> None:
    engine = FakeEngine(created_row())

    create_basic_internal_user(
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        senha_hash=PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine).lower()

    assert "usuario_perfis" not in sql
    assert "perfil_permissoes" not in sql
    assert "perfis" not in sql
    assert "permissoes" not in sql
    assert "sessoes" not in sql
    assert "login_auditoria" not in sql
    assert "delete" not in sql


def test_create_basic_internal_user_returns_conflict_for_integrity_error() -> None:
    engine = FakeEngine(
        exc=IntegrityError(
            statement="statement",
            params={"login": "usuario.exemplo"},
            orig=Exception("unique violation"),
        )
    )

    with pytest.raises(InternalUserConflictError):
        create_basic_internal_user(
            login="usuario.exemplo",
            nome="Usuario Exemplo",
            senha_hash=PASSWORD_HASH,
            engine=engine,
        )


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        (
            {"login": " ", "nome": "Usuario Exemplo", "senha_hash": PASSWORD_HASH},
            "login must not be empty",
        ),
        (
            {"login": "usuario.exemplo", "nome": " ", "senha_hash": PASSWORD_HASH},
            "nome must not be empty",
        ),
        (
            {"login": "usuario.exemplo", "nome": "Usuario Exemplo", "senha_hash": " "},
            "senha_hash must not be empty",
        ),
        (
            {
                "login": "usuario.exemplo",
                "nome": "Usuario Exemplo",
                "email": "email-invalido",
                "senha_hash": PASSWORD_HASH,
            },
            "email must have a valid minimum format",
        ),
    ],
)
def test_create_basic_internal_user_rejects_invalid_values(
    kwargs: dict[str, str],
    message: str,
) -> None:
    engine = FakeEngine(created_row())

    with pytest.raises(ValueError, match=message):
        create_basic_internal_user(**kwargs, engine=engine)

    assert engine.connection.statement is None


def test_service_hashes_initial_password_and_never_passes_raw_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, Any] = {}

    def fake_hash_password(password: str) -> str:
        calls["hash_password"] = password
        return PASSWORD_HASH

    def fake_create_basic_internal_user(**kwargs: Any) -> CreatedBasicInternalUser:
        calls["create_basic_internal_user"] = kwargs
        return CreatedBasicInternalUser(**created_row())

    monkeypatch.setattr(auth_admin_user_service, "hash_password", fake_hash_password)
    monkeypatch.setattr(
        auth_admin_user_service,
        "create_basic_internal_user",
        fake_create_basic_internal_user,
    )

    response = auth_admin_user_service.create_basic_internal_admin_user(
        login=" Usuario.Exemplo ",
        nome=" Usuario Exemplo ",
        email=" ",
        senha_inicial=RAW_PASSWORD,
    )

    assert response.id == 8
    assert calls["hash_password"] == RAW_PASSWORD
    assert calls["create_basic_internal_user"] == {
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": None,
        "senha_hash": PASSWORD_HASH,
    }
    assert RAW_PASSWORD not in calls["create_basic_internal_user"].values()


@pytest.mark.parametrize(
    "senha_inicial",
    [
        "",
        "abc12",
        "abcdef",
        "123456",
        "usuario.exemplo",
        "Usuario Exemplo",
        "senha123",
    ],
)
def test_service_rejects_weak_initial_password_without_hash_or_repository(
    monkeypatch: pytest.MonkeyPatch,
    senha_inicial: str,
) -> None:
    calls = {"hash": 0, "create": 0}

    monkeypatch.setattr(
        auth_admin_user_service,
        "hash_password",
        lambda password: calls.__setitem__("hash", 1) or PASSWORD_HASH,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "create_basic_internal_user",
        lambda **kwargs: calls.__setitem__("create", 1),
    )

    with pytest.raises(ValueError) as exc_info:
        auth_admin_user_service.create_basic_internal_admin_user(
            login="usuario.exemplo",
            nome="Usuario Exemplo",
            senha_inicial=senha_inicial,
        )

    assert calls == {"hash": 0, "create": 0}
    assert "password does not meet policy" == str(exc_info.value)
    if senha_inicial.strip():
        assert senha_inicial.strip() not in str(exc_info.value)
