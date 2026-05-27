from fastapi import APIRouter, Depends

from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.services.auth_current_session_service import AuthenticatedCurrentSession


router = APIRouter(prefix="/api/internal/auth", tags=["internal-auth"])


@router.get("/smoke")
def auth_smoke(
    current_session: AuthenticatedCurrentSession = Depends(
        get_current_authenticated_session
    ),
) -> dict[str, bool | int]:
    return {
        "authenticated": True,
        "usuario_id": current_session.usuario_id,
        "sessao_id": current_session.sessao_id,
    }
