from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_list_repository import InternalAdminUserListItem
from app.repositories.auth_admin_user_repository import (
    AssignedInternalUserProfile,
    CreatedBasicInternalUser,
    InternalUserConflictError,
    InternalUserNotFoundError,
    InternalUserProfileInactiveConflictError,
    InternalUserProfileNotFoundError,
    UpdatedInternalUserBlockStatus,
    UpdatedInternalUserPasswordStatus,
    assign_internal_user_profile,
    block_internal_user,
    create_basic_internal_user,
    reset_internal_user_password,
    unblock_internal_user,
)
from app.services import auth_admin_user_service
from app.repositories import auth_admin_audit_repository


RAW_PASSWORD = "senha-ficticia-interna-123"
NEW_RAW_PASSWORD = "nova-senha-ficticia-interna-456"
PASSWORD_HASH = "argon2id-hash-ficticio-nao-real"
NEW_PASSWORD_HASH = "argon2id-novo-hash-ficticio-nao-real"
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
        self.committed = False
        self.rolled_back = False

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
        self.connection.committed = exc_type is None
        self.connection.rolled_back = exc_type is not None
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


def password_status_row(*, bloqueado: bool = False) -> dict[str, Any]:
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


def test_reset_internal_user_password_updates_hash_and_revokes_active_sessions() -> None:
    engine = FakeEngine(password_status_row())

    response = reset_internal_user_password(
        usuario_id=8,
        senha_hash=f" {NEW_PASSWORD_HASH} ",
        engine=engine,
    )

    assert response == UpdatedInternalUserPasswordStatus(
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
    assert "senha_hash = :senha_hash" in sql
    assert "atualizado_em = now()" in sql
    assert "UPDATE mod_auth.sessoes" in sql
    assert "SET revogado_em = now()" in sql
    assert "revogado_em IS NULL" in sql
    assert "WHERE id = :usuario_id" in sql
    assert params == {"usuario_id": 8, "senha_hash": NEW_PASSWORD_HASH}
    assert "usuario_id = 8" not in sql
    assert NEW_PASSWORD_HASH not in sql
    assert RAW_PASSWORD not in sql
    assert NEW_RAW_PASSWORD not in sql
    assert "DELETE" not in sql.upper()


def test_reset_internal_user_password_keeps_existing_block_status() -> None:
    engine = FakeEngine(password_status_row(bloqueado=True))

    response = reset_internal_user_password(
        usuario_id=8,
        senha_hash=NEW_PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine)
    assert response.bloqueado is True
    assert "SET bloqueado_ate" not in sql
    assert "ativo =" not in sql


def test_reset_internal_user_password_returns_not_found_for_missing_user() -> None:
    engine = FakeEngine()

    with pytest.raises(InternalUserNotFoundError):
        reset_internal_user_password(
            usuario_id=999,
            senha_hash=NEW_PASSWORD_HASH,
            engine=engine,
        )


def test_reset_internal_user_password_rejects_invalid_values_without_sql() -> None:
    engine = FakeEngine(password_status_row())

    with pytest.raises(ValueError, match="usuario_id must be positive"):
        reset_internal_user_password(
            usuario_id=0,
            senha_hash=NEW_PASSWORD_HASH,
            engine=engine,
        )
    with pytest.raises(ValueError, match="senha_hash must not be empty"):
        reset_internal_user_password(
            usuario_id=8,
            senha_hash=" ",
            engine=engine,
        )

    assert engine.connection.statement is None


def test_reset_internal_user_password_does_not_touch_profiles_permissions_or_audit() -> None:
    engine = FakeEngine(password_status_row())

    response = reset_internal_user_password(
        usuario_id=8,
        senha_hash=NEW_PASSWORD_HASH,
        engine=engine,
    )

    sql = sql_for(engine).lower()
    assert not hasattr(response, "senha_hash")
    assert not hasattr(response, "bloqueado_ate")
    assert not hasattr(response, "atualizado_em")
    assert "usuario_perfis" not in sql
    assert "perfil_permissoes" not in sql
    assert "permissoes" not in sql
    assert "login_auditoria" not in sql
    assert "insert into mod_auth.sessoes" not in sql
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


def test_service_resets_internal_user_password_with_policy_hash_and_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_get_user_by_id(*, usuario_id: int) -> InternalAdminUserListItem:
        calls["get_user"] = {"usuario_id": usuario_id}
        return InternalAdminUserListItem(**password_status_row())

    def fake_hash_password(password: str) -> str:
        calls["hash_password"] = password
        return NEW_PASSWORD_HASH

    def fake_reset_internal_user_password(
        **kwargs: object,
    ) -> UpdatedInternalUserPasswordStatus:
        calls["reset_internal_user_password"] = kwargs
        return UpdatedInternalUserPasswordStatus(**password_status_row())

    monkeypatch.setattr(
        auth_admin_user_service,
        "get_internal_admin_user_by_id",
        fake_get_user_by_id,
    )
    monkeypatch.setattr(auth_admin_user_service, "hash_password", fake_hash_password)
    monkeypatch.setattr(
        auth_admin_user_service,
        "reset_internal_user_password",
        fake_reset_internal_user_password,
    )

    response = auth_admin_user_service.reset_internal_admin_user_password(
        usuario_id=8,
        nova_senha=NEW_RAW_PASSWORD,
        confirmar_nova_senha=NEW_RAW_PASSWORD,
    )

    assert response.id == 8
    assert calls == {
        "get_user": {"usuario_id": 8},
        "hash_password": NEW_RAW_PASSWORD,
        "reset_internal_user_password": {
            "usuario_id": 8,
            "senha_hash": NEW_PASSWORD_HASH,
        },
    }
    assert NEW_RAW_PASSWORD not in calls["reset_internal_user_password"].values()  # type: ignore[union-attr]


def test_service_denies_administrative_self_password_reset_and_audits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = FakeEngine()
    monkeypatch.setattr(
        auth_admin_audit_repository,
        'get_engine',
        lambda: engine,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        'get_internal_admin_user_by_id',
        lambda **kwargs: pytest.fail('user lookup must not run'),
    )

    with pytest.raises(
        auth_admin_user_service.AdministrativeSecurityDeniedError
    ):
        auth_admin_user_service.reset_internal_admin_user_password(
            usuario_id=7,
            nova_senha=NEW_RAW_PASSWORD,
            confirmar_nova_senha=NEW_RAW_PASSWORD,
            ator_usuario_id=7,
            ator_login='admin.teste',
        )

    params = params_for(engine)
    assert 'INSERT INTO mod_auth.admin_auditoria' in sql_for(engine)
    assert params['acao'] == 'admin.security.denied_self_change'
    assert params['resultado'] == 'negada'
    assert params['motivo'] == 'self_password_reset'
    assert engine.connection.committed is True
    assert engine.connection.rolled_back is False
    for forbidden in (
        NEW_RAW_PASSWORD,
        'token-ficticio',
        'cookie-ficticio',
        NEW_PASSWORD_HASH,
    ):
        assert forbidden not in str(params)


def test_service_reset_password_returns_not_found_before_hash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"hash": 0, "reset": 0}
    monkeypatch.setattr(
        auth_admin_user_service,
        "get_internal_admin_user_by_id",
        lambda **kwargs: None,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "hash_password",
        lambda password: calls.__setitem__("hash", 1) or NEW_PASSWORD_HASH,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "reset_internal_user_password",
        lambda **kwargs: calls.__setitem__("reset", 1),
    )

    with pytest.raises(InternalUserNotFoundError):
        auth_admin_user_service.reset_internal_admin_user_password(
            usuario_id=999,
            nova_senha=NEW_RAW_PASSWORD,
            confirmar_nova_senha=NEW_RAW_PASSWORD,
        )

    assert calls == {"hash": 0, "reset": 0}


