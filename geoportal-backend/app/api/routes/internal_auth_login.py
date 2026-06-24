from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.core.client_ip import resolve_client_ip
from app.core.config import settings
from app.dependencies.auth_dependencies import clear_internal_session_cookie
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.dependencies.auth_dependencies import get_session_secret
from app.dependencies.auth_dependencies import NOT_AUTHENTICATED_DETAIL
from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import set_internal_session_cookie
from app.repositories.auth_session_repository import revoke_session
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services import auth_service


router = APIRouter(prefix='/api/internal/auth', tags=['internal-auth'])
RATE_LIMIT_DETAIL = 'Too many authentication attempts'


class InternalLoginRequest(BaseModel):
    login: str
    senha: str


class InternalLoginResponse(BaseModel):
    authenticated: bool
    usuario_id: int
    nome: str
    login: str
    expira_em: datetime
    token: str


class InternalLogoutResponse(BaseModel):
    logged_out: bool


def _raise_invalid_credentials() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=NOT_AUTHENTICATED_DETAIL,
    )


def _raise_rate_limited() -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=RATE_LIMIT_DETAIL,
    )


@router.post('/login', response_model=InternalLoginResponse)
def login(
    payload: InternalLoginRequest,
    response: Response,
    request: Request,
    session_secret: str = Depends(get_session_secret),
) -> InternalLoginResponse:
    client_ip = resolve_client_ip(request, settings.trusted_proxy_hosts)
    try:
        authenticated_session = auth_service.authenticate_user(
            login_informado=payload.login,
            password=payload.senha,
            session_secret=session_secret,
            origem='api_internal_auth_login',
            client_ip=client_ip,
            rate_limit_enabled=settings.rate_limit_enabled,
            rate_limit_max_attempts=(
                settings.internal_login_rate_limit_max_attempts
            ),
            rate_limit_ip_max_attempts=(
                settings.internal_login_rate_limit_ip_max_attempts
            ),
            rate_limit_ip_login_max_attempts=(
                settings.internal_login_rate_limit_ip_login_max_attempts
            ),
            rate_limit_window_minutes=(
                settings.internal_login_rate_limit_window_minutes
            ),
        )
    except auth_service.LoginRateLimitExceeded:
        _raise_rate_limited()

    if authenticated_session is None:
        _raise_invalid_credentials()

    set_internal_session_cookie(
        response=response,
        token=authenticated_session.token,
        expira_em=authenticated_session.expira_em,
    )

    return InternalLoginResponse(
        authenticated=True,
        usuario_id=authenticated_session.usuario_id,
        nome=authenticated_session.nome,
        login=authenticated_session.login,
        expira_em=authenticated_session.expira_em,
        token=authenticated_session.token,
    )


@router.post(
    '/logout',
    response_model=InternalLogoutResponse,
    dependencies=[Depends(require_internal_mutating_request_header)],
)
def logout(
    response: Response,
    current_session: AuthenticatedCurrentSession = Depends(
        get_current_authenticated_session
    ),
) -> InternalLogoutResponse:
    revoke_session(session_id=current_session.sessao_id)
    clear_internal_session_cookie(response)

    return InternalLogoutResponse(logged_out=True)
