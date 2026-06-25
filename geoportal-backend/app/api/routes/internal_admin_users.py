from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import require_permission
from app.repositories.auth_admin_user_list_repository import (
    InternalAdminUserListItem,
    get_internal_admin_user_by_id,
    list_internal_admin_users,
)
from app.services.auth_admin_user_service import CreatedBasicInternalUser
from app.services.auth_admin_user_service import AdministrativeSecurityDeniedError
from app.services.auth_admin_user_service import InternalUserConflictError
from app.services.auth_admin_user_service import InternalUserNotFoundError
from app.services.auth_admin_user_service import InternalUserProfileInactiveConflictError
from app.services.auth_admin_user_service import InternalUserProfileNotFoundError
from app.services.auth_admin_user_service import InternalAdminUserProfileLink
from app.services.auth_admin_user_service import (
    InternalUserProfileLinkInactiveConflictError,
)
from app.services.auth_admin_user_service import (
    InternalUserProfileLinkNotFoundError,
)
from app.services.auth_admin_user_service import AssignedInternalUserProfile
from app.services.auth_admin_user_service import UpdatedInternalUserBlockStatus
from app.services.auth_admin_user_service import UpdatedInternalUserPasswordStatus
from app.services.auth_admin_user_service import assign_internal_admin_user_profile
from app.services.auth_admin_user_service import block_internal_admin_user
from app.services.auth_admin_user_service import create_basic_internal_admin_user
from app.services.auth_admin_user_service import deactivate_internal_admin_user_profile
from app.services.auth_admin_user_service import list_internal_admin_user_profiles
from app.services.auth_admin_user_service import reset_internal_admin_user_password
from app.services.auth_admin_user_service import unblock_internal_admin_user
from app.services.auth_current_session_service import AuthenticatedCurrentSession


LIST_INTERNAL_USERS_PERMISSION = "admin.usuarios.ler"
CREATE_INTERNAL_USERS_PERMISSION = "admin.usuarios.criar"
ASSIGN_INTERNAL_USER_PROFILE_PERMISSION = "admin.usuarios.atribuir_perfis"
BLOCK_INTERNAL_USERS_PERMISSION = "admin.usuarios.bloquear"
RESET_INTERNAL_USER_PASSWORD_PERMISSION = "admin.usuarios.redefinir_senha"
INVALID_CREATE_USER_PAYLOAD_DETAIL = "Invalid payload"
INVALID_ASSIGN_PROFILE_PAYLOAD_DETAIL = "Invalid payload"
INVALID_RESET_PASSWORD_PAYLOAD_DETAIL = "Invalid payload"

router = APIRouter(prefix="/api/internal/admin", tags=["internal-admin"])


REMOVE_INTERNAL_USER_PROFILE_PERMISSION = 'admin.usuarios.remover_perfis'
INVALID_DEACTIVATE_PROFILE_PAYLOAD_DETAIL = 'Invalid payload'


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


class AssignInternalUserProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    perfil_id: int
    modulo: str | None = None

    @field_validator("perfil_id")
    @classmethod
    def validate_positive_profile_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Invalid value")
        return value

    @field_validator("modulo", mode="before")
    @classmethod
    def normalize_optional_module(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Invalid value")
        normalized_value = value.strip().lower()
        return normalized_value or None


class ResetInternalUserPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nova_senha: str
    confirmar_nova_senha: str

    @field_validator("nova_senha", "confirmar_nova_senha", mode="before")
    @classmethod
    def validate_required_password(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Invalid value")
        if not value.strip():
            raise ValueError("Invalid value")
        return value


class DeactivateInternalUserProfileRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    modulo: str | None = None
    justificativa: str

    @field_validator('modulo', mode='before')
    @classmethod
    def normalize_optional_module(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError('Invalid value')
        normalized_value = value.strip().lower()
        if len(normalized_value) > 80:
            raise ValueError('Invalid value')
        return normalized_value or None

    @field_validator('justificativa', mode='before')
    @classmethod
    def validate_justification(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError('Invalid value')
        normalized_value = value.strip()
        if not 10 <= len(normalized_value) <= 1000:
            raise ValueError('Invalid value')
        return normalized_value


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


class InternalUserProfileAssignmentResponse(BaseModel):
    usuario_id: int
    perfil_id: int
    modulo: str | None
    ativo: bool


class InternalUserProfileAssignmentEnvelope(BaseModel):
    vinculo: InternalUserProfileAssignmentResponse


class InternalAdminUserProfileLinkResponse(BaseModel):
    perfil_id: int
    chave: str
    nome: str
    modulo: str | None
    ativo: bool
    criado_em: datetime


class InternalAdminUserProfilesResponse(BaseModel):
    vinculos: list[InternalAdminUserProfileLinkResponse]


class InternalAdminUserProfileLinkEnvelope(BaseModel):
    vinculo: InternalAdminUserProfileLinkResponse


def _to_user_response(
    user: (
        InternalAdminUserListItem
        | CreatedBasicInternalUser
        | UpdatedInternalUserBlockStatus
        | UpdatedInternalUserPasswordStatus
    ),
) -> InternalAdminUserResponse:
    return InternalAdminUserResponse(
        id=user.id,
        login=user.login,
        nome=user.nome,
        email=user.email,
        ativo=user.ativo,
        bloqueado=user.bloqueado,
        criado_em=user.criado_em,
    )


def _to_profile_assignment_response(
    assignment: AssignedInternalUserProfile,
) -> InternalUserProfileAssignmentResponse:
    return InternalUserProfileAssignmentResponse(
        usuario_id=assignment.usuario_id,
        perfil_id=assignment.perfil_id,
        modulo=assignment.modulo,
        ativo=assignment.ativo,
    )


def _to_user_profile_link_response(
    link: InternalAdminUserProfileLink,
) -> InternalAdminUserProfileLinkResponse:
    return InternalAdminUserProfileLinkResponse(
        perfil_id=link.perfil_id,
        chave=link.chave,
        nome=link.nome,
        modulo=link.modulo,
        ativo=link.ativo,
        criado_em=link.criado_em,
    )


def _parse_assign_profile_payload(
    payload: object,
) -> AssignInternalUserProfileRequest:
    if not isinstance(payload, dict):
        raise ValueError("Invalid payload")
    try:
        return AssignInternalUserProfileRequest.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("Invalid payload") from exc


def _parse_deactivate_profile_payload(
    payload: object,
) -> DeactivateInternalUserProfileRequest:
    if not isinstance(payload, dict):
        raise ValueError('Invalid payload')
    try:
        return DeactivateInternalUserProfileRequest.model_validate(payload)
    except ValidationError as exc:
        raise ValueError('Invalid payload') from exc


def _parse_reset_password_payload(
    payload: object,
) -> ResetInternalUserPasswordRequest:
    if not isinstance(payload, dict):
        raise ValueError("Invalid payload")
    try:
        return ResetInternalUserPasswordRequest.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("Invalid payload") from exc


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
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except InternalUserConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=INVALID_CREATE_USER_PAYLOAD_DETAIL,
        ) from exc

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))


@router.get(
    '/users/{usuario_id}/profiles',
    response_model=InternalAdminUserProfilesResponse,
)
def list_user_profiles(
    usuario_id: int,
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_USERS_PERMISSION)
    ),
) -> InternalAdminUserProfilesResponse:
    try:
        links = list_internal_admin_user_profiles(usuario_id=usuario_id)
    except InternalUserProfileLinkNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Not found',
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail='Invalid payload') from exc

    return InternalAdminUserProfilesResponse(
        vinculos=[_to_user_profile_link_response(link) for link in links]
    )


