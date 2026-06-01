from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_repository import (
    AssignedInternalUserProfile,
    CreatedBasicInternalUser,
    InternalUserConflictError,
    InternalUserNotFoundError,
    InternalUserProfileInactiveConflictError,
    InternalUserProfileNotFoundError,
    UpdatedInternalUserBlockStatus,
    assign_internal_user_profile,
    block_internal_user,
    create_basic_internal_user,
    unblock_internal_user,
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


class SequentialFakeConnection:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.rows = list(rows)
        self.statements: list[TextClause] = []
        self.params_list: list[dict[str, Any]] = []

    def execute(self, statement: TextClause, params: dict[str, Any]) -> FakeResult:
        self.statements.append(statement)
        self.params_list.append(params)
        row = self.rows.pop(0) if self.rows else None
        return FakeResult(row)


class SequentialFakeEngine:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.connection = SequentialFakeConnection(rows)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)  # type: ignore[arg-type]


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


def profile_assignment_row(
    *,
    ativo: bool = True,
    modulo: str | None = None,
) -> dict[str, Any]:
    return {
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": modulo,
        "ativo": ativo,
    }


def block_status_row(*, bloqueado: bool) -> dict[str, Any]:
    return {
        "id": 8,
        "login": "usuario.exemplo",
        "nome": "Usuario Exemplo",
        "email": None,
        "ativo": True,
        "bloqueado": bloqueado,
        "criado_em": CREATED_AT,
    }


def sql_history(engine: SequentialFakeEngine) -> str:
    return "\n".join(str(statement) for statement in engine.connection.statements)


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


def test_assign_internal_user_profile_creates_new_link_with_bind_parameters() -> None:
    engine = SequentialFakeEngine(
        rows=[
            {"exists": 1},
            {"exists": 1},
            None,
            profile_assignment_row(),
        ]
    )

    response = assign_internal_user_profile(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        engine=engine,
    )

    assert response == AssignedInternalUserProfile(
        usuario_id=8,
        perfil_id=3,
        modulo=None,
        ativo=True,
        created=True,
    )
    sql = sql_history(engine)
    assert "FROM mod_auth.usuarios" in sql
    assert "FROM mod_auth.perfis" in sql
    assert "FROM mod_auth.usuario_perfis" in sql
    assert "INSERT INTO mod_auth.usuario_perfis" in sql
    assert ":usuario_id" in sql
    assert ":perfil_id" in sql
    assert ":modulo" in sql
    assert "teste.criacao" not in sql
    assert "admin.homologacao" not in sql
    assert "DELETE" not in sql.upper()
    assert engine.connection.params_list[-1] == {
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": None,
    }


def test_assign_internal_user_profile_is_idempotent_for_active_link() -> None:
    engine = SequentialFakeEngine(
        rows=[
            {"exists": 1},
            {"exists": 1},
            profile_assignment_row(modulo="iluminacao"),
        ]
    )

    response = assign_internal_user_profile(
        usuario_id=8,
        perfil_id=3,
        modulo=" Iluminacao ",
        engine=engine,
    )

    assert response == AssignedInternalUserProfile(
        usuario_id=8,
        perfil_id=3,
        modulo="iluminacao",
        ativo=True,
        created=False,
    )
    sql = sql_history(engine)
    assert "lower(modulo) = lower(:modulo)" in sql
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql
    assert engine.connection.params_list[-1] == {
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": "iluminacao",
    }


def test_assign_internal_user_profile_returns_not_found_for_missing_user() -> None:
    engine = SequentialFakeEngine(rows=[None])

    with pytest.raises(InternalUserProfileNotFoundError):
        assign_internal_user_profile(
            usuario_id=8,
            perfil_id=3,
            engine=engine,
        )

    sql = sql_history(engine)
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql


def test_assign_internal_user_profile_returns_not_found_for_missing_profile() -> None:
    engine = SequentialFakeEngine(rows=[{"exists": 1}, None])

    with pytest.raises(InternalUserProfileNotFoundError):
        assign_internal_user_profile(
            usuario_id=8,
            perfil_id=3,
            engine=engine,
        )

    sql = sql_history(engine)
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql


