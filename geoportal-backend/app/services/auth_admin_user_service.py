from app.repositories.auth_admin_audit_repository import AdminAuditContext
from app.repositories.auth_admin_audit_repository import record_admin_audit_event
from app.repositories.auth_admin_security_repository import AdministrativeSecurityDeniedError
from app.repositories.auth_admin_security_repository import assign_internal_user_profile_audited
from app.repositories.auth_admin_security_repository import block_internal_user_audited
from app.repositories.auth_admin_security_repository import create_basic_internal_user_audited
from app.repositories.auth_admin_security_repository import reset_internal_user_password_audited
from app.repositories.auth_admin_security_repository import unblock_internal_user_audited
from app.repositories.auth_admin_user_repository import CreatedBasicInternalUser
from app.repositories.auth_admin_user_repository import AssignedInternalUserProfile
from app.repositories.auth_admin_user_repository import InternalUserConflictError
from app.repositories.auth_admin_user_repository import InternalUserNotFoundError
from app.repositories.auth_admin_user_repository import (
    InternalUserProfileInactiveConflictError,
)
from app.repositories.auth_admin_user_repository import InternalUserProfileNotFoundError
from app.repositories.auth_admin_user_repository import UpdatedInternalUserBlockStatus
from app.repositories.auth_admin_user_repository import UpdatedInternalUserPasswordStatus
from app.repositories.auth_admin_user_repository import assign_internal_user_profile
from app.repositories.auth_admin_user_repository import block_internal_user
from app.repositories.auth_admin_user_repository import create_basic_internal_user
from app.repositories.auth_admin_user_repository import reset_internal_user_password
from app.repositories.auth_admin_user_repository import unblock_internal_user
from app.repositories.auth_admin_user_list_repository import get_internal_admin_user_by_id
from app.security.passwords import hash_password
from app.security.passwords import validate_initial_password_policy


def _audit_context(
    *,
    ator_usuario_id: int,
    ator_login: str | None,
) -> AdminAuditContext:
    return AdminAuditContext(
        ator_usuario_id=ator_usuario_id,
        ator_login=ator_login or f'usuario:{ator_usuario_id}',
    )


def create_basic_internal_admin_user(
    *,
    login: str,
    nome: str,
    senha_inicial: str,
    email: str | None = None,
    ator_usuario_id: int | None = None,
    ator_login: str | None = None,
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
    if ator_usuario_id is not None:
        return create_basic_internal_user_audited(
            nome=normalized_nome,
            login=normalized_login,
            email=normalized_email,
            senha_hash=senha_hash,
            audit_context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
        )
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
    ator_usuario_id: int | None = None,
    ator_login: str | None = None,
) -> AssignedInternalUserProfile:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")
    if perfil_id <= 0:
        raise ValueError("perfil_id must be positive")

    normalized_modulo = modulo.strip().lower() if modulo is not None else None
    if normalized_modulo == "":
        normalized_modulo = None

    if ator_usuario_id is not None:
        return assign_internal_user_profile_audited(
            usuario_id=usuario_id,
            perfil_id=perfil_id,
            modulo=normalized_modulo,
            audit_context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
        )

    return assign_internal_user_profile(
        usuario_id=usuario_id,
        perfil_id=perfil_id,
        modulo=normalized_modulo,
    )


def block_internal_admin_user(
    *,
    usuario_id: int,
    ator_usuario_id: int | None = None,
    ator_login: str | None = None,
) -> UpdatedInternalUserBlockStatus:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")

    if ator_usuario_id is not None:
        return block_internal_user_audited(
            usuario_id=usuario_id,
            audit_context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
        )
    return block_internal_user(usuario_id=usuario_id)


def unblock_internal_admin_user(
    *,
    usuario_id: int,
    ator_usuario_id: int | None = None,
    ator_login: str | None = None,
) -> UpdatedInternalUserBlockStatus:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")

    if ator_usuario_id is not None:
        return unblock_internal_user_audited(
            usuario_id=usuario_id,
            audit_context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
        )
    return unblock_internal_user(usuario_id=usuario_id)


def reset_internal_admin_user_password(
    *,
    usuario_id: int,
    nova_senha: str,
    confirmar_nova_senha: str,
    ator_usuario_id: int | None = None,
    ator_login: str | None = None,
) -> UpdatedInternalUserPasswordStatus:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")
    if nova_senha != confirmar_nova_senha:
        raise ValueError("password does not meet policy")

    if ator_usuario_id is not None and ator_usuario_id == usuario_id:
        record_admin_audit_event(
            context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
            acao='admin.security.denied_self_change',
            entidade_tipo='usuario',
            entidade_id=usuario_id,
            resultado='negada',
            motivo='self_password_reset',
            resumo='Reset administrativo da propria senha foi negado.',
        )
        raise AdministrativeSecurityDeniedError('administrative action denied')

    user = get_internal_admin_user_by_id(usuario_id=usuario_id)
    if user is None:
        raise InternalUserNotFoundError("internal user was not found")

    validate_initial_password_policy(
        nova_senha,
        login=user.login,
        nome=user.nome,
    )

    senha_hash = hash_password(nova_senha)
    if ator_usuario_id is not None:
        return reset_internal_user_password_audited(
            usuario_id=usuario_id,
            senha_hash=senha_hash,
            audit_context=_audit_context(
                ator_usuario_id=ator_usuario_id,
                ator_login=ator_login,
            ),
        )
    return reset_internal_user_password(
        usuario_id=usuario_id,
        senha_hash=senha_hash,
    )


__all__ = [
    'AdministrativeSecurityDeniedError',
    "AssignedInternalUserProfile",
    "InternalUserConflictError",
    "InternalUserNotFoundError",
    "InternalUserProfileInactiveConflictError",
    "InternalUserProfileNotFoundError",
    "UpdatedInternalUserBlockStatus",
    "UpdatedInternalUserPasswordStatus",
    "assign_internal_admin_user_profile",
    "block_internal_admin_user",
    "create_basic_internal_admin_user",
    "reset_internal_admin_user_password",
    "unblock_internal_admin_user",
]
