from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import hmac

from sqlalchemy.engine import Engine

from app.repositories.auth_login_audit_repository import count_recent_failed_attempts
from app.repositories.auth_login_audit_repository import (
    count_recent_failed_attempts_by_origin_scope,
)
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
DEFAULT_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS = 20
DEFAULT_LOGIN_RATE_LIMIT_IP_LOGIN_MAX_ATTEMPTS = 5
DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15
AUTH_FAILURE_REASON = 'credencial_invalida'
RATE_LIMIT_FAILURE_REASON = 'rate_limit'
RATE_LIMIT_IP_FAILURE_REASON = 'rate_limit_ip'
RATE_LIMIT_IP_LOGIN_FAILURE_REASON = 'rate_limit_ip_login'


class LoginRateLimitExceeded(Exception):
    pass


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


def _build_audit_origin(
    origem: str | None,
    client_ip: str | None,
    session_secret: str,
) -> str | None:
    if origem is None or not origem.strip():
        return None

    normalized_origin = origem.strip()
    if client_ip is None or not client_ip.strip():
        return normalized_origin

    ip_digest = hmac.new(
        session_secret.encode('utf-8'),
        client_ip.strip().encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()[:32]
    return f'{normalized_origin}|ip={ip_digest}'


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


def _evaluate_or_raise_rate_limit(
    *,
    failed_attempts: int,
    max_attempts: int,
    window_minutes: int,
    login_informado: str | None,
    audit_origin: str | None,
    engine: Engine | None,
    failure_reason: str,
) -> None:
    decision = evaluate_login_rate_limit(
        failed_attempts=failed_attempts,
        max_attempts=max_attempts,
        window_minutes=window_minutes,
    )
    if decision.allowed:
        return

    _audit_login_failure(
        login_informado,
        audit_origin,
        engine,
        motivo_falha=failure_reason,
    )
    raise LoginRateLimitExceeded


def authenticate_user(
    login_informado: str,
    password: str,
    session_secret: str,
    engine: Engine | None = None,
    now: datetime | None = None,
    session_minutes: int = DEFAULT_SESSION_DURATION_MINUTES,
    origem: str | None = None,
    client_ip: str | None = None,
    rate_limit_enabled: bool = True,
    rate_limit_max_attempts: int = DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    rate_limit_ip_max_attempts: int = DEFAULT_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS,
    rate_limit_ip_login_max_attempts: int = (
        DEFAULT_LOGIN_RATE_LIMIT_IP_LOGIN_MAX_ATTEMPTS
    ),
    rate_limit_window_minutes: int = DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MINUTES,
) -> AuthenticatedSession | None:
    if not session_secret.strip():
        raise ValueError('session_secret must not be empty')

    current_time = _to_utc_aware(now or datetime.now(UTC))
    normalized_login = _normalized_login(login_informado)
    audit_origin = _build_audit_origin(origem, client_ip, session_secret)
    since = current_time - timedelta(minutes=rate_limit_window_minutes)

    if rate_limit_enabled and client_ip and audit_origin:
        failed_by_ip = count_recent_failed_attempts(
            since=since,
            login_informado=None,
            origem=audit_origin,
            engine=engine,
        )
        _evaluate_or_raise_rate_limit(
            failed_attempts=failed_by_ip,
            max_attempts=rate_limit_ip_max_attempts,
            window_minutes=rate_limit_window_minutes,
            login_informado=normalized_login,
            audit_origin=audit_origin,
            engine=engine,
            failure_reason=RATE_LIMIT_IP_FAILURE_REASON,
        )

    if normalized_login is None or not password.strip():
        _audit_login_failure(normalized_login, audit_origin, engine)
        return None

    if rate_limit_enabled:
        if origem and origem.strip():
            failed_by_login = count_recent_failed_attempts_by_origin_scope(
                since=since,
                login_informado=normalized_login,
                origem_scope=origem.strip(),
                engine=engine,
            )
        else:
            failed_by_login = count_recent_failed_attempts(
                since=since,
                login_informado=normalized_login,
                origem=None,
                engine=engine,
            )
        _evaluate_or_raise_rate_limit(
            failed_attempts=failed_by_login,
            max_attempts=rate_limit_max_attempts,
            window_minutes=rate_limit_window_minutes,
            login_informado=normalized_login,
            audit_origin=audit_origin,
            engine=engine,
            failure_reason=RATE_LIMIT_FAILURE_REASON,
        )

        if client_ip and audit_origin:
            failed_by_ip_login = count_recent_failed_attempts(
                since=since,
                login_informado=normalized_login,
                origem=audit_origin,
                engine=engine,
            )
            _evaluate_or_raise_rate_limit(
                failed_attempts=failed_by_ip_login,
                max_attempts=rate_limit_ip_login_max_attempts,
                window_minutes=rate_limit_window_minutes,
                login_informado=normalized_login,
                audit_origin=audit_origin,
                engine=engine,
                failure_reason=RATE_LIMIT_IP_LOGIN_FAILURE_REASON,
            )

    user = get_auth_user_by_login(normalized_login, engine=engine)
    if user is None:
        _audit_login_failure(normalized_login, audit_origin, engine)
        return None

    if not user.ativo or user.desativado_em is not None:
        _audit_login_failure(
            normalized_login, audit_origin, engine, usuario_id=user.id
        )
        return None

    if _is_user_blocked(user.bloqueado_ate, current_time):
        _audit_login_failure(
            normalized_login, audit_origin, engine, usuario_id=user.id
        )
        return None

    if not verify_password(password, user.senha_hash):
        _audit_login_failure(
            normalized_login, audit_origin, engine, usuario_id=user.id
        )
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

    # The session already exists, so this timestamp remains best effort.
    try:
        record_successful_login(user.id, engine=engine)
    except Exception:
        pass

    record_login_attempt(
        usuario_id=user.id,
        login_informado=normalized_login,
        sucesso=True,
        motivo_falha=None,
        origem=audit_origin,
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
