from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.auth_permission_service import get_user_permissions


router = APIRouter(prefix="/api/internal/auth", tags=["internal-auth"])


class InternalMeResponse(BaseModel):
    authenticated: bool
    usuario_id: int
    permissoes: list[str]


@router.get("/me", response_model=InternalMeResponse)
def me(
    current_session: AuthenticatedCurrentSession = Depends(
        get_current_authenticated_session
    ),
) -> InternalMeResponse:
    permissions = get_user_permissions(current_session.usuario_id)

    return InternalMeResponse(
        authenticated=True,
        usuario_id=current_session.usuario_id,
        permissoes=sorted(permissions),
    )
