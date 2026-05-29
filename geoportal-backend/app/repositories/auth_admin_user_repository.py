from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.core.database import get_engine


@dataclass(frozen=True)
class CreatedInternalUser:
    id: int
    login: str
    email: str | None


@dataclass(frozen=True)
class CreatedBasicInternalUser:
    id: int
    login: str
    nome: str
    email: str | None
    ativo: bool
    bloqueado: bool
    criado_em: datetime


@dataclass(frozen=True)
class AssignedInternalUserProfile:
    usuario_id: int
    perfil_id: int
    modulo: str | None
    ativo: bool
    created: bool


class InternalUserConflictError(RuntimeError):
    pass


class InternalUserProfileNotFoundError(RuntimeError):
    pass


class InternalUserProfileInactiveConflictError(RuntimeError):
    pass


def internal_user_exists(
    *,
    login: str,
    email: str | None = None,
    engine: Engine | None = None,
) -> bool:
    normalized_login = login.strip()
    normalized_email = email.strip() if email is not None else None
    if not normalized_login:
        return False

    db_engine = engine or get_engine()

    params = {"login": normalized_login}
    if normalized_email:
        statement = text(
            """
            SELECT 1
            FROM mod_auth.usuarios
            WHERE lower(login) = lower(:login)
               OR lower(email) = lower(:email)
            LIMIT 1
            """
        )
        params["email"] = normalized_email
    else:
        statement = text(
            """
            SELECT 1
            FROM mod_auth.usuarios
            WHERE lower(login) = lower(:login)
            LIMIT 1
            """
        )

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().first()

    return row is not None


