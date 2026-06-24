from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.strip():
        return None
    return value


def record_login_attempt(
    sucesso: bool,
    usuario_id: int | None = None,
    login_informado: str | None = None,
    motivo_falha: str | None = None,
    origem: str | None = None,
    engine: Engine | None = None,
) -> int:
    db_engine = engine or get_engine()

    statement = text(
        """
        INSERT INTO mod_auth.login_auditoria (
            usuario_id,
            login_informado,
            sucesso,
            motivo_falha,
            origem
        )
        VALUES (
            :usuario_id,
            :login_informado,
            :sucesso,
            :motivo_falha,
            :origem
        )
        RETURNING id
        """
    )

    params = {
        "usuario_id": usuario_id,
        "login_informado": _blank_to_none(login_informado),
        "sucesso": sucesso,
        "motivo_falha": _blank_to_none(motivo_falha),
        "origem": _blank_to_none(origem),
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().one()

    return int(row["id"])


def count_recent_failed_attempts(
    since: datetime,
    login_informado: str | None = None,
    origem: str | None = None,
    engine: Engine | None = None,
) -> int:
    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT count(*) AS failed_count
        FROM mod_auth.login_auditoria
        WHERE sucesso IS false
          AND criado_em >= :since
          AND (
              CAST(:login_informado AS text) IS NULL
              OR login_informado = CAST(:login_informado AS text)
          )
          AND (
              CAST(:origem AS text) IS NULL
              OR origem = CAST(:origem AS text)
          )
        """
    )

    params = {
        "since": since,
        "login_informado": _blank_to_none(login_informado),
        "origem": _blank_to_none(origem),
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().one()

    return int(row["failed_count"])


def count_recent_failed_attempts_by_origin_scope(
    since: datetime,
    origem_scope: str,
    login_informado: str | None = None,
    engine: Engine | None = None,
) -> int:
    normalized_scope = _blank_to_none(origem_scope)
    if normalized_scope is None:
        raise ValueError('origem_scope must not be empty')

    db_engine = engine or get_engine()
    statement = text(
        '''
        SELECT count(*) AS failed_count
        FROM mod_auth.login_auditoria
        WHERE sucesso IS false
          AND criado_em >= :since
          AND (
              CAST(:login_informado AS text) IS NULL
              OR login_informado = CAST(:login_informado AS text)
          )
          AND (
              origem = :origem_scope
              OR origem LIKE :origem_scope_prefix
          )
        '''
    )
    params = {
        'since': since,
        'login_informado': _blank_to_none(login_informado),
        'origem_scope': normalized_scope,
        'origem_scope_prefix': f'{normalized_scope}|%',
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().one()

    return int(row['failed_count'])
