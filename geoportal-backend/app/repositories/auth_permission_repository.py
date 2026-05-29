from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


def get_effective_permissions_for_user(
    usuario_id: int,
    engine: Engine | None = None,
) -> set[str]:
    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT DISTINCT
            lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave)) AS permissao
        FROM mod_auth.usuario_perfis up
        INNER JOIN mod_auth.perfis pf
            ON pf.id = up.perfil_id
        INNER JOIN mod_auth.perfil_permissoes pp
            ON pp.perfil_id = pf.id
        INNER JOIN mod_auth.permissoes p
            ON p.id = pp.permissao_id
        WHERE up.usuario_id = :usuario_id
          AND up.ativo IS true
          AND pf.ativo IS true
          AND p.ativo IS true
        """
    )

    with db_engine.begin() as connection:
        rows = connection.execute(
            statement,
            {"usuario_id": usuario_id},
        ).mappings().all()

    return {
        str(row["permissao"])
        for row in rows
        if row.get("permissao") is not None
    }
