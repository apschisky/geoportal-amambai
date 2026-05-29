from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies.auth_dependencies import require_permission
from app.repositories.auth_admin_profile_repository import (
    InternalAdminProfileListItem,
    list_internal_admin_profiles,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession


LIST_INTERNAL_PROFILES_PERMISSION = "admin.perfis.ler"

router = APIRouter(prefix="/api/internal/admin", tags=["internal-admin"])


class InternalAdminProfileResponse(BaseModel):
    id: int
    chave: str
    nome: str
    ativo: bool
    criado_em: datetime


class InternalAdminProfilesResponse(BaseModel):
    perfis: list[InternalAdminProfileResponse]


def _to_profile_response(
    profile: InternalAdminProfileListItem,
) -> InternalAdminProfileResponse:
    return InternalAdminProfileResponse(
        id=profile.id,
        chave=profile.chave,
        nome=profile.nome,
        ativo=profile.ativo,
        criado_em=profile.criado_em,
    )


@router.get("/profiles", response_model=InternalAdminProfilesResponse)
def list_profiles(
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_PROFILES_PERMISSION)
    ),
) -> InternalAdminProfilesResponse:
    profiles = list_internal_admin_profiles()

    return InternalAdminProfilesResponse(
        perfis=[_to_profile_response(profile) for profile in profiles],
    )