@router.post(
    '/users/{usuario_id}/profiles/{perfil_id}/deactivate',
    response_model=InternalAdminUserProfileLinkEnvelope,
)
def deactivate_user_profile(
    usuario_id: int,
    perfil_id: int,
    payload: object = Body(...),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(REMOVE_INTERNAL_USER_PROFILE_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalAdminUserProfileLinkEnvelope:
    try:
        parsed_payload = _parse_deactivate_profile_payload(payload)
        link = deactivate_internal_admin_user_profile(
            usuario_id=usuario_id,
            perfil_id=perfil_id,
            modulo=parsed_payload.modulo,
            justificativa=parsed_payload.justificativa,
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except AdministrativeSecurityDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Forbidden',
        ) from exc
    except InternalUserProfileLinkNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Not found',
        ) from exc
    except InternalUserProfileLinkInactiveConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Conflict',
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=INVALID_DEACTIVATE_PROFILE_PAYLOAD_DETAIL,
        ) from exc

    return InternalAdminUserProfileLinkEnvelope(
        vinculo=_to_user_profile_link_response(link)
    )


@router.post(
    "/users/{usuario_id}/block",
    response_model=InternalAdminUserDetailResponse,
)
def block_user(
    usuario_id: int,
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(BLOCK_INTERNAL_USERS_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalAdminUserDetailResponse:
    try:
        user = block_internal_admin_user(
            usuario_id=usuario_id,
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except AdministrativeSecurityDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Forbidden',
        ) from exc
    except InternalUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid payload",
        ) from exc

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))


@router.post(
    "/users/{usuario_id}/unblock",
    response_model=InternalAdminUserDetailResponse,
)
def unblock_user(
    usuario_id: int,
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(BLOCK_INTERNAL_USERS_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalAdminUserDetailResponse:
    try:
        user = unblock_internal_admin_user(
            usuario_id=usuario_id,
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except InternalUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid payload",
        ) from exc

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))


@router.post(
    "/users/{usuario_id}/reset-password",
    response_model=InternalAdminUserDetailResponse,
)
def reset_user_password(
    usuario_id: int,
    payload: object = Body(...),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(RESET_INTERNAL_USER_PASSWORD_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalAdminUserDetailResponse:
    try:
        parsed_payload = _parse_reset_password_payload(payload)
        user = reset_internal_admin_user_password(
            usuario_id=usuario_id,
            nova_senha=parsed_payload.nova_senha,
            confirmar_nova_senha=parsed_payload.confirmar_nova_senha,
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except AdministrativeSecurityDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Forbidden',
        ) from exc
    except InternalUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=INVALID_RESET_PASSWORD_PAYLOAD_DETAIL,
        ) from exc

    return InternalAdminUserDetailResponse(usuario=_to_user_response(user))


@router.post(
    "/users/{usuario_id}/profiles",
    response_model=InternalUserProfileAssignmentEnvelope,
    status_code=status.HTTP_201_CREATED,
)
def assign_user_profile(
    usuario_id: int,
    response: Response,
    payload: object = Body(...),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(ASSIGN_INTERNAL_USER_PROFILE_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> InternalUserProfileAssignmentEnvelope:
    try:
        parsed_payload = _parse_assign_profile_payload(payload)
        assignment = assign_internal_admin_user_profile(
            usuario_id=usuario_id,
            perfil_id=parsed_payload.perfil_id,
            modulo=parsed_payload.modulo,
            ator_usuario_id=_current_session.usuario_id,
            ator_login=_current_session.login,
        )
    except AdministrativeSecurityDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Forbidden',
        ) from exc
    except InternalUserProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except InternalUserProfileInactiveConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=INVALID_ASSIGN_PROFILE_PAYLOAD_DETAIL,
        ) from exc

    if not assignment.created:
        response.status_code = status.HTTP_200_OK

    return InternalUserProfileAssignmentEnvelope(
        vinculo=_to_profile_assignment_response(assignment),
    )


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
