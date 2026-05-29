from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies.auth_dependencies import require_permission
from app.services.auth_current_session_service import AuthenticatedCurrentSession


INTERNAL_AUTH_ME_PERMISSION = "internal.auth.me"

router = APIRouter(prefix="/api/internal/auth", tags=["internal-auth"])


class InternalPermissionSmokeResponse(BaseModel):
    authorized: bool
    permission: str
    usuario_id: int


@router.get("/permission-smoke", response_model=InternalPermissionSmokeResponse)
def permission_smoke(
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(INTERNAL_AUTH_ME_PERMISSION)
    ),
) -> InternalPermissionSmokeResponse:
    return InternalPermissionSmokeResponse(
        authorized=True,
        permission=INTERNAL_AUTH_ME_PERMISSION,
        usuario_id=current_session.usuario_id,
    )