@pytest.mark.parametrize(
    ("nova_senha", "confirmar_nova_senha"),
    [
        (NEW_RAW_PASSWORD, "outra-senha-ficticia-789"),
        ("abc12", "abc12"),
        ("abcdef", "abcdef"),
        ("123456", "123456"),
        ("usuario.exemplo", "usuario.exemplo"),
        ("Usuario Exemplo", "Usuario Exemplo"),
        ("senha123", "senha123"),
    ],
)
def test_service_rejects_invalid_reset_password_without_hash_or_repository(
    monkeypatch: pytest.MonkeyPatch,
    nova_senha: str,
    confirmar_nova_senha: str,
) -> None:
    calls = {"hash": 0, "reset": 0}
    monkeypatch.setattr(
        auth_admin_user_service,
        "get_internal_admin_user_by_id",
        lambda **kwargs: InternalAdminUserListItem(**password_status_row()),
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "hash_password",
        lambda password: calls.__setitem__("hash", 1) or NEW_PASSWORD_HASH,
    )
    monkeypatch.setattr(
        auth_admin_user_service,
        "reset_internal_user_password",
        lambda **kwargs: calls.__setitem__("reset", 1),
    )

    with pytest.raises(ValueError) as exc_info:
        auth_admin_user_service.reset_internal_admin_user_password(
            usuario_id=8,
            nova_senha=nova_senha,
            confirmar_nova_senha=confirmar_nova_senha,
        )

    assert calls == {"hash": 0, "reset": 0}
    assert str(exc_info.value) == "password does not meet policy"
    assert nova_senha not in str(exc_info.value)
