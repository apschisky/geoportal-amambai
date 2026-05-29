from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class InternalAdminUserListItem:
    id: int
    login: str
    nome: str
    email: str | None
    ativo: bool
    bloqueado: bool
    criado_em: datetime


def list_internal_admin_users(
    *,
    limit: int = 500,
    engine: Engine | None = None,
) -> list[InternalAdminUserListItem]:
    if limit <= 0:
        raise ValueError("limit must be positive")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            login,
            nome,
            email,
            ativo,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            criado_em
        FROM mod_auth.usuarios
        ORDER BY lower(login), id
        LIMIT :limit
        """
    )

    with db_engine.begin() as connection:
        rows = connection.execute(statement, {"limit": limit}).mappings().all()

    return [InternalAdminUserListItem(**dict(row)) for row in rows]


def get_internal_admin_user_by_id(
    *,
    usuario_id: int,
    engine: Engine | None = None,
) -> InternalAdminUserListItem | None:
    if usuario_id <= 0:
        return None

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            login,
            nome,
            email,
            ativo,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            criado_em
        FROM mod_auth.usuarios
        WHERE id = :usuario_id
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"usuario_id": usuario_id}).mappings().first()

    if row is None:
        return None

    return InternalAdminUserListItem(**dict(row))
