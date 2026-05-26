from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class AuthUserRecord:
    id: int
    nome: str
    email: str
    login: str
    senha_hash: str
    ativo: bool
    bloqueado_ate: datetime | None
    desativado_em: datetime | None


def get_auth_user_by_login(
    login_informado: str,
    engine: Engine | None = None,
) -> AuthUserRecord | None:
    normalized_login = login_informado.strip()
    if not normalized_login:
        return None

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            nome,
            email,
            login,
            senha_hash,
            ativo,
            bloqueado_ate,
            desativado_em
        FROM mod_auth.usuarios
        WHERE lower(login) = lower(:login_informado)
           OR lower(email) = lower(:login_informado)
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = (
            connection.execute(
                statement,
                {"login_informado": normalized_login},
            )
            .mappings()
            .first()
        )

    if row is None:
        return None

    return AuthUserRecord(**dict(row))


def record_successful_login(
    usuario_id: int,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()

    statement = text(
        """
        UPDATE mod_auth.usuarios
        SET ultimo_login_em = now(),
            atualizado_em = now()
        WHERE id = :usuario_id
        RETURNING id
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"usuario_id": usuario_id}).mappings().first()

    return row is not None
