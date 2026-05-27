from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.engine import Engine

from app.repositories.auth_login_audit_repository import count_recent_failed_attempts
from app.repositories.auth_login_audit_repository import record_login_attempt
from app.repositories.auth_session_repository import create_session
from app.repositories.auth_user_repository import get_auth_user_by_login
from app.repositories.auth_user_repository import record_successful_login
from app.services.auth_rate_limit_service import evaluate_login_rate_limit
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


DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15
AUTH_FAILURE_REASON = "credencial_invalida"
RATE_LIMIT_FAILURE_REASON = "rate_limit"


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


def _normalized_login(login_informado: str) -> str | None:
    normalized_login = login_informado.strip()
    return normalized_login or None


def _audit_login_failure(
    login_informado: str | None,
    origem: str | None,
    engine: Engine | None,
    usuario_id: int | None = None,
    motivo_falha: str = AUTH_FAILURE_REASON,
) -> None:
    record_login_attempt(
        usuario_id=usuario_id,
        login_informado=login_informado,
        sucesso=False,
        motivo_falha=motivo_falha,
        origem=origem,
        engine=engine,
    )


def authenticate_user(
    login_informado: str,
    password: str,
    session_secret: str,
    engine: Engine | None = None,
    now: datetime | None = None,
    session_minutes: int = DEFAULT_SESSION_DURATION_MINUTES,
    origem: str | None = None,
    rate_limit_max_attempts: int = DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    rate_limit_window_minutes: int = DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MINUTES,
) -> AuthenticatedSession | None:
    if not session_secret.strip():
        raise ValueError("session_secret must not be empty")

    current_time = _to_utc_aware(now or datetime.now(UTC))
    normalized_login = _normalized_login(login_informado)

    if normalized_login is None or not password.strip():
        _audit_login_failure(normalized_login, origem, engine)
        return None

    since = current_time - timedelta(minutes=rate_limit_window_minutes)
    failed_attempts = count_recent_failed_attempts(
        since=since,
        login_informado=normalized_login,
        origem=origem,
        engine=engine,
    )
    rate_limit_decision = evaluate_login_rate_limit(
        failed_attempts=failed_attempts,
        max_attempts=rate_limit_max_attempts,
        window_minutes=rate_limit_window_minutes,
    )
    if not rate_limit_decision.allowed:
        _audit_login_failure(
            normalized_login,
            origem,
            engine,
            motivo_falha=RATE_LIMIT_FAILURE_REASON,
        )
        return None

    user = get_auth_user_by_login(normalized_login, engine=engine)
    if user is None:
        _audit_login_failure(normalized_login, origem, engine)
        return None

    if not user.ativo or user.desativado_em is not None:
        _audit_login_failure(normalized_login, origem, engine, usuario_id=user.id)
        return None

    if _is_user_blocked(user.bloqueado_ate, current_time):
        _audit_login_failure(normalized_login, origem, engine, usuario_id=user.id)
        return None

    if not verify_password(password, user.senha_hash):
        _audit_login_failure(normalized_login, origem, engine, usuario_id=user.id)
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
    record_login_attempt(
        usuario_id=user.id,
        login_informado=normalized_login,
        sucesso=True,
        motivo_falha=None,
        origem=origem,
        engine=engine,
    )

    return AuthenticatedSession(
        usuario_id=user.id,
        nome=user.nome,
        login=user.login,
        token=token,
        expira_em=session.expira_em,
        session_id=session.id,
    )
