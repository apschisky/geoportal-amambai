from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies.auth_dependencies import require_permission
from app.repositories.auth_admin_user_list_repository import list_internal_admin_users
from app.services.auth_current_session_service import AuthenticatedCurrentSession


LIST_INTERNAL_USERS_PERMISSION = "admin.usuarios.ler"

router = APIRouter(prefix="/api/internal/admin", tags=["internal-admin"])


class InternalAdminUserResponse(BaseModel):
    id: int
    login: str
    nome: str
    email: str | None
    ativo: bool
    bloqueado: bool
    criado_em: datetime


class InternalAdminUsersResponse(BaseModel):
    usuarios: list[InternalAdminUserResponse]


@router.get("/users", response_model=InternalAdminUsersResponse)
def list_users(
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_USERS_PERMISSION)
    ),
) -> InternalAdminUsersResponse:
    users = list_internal_admin_users()

    return InternalAdminUsersResponse(
        usuarios=[
            InternalAdminUserResponse(
                id=user.id,
                login=user.login,
                nome=user.nome,
                email=user.email,
                ativo=user.ativo,
                bloqueado=user.bloqueado,
                criado_em=user.criado_em,
            )
            for user in users
        ],
    )
