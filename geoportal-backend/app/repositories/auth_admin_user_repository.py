from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class CreatedInternalUser:
    id: int
    login: str
    email: str


def internal_user_exists(
    *,
    login: str,
    email: str,
    engine: Engine | None = None,
) -> bool:
    normalized_login = login.strip()
    normalized_email = email.strip()
    if not normalized_login or not normalized_email:
        return False

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT 1
        FROM mod_auth.usuarios
        WHERE lower(login) = lower(:login)
           OR lower(email) = lower(:email)
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = (
            connection.execute(
                statement,
                {"login": normalized_login, "email": normalized_email},
            )
            .mappings()
            .first()
        )

    return row is not None


def create_internal_user(
    *,
    nome: str,
    email: str,
    login: str,
    senha_hash: str,
    engine: Engine | None = None,
) -> CreatedInternalUser:
    normalized_nome = nome.strip()
    normalized_email = email.strip().lower()
    normalized_login = login.strip().lower()
    normalized_senha_hash = senha_hash.strip()

    if not normalized_nome:
        raise ValueError("nome must not be empty")
    if not normalized_email:
        raise ValueError("email must not be empty")
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