def create_internal_user(
    *,
    nome: str,
    login: str,
    senha_hash: str,
    email: str | None = None,
    engine: Engine | None = None,
) -> CreatedInternalUser:
    normalized_nome = nome.strip()
    normalized_email = email.strip().lower() if email is not None else None
    normalized_login = login.strip().lower()
    normalized_senha_hash = senha_hash.strip()

    if not normalized_nome:
        raise ValueError("nome must not be empty")
    if normalized_email == "":
        normalized_email = None
    if normalized_email is not None and "@" not in normalized_email:
        raise ValueError("email must have a valid minimum format")
    if not normalized_login:
        raise ValueError("login must not be empty")
    if not normalized_senha_hash:
        raise ValueError("senha_hash must not be empty")

    db_engine = engine or get_engine()

    statement = text(
        """
        INSERT INTO mod_auth.usuarios (
            nome,
            email,
            login,
            senha_hash,
            ativo
        )
        VALUES (
            :nome,
            :email,
            :login,
            :senha_hash,
            true
        )
        RETURNING id, login, email
        """
    )

    params = {
        "nome": normalized_nome,
        "email": normalized_email,
        "login": normalized_login,
        "senha_hash": normalized_senha_hash,
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().first()

    if row is None:
        raise RuntimeError("internal user was not created")

    return CreatedInternalUser(**dict(row))


def create_basic_internal_user(
    *,
    nome: str,
    login: str,
    senha_hash: str,
    email: str | None = None,
    engine: Engine | None = None,
) -> CreatedBasicInternalUser:
    normalized_nome = nome.strip()
    normalized_email = email.strip().lower() if email is not None else None
    normalized_login = login.strip().lower()
    normalized_senha_hash = senha_hash.strip()

    if not normalized_nome:
        raise ValueError("nome must not be empty")
    if normalized_email == "":
        normalized_email = None
    if normalized_email is not None and "@" not in normalized_email:
        raise ValueError("email must have a valid minimum format")
    if not normalized_login:
        raise ValueError("login must not be empty")
    if not normalized_senha_hash:
        raise ValueError("senha_hash must not be empty")

    db_engine = engine or get_engine()

    statement = text(
        """
        INSERT INTO mod_auth.usuarios (
            nome,
            email,
            login,
            senha_hash,
            ativo,
            bloqueado_ate,
            desativado_em,
            atualizado_em
        )
        VALUES (
            :nome,
            :email,
            :login,
            :senha_hash,
            true,
            NULL,
            NULL,
            NULL
        )
        RETURNING
            id,
            login,
            nome,
            email,
            ativo,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            criado_em
        """
    )

    params = {
        "nome": normalized_nome,
        "email": normalized_email,
        "login": normalized_login,
        "senha_hash": normalized_senha_hash,
    }

    try:
        with db_engine.begin() as connection:
            row = connection.execute(statement, params).mappings().first()
    except IntegrityError as exc:
        raise InternalUserConflictError("internal user already exists") from exc

    if row is None:
        raise RuntimeError("internal user was not created")

    return CreatedBasicInternalUser(**dict(row))


def update_internal_user_password_by_login(
    *,
    login: str,
    senha_hash: str,
    engine: Engine | None = None,
) -> bool:
    normalized_login = login.strip().lower()
    normalized_senha_hash = senha_hash.strip()

    if not normalized_login:
        raise ValueError("login must not be empty")
    if not normalized_senha_hash:
        raise ValueError("senha_hash must not be empty")

    db_engine = engine or get_engine()

    statement = text(
        """
        UPDATE mod_auth.usuarios
        SET
            senha_hash = :senha_hash,
            atualizado_em = now()
        WHERE lower(login) = lower(:login)
        RETURNING id
        """
    )

    params = {
        "login": normalized_login,
        "senha_hash": normalized_senha_hash,
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().first()

    return row is not None


def _normalize_optional_module(modulo: str | None) -> str | None:
    if modulo is None:
        return None
    normalized_modulo = modulo.strip().lower()
    return normalized_modulo or None


def _assignment_from_row(
    row: dict[str, object],
    *,
    created: bool,
) -> AssignedInternalUserProfile:
    return AssignedInternalUserProfile(
        usuario_id=int(row["usuario_id"]),
        perfil_id=int(row["perfil_id"]),
        modulo=row["modulo"] if row["modulo"] is None else str(row["modulo"]),
        ativo=bool(row["ativo"]),
        created=created,
    )


def assign_internal_user_profile(
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None = None,
    engine: Engine | None = None,
) -> AssignedInternalUserProfile:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")
    if perfil_id <= 0:
        raise ValueError("perfil_id must be positive")

    normalized_modulo = _normalize_optional_module(modulo)
    db_engine = engine or get_engine()

    user_statement = text(
        """
        SELECT 1
        FROM mod_auth.usuarios
        WHERE id = :usuario_id
        LIMIT 1
        """
    )
    profile_statement = text(
        """
        SELECT 1
        FROM mod_auth.perfis
        WHERE id = :perfil_id
          AND ativo IS true
        LIMIT 1
        """
    )
    if normalized_modulo is None:
        existing_statement = text(
            """
            SELECT usuario_id, perfil_id, modulo, ativo
            FROM mod_auth.usuario_perfis
            WHERE usuario_id = :usuario_id
              AND perfil_id = :perfil_id
              AND modulo IS NULL
            LIMIT 1
            """
        )
    else:
        existing_statement = text(
            """
            SELECT usuario_id, perfil_id, modulo, ativo
            FROM mod_auth.usuario_perfis
            WHERE usuario_id = :usuario_id
              AND perfil_id = :perfil_id
              AND lower(modulo) = lower(:modulo)
            LIMIT 1
            """
        )
    insert_statement = text(
        """
        INSERT INTO mod_auth.usuario_perfis (
            usuario_id,
            perfil_id,
            modulo,
            ativo
        )
        VALUES (
            :usuario_id,
            :perfil_id,
            :modulo,
            true
        )
        RETURNING usuario_id, perfil_id, modulo, ativo
        """
    )

    params = {
        "usuario_id": usuario_id,
        "perfil_id": perfil_id,
        "modulo": normalized_modulo,
    }

    with db_engine.begin() as connection:
        user_row = connection.execute(
            user_statement,
            {"usuario_id": usuario_id},
        ).mappings().first()
        if user_row is None:
            raise InternalUserProfileNotFoundError("internal user or profile not found")

        profile_row = connection.execute(
            profile_statement,
            {"perfil_id": perfil_id},
        ).mappings().first()
        if profile_row is None:
            raise InternalUserProfileNotFoundError("internal user or profile not found")

        existing_row = connection.execute(existing_statement, params).mappings().first()
        if existing_row is not None:
            assignment = _assignment_from_row(dict(existing_row), created=False)
            if assignment.ativo:
                return assignment
            raise InternalUserProfileInactiveConflictError(
                "internal user profile link is inactive"
            )

        inserted_row = connection.execute(insert_statement, params).mappings().first()

    if inserted_row is None:
        raise RuntimeError("internal user profile link was not created")

    return _assignment_from_row(dict(inserted_row), created=True)
