from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator

from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import require_permission
from app.repositories.auth_admin_user_list_repository import (
    InternalAdminUserListItem,
    get_internal_admin_user_by_id,
    list_internal_admin_users,
)
from app.services.auth_admin_user_service import InternalUserConflictError
from app.services.auth_admin_user_service import create_basic_internal_admin_user
from app.services.auth_current_session_service import AuthenticatedCurrentSession


LIST_INTERNAL_USERS_PERMISSION = "admin.usuarios.ler"
CREATE_INTERNAL_USERS_PERMISSION = "admin.usuarios.criar"

router = APIRouter(prefix="/api/internal/admin", tags=["internal-admin"])


def _is_valid_optional_email(value: str | None) -> bool:
    if value is None:
        return True
    if "@" not in value:
        return False
    local_part, domain = value.split("@", maxsplit=1)
    return bool(local_part) and "." in domain and not value.endswith(".")


class CreateInternalAdminUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    login: str
    nome: str
    email: str | None = None
    senha_inicial: str

    @field_validator("login", "nome", mode="before")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Invalid value")
        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("Invalid value")
        return normalized_value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_optional_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Invalid value")
        normalized_value = value.strip().lower()
        if not normalized_value:
            return None
        if not _is_valid_optional_email(normalized_value):
            raise ValueError("Invalid value")
        return normalized_value

    @field_validator("senha_inicial")
    @classmethod
    def validate_initial_password(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Invalid value")
        return value


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


class InternalAdminUserDetailResponse(BaseModel):
    usuario: InternalAdminUserResponse


def _to_user_response(user: InternalAdminUserListItem) -> InternalAdminUserResponse:
    return InternalAdminUserResponse(
        id=user.id,
        login=user.login,
        nome=user.nome,
        email=user.email,
        ativo=user.ativo,
        bloqueado=user.bloqueado,
        criado_em=user.criado_em,
    )


@router.get("/users", response_model=InternalAdminUsersResponse)
def list_users(
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_USERS_PERMISSION)
    ),
) -> InternalAdminUsersResponse:
    users = list_internal_admin_users()

    return InternalAdminUsersResponse(
        usuarios=[_to_user_response(user) for user in users],
    )


@router.post(
    "/users",
    response_model=InternalAdminUserDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: CreateInternalAdminUserRequest,
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(CREATE_INTERNAL_USERS_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalAdminUserDetailResponse:
    try:
        user = create_basic_internal_admin_user(
            login=payload.login,
            nome=payload.nome,
            email=payload.email,
            senha_inicial=payload.senha_inicial,
        )
    except InternalUserConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict",
        ) from exc

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))


@router.get("/users/{usuario_id}", response_model=InternalAdminUserDetailResponse)
def get_user_detail(
    usuario_id: int,
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_USERS_PERMISSION)
    ),
) -> InternalAdminUserDetailResponse:
    user = get_internal_admin_user_by_id(usuario_id=usuario_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))
