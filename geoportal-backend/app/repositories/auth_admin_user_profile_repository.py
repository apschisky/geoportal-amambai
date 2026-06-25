from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class InternalAdminUserProfileLink:
    usuario_id: int
    perfil_id: int
    chave: str
    nome: str
    modulo: str | None
    ativo: bool
    criado_em: datetime


class InternalUserProfileLinkNotFoundError(RuntimeError):
    pass


class InternalUserProfileLinkInactiveConflictError(RuntimeError):
    pass


def list_internal_user_profile_links(
    *,
    usuario_id: int,
    engine: Engine | None = None,
) -> list[InternalAdminUserProfileLink]:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")

    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        user = connection.execute(
            text(
                """
                SELECT id
                FROM mod_auth.usuarios
                WHERE id = :usuario_id
                LIMIT 1
                """
            ),
            {"usuario_id": usuario_id},
        ).mappings().first()
        if user is None:
            raise InternalUserProfileLinkNotFoundError(
                "internal user was not found"
            )

        rows = connection.execute(
            text(
                """
                SELECT
                    up.usuario_id,
                    up.perfil_id,
                    pf.chave,
                    pf.nome,
                    up.modulo,
                    up.ativo,
                    up.criado_em
                FROM mod_auth.usuario_perfis up
                INNER JOIN mod_auth.perfis pf
                    ON pf.id = up.perfil_id
                WHERE up.usuario_id = :usuario_id
                ORDER BY lower(pf.nome), lower(pf.chave), up.perfil_id,
                         lower(coalesce(up.modulo, ''))
                """
            ),
            {"usuario_id": usuario_id},
        ).mappings().all()

    return [InternalAdminUserProfileLink(**dict(row)) for row in rows]


__all__ = [
    "InternalAdminUserProfileLink",
    "InternalUserProfileLinkInactiveConflictError",
    "InternalUserProfileLinkNotFoundError",
    "list_internal_user_profile_links",
]
