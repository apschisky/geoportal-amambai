from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class CreatedInternalUser:
    id: int
    login: str
    email: str | None


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
