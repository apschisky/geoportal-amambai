from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.engine import Engine

from app.repositories.auth_session_repository import create_session
from app.repositories.auth_user_repository import get_auth_user_by_login
from app.repositories.auth_user_repository import record_successful_login
from app.security.passwords import verify_password
from app.security.sessions import DEFAULT_SESSION_DURATION_MINUTES
from app.security.sessions import build_session_expiration
from app.security.sessions import generate_session_token
from app.security.sessions import hash_session_token


@dataclass(frozen=True)
class AuthenticatedSession:
    usuario_id: int
    nome: str
    login: str
    token: str
    expira_em: datetime
    session_id: int


def _to_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def _is_user_blocked(
    bloqueado_ate: datetime | None,
    now: datetime,
) -> bool:
    if bloqueado_ate is None:
        return False

    return _to_utc_aware(bloqueado_ate) > _to_utc_aware(now)


def authenticate_user(
    login_informado: str,
    password: str,
    session_secret: str,
    engine: Engine | None = None,
    now: datetime | None = None,
    session_minutes: int = DEFAULT_SESSION_DURATION_MINUTES,
) -> AuthenticatedSession | None:
    if not session_secret.strip():
        raise ValueError("session_secret must not be empty")

    current_time = _to_utc_aware(now or datetime.now(UTC))

    if not login_informado.strip() or not password.strip():
        return None

    user = get_auth_user_by_login(login_informado, engine=engine)
    if user is None:
        return None

    if not user.ativo or user.desativado_em is not None:
        return None

    if _is_user_blocked(user.bloqueado_ate, current_time):
        return None

    if not verify_password(password, user.senha_hash):
        return None

    token = generate_session_token()
    token_hash = hash_session_token(token, session_secret)
    expira_em = build_session_expiration(
        now=current_time,
        minutes=session_minutes,
    )
    session = create_session(
        usuario_id=user.id,
        token_hash=token_hash,
        expira_em=expira_em,
        engine=engine,
    )

    # Best effort: the session is already created, so a missed timestamp update
    # must not expose a different authentication result.
    record_successful_login(user.id, engine=engine)

    return AuthenticatedSession(
        usuario_id=user.id,
        nome=user.nome,
        login=user.login,
        token=token,
        expira_em=session.expira_em,
        session_id=session.id,
    )
