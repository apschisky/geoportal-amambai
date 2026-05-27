from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.engine import Engine

from app.repositories.auth_session_repository import get_active_session_by_token_hash
from app.security.sessions import hash_session_token


@dataclass(frozen=True)
class AuthenticatedCurrentSession:
    usuario_id: int
    sessao_id: int
    expira_em: datetime


def resolve_authenticated_session(
    token: str,
    session_secret: str,
    engine: Engine | None = None,
    now: datetime | None = None,
) -> AuthenticatedCurrentSession | None:
    if not isinstance(session_secret, str) or not session_secret.strip():
        raise ValueError("session_secret must not be empty")

    if not isinstance(token, str) or not token.strip():
        return None

    token_hash = hash_session_token(token, session_secret)
    session = get_active_session_by_token_hash(token_hash, engine=engine)
    if session is None:
        return None

    return AuthenticatedCurrentSession(
        usuario_id=session.usuario_id,
        sessao_id=session.id,
        expira_em=session.expira_em,
    )
