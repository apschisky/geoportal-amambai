from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine


def generate_protocol(prefix: str, year: int, sequence: int) -> str:
    normalized_prefix = prefix.strip().upper()

    if not normalized_prefix:
        raise ValueError("prefix must not be empty")

    if year < 1000 or year > 9999:
        raise ValueError("year must have 4 digits")

    if sequence <= 0:
        raise ValueError("sequence must be greater than zero")

    return f"{normalized_prefix}-{year}-{sequence:06d}"


def generate_protocol_from_database(engine: Engine | None = None) -> str:
    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            'IP-' || EXTRACT(YEAR FROM now())::int || '-' ||
            lpad(
                nextval('mod_iluminacao.solicitacoes_protocolo_seq')::text,
                6,
                '0'
            ) AS protocolo
        """
    )

    with db_engine.connect() as connection:
        return str(connection.execute(statement).scalar_one())
