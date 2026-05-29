from app.repositories.auth_admin_user_repository import CreatedBasicInternalUser
from app.repositories.auth_admin_user_repository import AssignedInternalUserProfile
from app.repositories.auth_admin_user_repository import InternalUserConflictError
from app.repositories.auth_admin_user_repository import (
    InternalUserProfileInactiveConflictError,
)
from app.repositories.auth_admin_user_repository import InternalUserProfileNotFoundError
from app.repositories.auth_admin_user_repository import assign_internal_user_profile
from app.repositories.auth_admin_user_repository import create_basic_internal_user
from app.security.passwords import hash_password
from app.security.passwords import validate_initial_password_policy


def create_basic_internal_admin_user(
    *,
    login: str,
    nome: str,
    senha_inicial: str,
    email: str | None = None,
) -> CreatedBasicInternalUser:
    normalized_login = login.strip().lower()
    normalized_nome = nome.strip()
    normalized_email = email.strip().lower() if email is not None else None
    if normalized_email == "":
        normalized_email = None

    if not normalized_login:
        raise ValueError("login must not be empty")
    if not normalized_nome:
        raise ValueError("nome must not be empty")
    validate_initial_password_policy(
        senha_inicial,
        login=normalized_login,
        nome=normalized_nome,
    )

    senha_hash = hash_password(senha_inicial)
    return create_basic_internal_user(
        nome=normalized_nome,
        login=normalized_login,
        email=normalized_email,
        senha_hash=senha_hash,
    )


def assign_internal_admin_user_profile(
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None = None,
) -> AssignedInternalUserProfile:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")
    if perfil_id <= 0:
        raise ValueError("perfil_id must be positive")

    normalized_modulo = modulo.strip().lower() if modulo is not None else None
    if normalized_modulo == "":
        normalized_modulo = None

    return assign_internal_user_profile(
        usuario_id=usuario_id,
        perfil_id=perfil_id,
        modulo=normalized_modulo,
    )


__all__ = [
    "AssignedInternalUserProfile",
    "InternalUserConflictError",
    "InternalUserProfileInactiveConflictError",
    "InternalUserProfileNotFoundError",
    "assign_internal_admin_user_profile",
    "create_basic_internal_admin_user",
]
