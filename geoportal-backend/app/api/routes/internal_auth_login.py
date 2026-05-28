from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies.auth_dependencies import get_session_secret
from app.dependencies.auth_dependencies import NOT_AUTHENTICATED_DETAIL
from app.services import auth_service


router = APIRouter(prefix="/api/internal/auth", tags=["internal-auth"])


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


def _raise_invalid_credentials() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=NOT_AUTHENTICATED_DETAIL,
    )


@router.post("/login", response_model=InternalLoginResponse)
def login(
    payload: InternalLoginRequest,
    session_secret: str = Depends(get_session_secret),
) -> InternalLoginResponse:
    authenticated_session = auth_service.authenticate_user(
        login_informado=payload.login,
        password=payload.senha,
        session_secret=session_secret,
        origem="api_internal_auth_login",
    )

    if authenticated_session is None:
        _raise_invalid_credentials()

    return InternalLoginResponse(
        authenticated=True,
        usuario_id=authenticated_session.usuario_id,
        nome=authenticated_session.nome,
        login=authenticated_session.login,
        expira_em=authenticated_session.expira_em,
        token=authenticated_session.token,
    )
