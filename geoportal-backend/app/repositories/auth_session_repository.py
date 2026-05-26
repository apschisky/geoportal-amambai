from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class AuthSessionRecord:
    id: int
    usuario_id: int
    criado_em: datetime
    expira_em: datetime
    revogado_em: datetime | None


def create_session(
    usuario_id: int,
    token_hash: str,
    expira_em: datetime,
    ip_hash: str | None = None,
    user_agent_hash: str | None = None,
    engine: Engine | None = None,
) -> AuthSessionRecord:
    if not token_hash.strip():
        raise ValueError("token_hash must not be empty")
    if expira_em is None:
        raise ValueError("expira_em is required")

    db_engine = engine or get_engine()

    statement = text(
        """
        INSERT INTO mod_auth.sessoes (
            usuario_id,
            token_hash,
            expira_em,
            ip_hash,
            user_agent_hash
        )
        VALUES (
            :usuario_id,
            :token_hash,
            :expira_em,
            :ip_hash,
            :user_agent_hash
        )
        RETURNING id, usuario_id, criado_em, expira_em, revogado_em
        """
    )

    params = {
        "usuario_id": usuario_id,
        "token_hash": token_hash,
        "expira_em": expira_em,
        "ip_hash": ip_hash,
        "user_agent_hash": user_agent_hash,
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().one()

    return AuthSessionRecord(**dict(row))


def get_active_session_by_token_hash(
    token_hash: str,
    engine: Engine | None = None,
) -> AuthSessionRecord | None:
    if not token_hash.strip():
        return None

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            s.id,
            s.usuario_id,
            s.criado_em,
            s.expira_em,
            s.revogado_em
        FROM mod_auth.sessoes s
        INNER JOIN mod_auth.usuarios u
            ON u.id = s.usuario_id
        WHERE s.token_hash = :token_hash
          AND s.revogado_em IS NULL
          AND s.expira_em > now()
          AND u.ativo IS true
          AND u.desativado_em IS NULL
          AND (
              u.bloqueado_ate IS NULL
              OR u.bloqueado_ate <= now()
          )
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"token_hash": token_hash}).mappings().first()

    if row is None:
        return None

    return AuthSessionRecord(**dict(row))


def revoke_session(
    session_id: int,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()

    statement = text(
        """
        UPDATE mod_auth.sessoes
        SET revogado_em = now()
        WHERE id = :session_id
          AND revogado_em IS NULL
        RETURNING id
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"session_id": session_id}).mappings().first()

    return row is not None


def revoke_user_sessions(
    usuario_id: int,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()

    statement = text(
        """
        WITH revoked_sessions AS (
            UPDATE mod_auth.sessoes
            SET revogado_em = now()
            WHERE usuario_id = :usuario_id
              AND revogado_em IS NULL
            RETURNING id
        )
        SELECT count(*) AS revoked_count
        FROM revoked_sessions
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"usuario_id": usuario_id}).mappings().one()

    return int(row["revoked_count"]) > 0
