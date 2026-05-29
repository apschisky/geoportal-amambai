from app.repositories.auth_admin_user_repository import CreatedBasicInternalUser
from app.repositories.auth_admin_user_repository import InternalUserConflictError
from app.repositories.auth_admin_user_repository import create_basic_internal_user
from app.security.passwords import hash_password


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
    if not senha_inicial.strip():
        raise ValueError("senha_inicial must not be empty")

    senha_hash = hash_password(senha_inicial)
    return create_basic_internal_user(
        nome=normalized_nome,
        login=normalized_login,
        email=normalized_email,
        senha_hash=senha_hash,
    )


__all__ = [
    "InternalUserConflictError",
    "create_basic_internal_admin_user",
]