def test_assign_internal_user_profile_rejects_inactive_existing_link() -> None:
    engine = SequentialFakeEngine(
        rows=[
            {"exists": 1},
            {"exists": 1},
            profile_assignment_row(ativo=False),
        ]
    )

    with pytest.raises(InternalUserProfileInactiveConflictError):
        assign_internal_user_profile(
            usuario_id=8,
            perfil_id=3,
            engine=engine,
        )

    sql = sql_history(engine)
    assert "INSERT INTO mod_auth.usuario_perfis" not in sql


def test_assign_internal_user_profile_rejects_invalid_ids_without_sql() -> None:
    engine = SequentialFakeEngine(rows=[])

    with pytest.raises(ValueError, match="usuario_id must be positive"):
        assign_internal_user_profile(usuario_id=0, perfil_id=3, engine=engine)
    with pytest.raises(ValueError, match="perfil_id must be positive"):
        assign_internal_user_profile(usuario_id=8, perfil_id=0, engine=engine)

    assert engine.connection.statements == []


def test_assign_internal_user_profile_does_not_touch_sensitive_tables() -> None:
    engine = SequentialFakeEngine(
        rows=[
            {"exists": 1},
            {"exists": 1},
            None,
            profile_assignment_row(),
        ]
    )

    assign_internal_user_profile(
        usuario_id=8,
        perfil_id=3,
        engine=engine,
    )

    sql = sql_history(engine).lower()
    assert "perfil_permissoes" not in sql
    assert "permissoes" not in sql
    assert "sessoes" not in sql
    assert "login_auditoria" not in sql
    assert "senha_hash" not in sql
    assert "delete" not in sql


def test_service_assigns_internal_profile_with_normalized_module(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_assign_internal_user_profile(**kwargs: object) -> AssignedInternalUserProfile:
        calls.update(kwargs)
        return AssignedInternalUserProfile(
            usuario_id=8,
            perfil_id=3,
            modulo="iluminacao",
            ativo=True,
            created=True,
        )

    monkeypatch.setattr(
        auth_admin_user_service,
        "assign_internal_user_profile",
        fake_assign_internal_user_profile,
    )

    response = auth_admin_user_service.assign_internal_admin_user_profile(
        usuario_id=8,
        perfil_id=3,
        modulo=" Iluminacao ",
    )

    assert response.created is True
    assert calls == {
        "usuario_id": 8,
        "perfil_id": 3,
        "modulo": "iluminacao",
    }


def test_service_rejects_invalid_profile_assignment_without_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"assign": 0}
    monkeypatch.setattr(
        auth_admin_user_service,
        "assign_internal_user_profile",
        lambda **kwargs: calls.__setitem__("assign", 1),
    )

    with pytest.raises(ValueError, match="usuario_id must be positive"):
        auth_admin_user_service.assign_internal_admin_user_profile(
            usuario_id=0,
            perfil_id=3,
        )
    with pytest.raises(ValueError, match="perfil_id must be positive"):
        auth_admin_user_service.assign_internal_admin_user_profile(
            usuario_id=8,
            perfil_id=0,
        )

    assert calls == {"assign": 0}


def test_block_internal_user_blocks_user_and_revokes_active_sessions() -> None:
    engine = FakeEngine(block_status_row(bloqueado=True))

    response = block_internal_user(usuario_id=8, engine=engine)

    assert response == UpdatedInternalUserBlockStatus(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=True,
        criado_em=CREATED_AT,
    )
    sql = sql_for(engine)
    params = params_for(engine)
    assert "UPDATE mod_auth.usuarios" in sql
    assert "SET bloqueado_ate = now() + (:block_days * interval '1 day')" in sql
    assert "UPDATE mod_auth.sessoes" in sql
    assert "SET revogado_em = now()" in sql
    assert "revogado_em IS NULL" in sql
    assert "WHERE id = :usuario_id" in sql
    assert params == {"usuario_id": 8, "block_days": 36500}
    assert "usuario_id = 8" not in sql
    assert "DELETE" not in sql.upper()


def test_block_internal_user_is_idempotent_for_existing_block() -> None:
    engine = FakeEngine(block_status_row(bloqueado=True))

    response = block_internal_user(usuario_id=8, engine=engine)

    assert response.bloqueado is True
    assert "RETURNING" in sql_for(engine)


def test_unblock_internal_user_unblocks_user_without_creating_session() -> None:
    engine = FakeEngine(block_status_row(bloqueado=False))

    response = unblock_internal_user(usuario_id=8, engine=engine)

    assert response == UpdatedInternalUserBlockStatus(
        id=8,
        login="usuario.exemplo",
        nome="Usuario Exemplo",
        email=None,
        ativo=True,
        bloqueado=False,
        criado_em=CREATED_AT,
    )
    sql = sql_for(engine)
    params = params_for(engine)
    assert "UPDATE mod_auth.usuarios" in sql
    assert "SET bloqueado_ate = NULL" in sql
    assert "WHERE id = :usuario_id" in sql
    assert params == {"usuario_id": 8}
    assert "INSERT INTO mod_auth.sessoes" not in sql
    assert "CREATE" not in sql.upper()
    assert "DELETE" not in sql.upper()


def test_unblock_internal_user_is_idempotent_for_existing_unblock() -> None:
    engine = FakeEngine(block_status_row(bloqueado=False))

    response = unblock_internal_user(usuario_id=8, engine=engine)

    assert response.bloqueado is False


def test_block_and_unblock_return_not_found_for_missing_user() -> None:
    for action in (block_internal_user, unblock_internal_user):
        engine = FakeEngine()

        with pytest.raises(InternalUserNotFoundError):
            action(usuario_id=999, engine=engine)


def test_block_and_unblock_reject_invalid_id_without_sql() -> None:
    for action in (block_internal_user, unblock_internal_user):
        engine = FakeEngine()

        with pytest.raises(ValueError, match="usuario_id must be positive"):
            action(usuario_id=0, engine=engine)

        assert engine.connection.statement is None


def test_block_and_unblock_do_not_touch_password_profiles_permissions_or_audit() -> None:
    for action, row in (
        (block_internal_user, block_status_row(bloqueado=True)),
        (unblock_internal_user, block_status_row(bloqueado=False)),
    ):
        engine = FakeEngine(row)

        response = action(usuario_id=8, engine=engine)

        sql = sql_for(engine).lower()
        assert not hasattr(response, "bloqueado_ate")
        assert "senha_hash" not in sql
        assert "usuario_perfis" not in sql
        assert "perfil_permissoes" not in sql
        assert "permissoes" not in sql
        assert "login_auditoria" not in sql
        assert "delete" not in sql


def test_service_blocks_and_unblocks_internal_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    def fake_block_internal_user(**kwargs: object) -> UpdatedInternalUserBlockStatus:
        calls.append(("block", kwargs))
        return UpdatedInternalUserBlockStatus(**block_status_row(bloqueado=True))

    def fake_unblock_internal_user(**kwargs: object) -> UpdatedInternalUserBlockStatus:
        calls.append(("unblock", kwargs))
        return UpdatedInternalUserBlockStatus(**block_status_row(bloqueado=False))

    monkeypatch.setattr(
        auth_admin_user_service,
        "block_internal_user",
        fake_block_internal_user,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "unblock_internal_user",
        fake_unblock_internal_user,
    )

    blocked = auth_admin_user_service.block_internal_admin_user(usuario_id=8)
    unblocked = auth_admin_user_service.unblock_internal_admin_user(usuario_id=8)

    assert blocked.bloqueado is True
    assert unblocked.bloqueado is False
    assert calls == [
        ("block", {"usuario_id": 8}),
        ("unblock", {"usuario_id": 8}),
    ]


def test_service_rejects_invalid_block_action_without_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"block": 0, "unblock": 0}
    monkeypatch.setattr(
        auth_admin_user_service,
        "block_internal_user",
        lambda **kwargs: calls.__setitem__("block", 1),
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "unblock_internal_user",
        lambda **kwargs: calls.__setitem__("unblock", 1),
    )

    with pytest.raises(ValueError, match="usuario_id must be positive"):
        auth_admin_user_service.block_internal_admin_user(usuario_id=0)
    with pytest.raises(ValueError, match="usuario_id must be positive"):
        auth_admin_user_service.unblock_internal_admin_user(usuario_id=0)

    assert calls == {"block": 0, "unblock": 0}
