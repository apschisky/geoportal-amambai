from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type


_PASSWORD_HASHER = PasswordHasher(type=Type.ID)
_COMMON_INTERNAL_PASSWORDS = frozenset(
    {
        "123456",
        "12345678",
        "123456789",
        "senha",
        "senha123",
        "admin",
        "admin123",
        "password",
        "password123",
    }
)


class PasswordPolicyError(ValueError):
    pass


def validate_initial_password_policy(
    password: str,
    *,
    login: str,
    nome: str,
) -> None:
    if not isinstance(password, str):
        raise PasswordPolicyError("password does not meet policy")

    normalized_password = password.strip()
    normalized_password_lower = normalized_password.lower()
    normalized_login = login.strip().lower()
    normalized_nome = nome.strip().lower()

    if not normalized_password:
        raise PasswordPolicyError("password does not meet policy")
    if len(normalized_password) < 6:
        raise PasswordPolicyError("password does not meet policy")
    if len(normalized_password) > 128:
        raise PasswordPolicyError("password does not meet policy")
    if not any(character.isalpha() for character in normalized_password):
        raise PasswordPolicyError("password does not meet policy")
    if not any(character.isdigit() for character in normalized_password):
        raise PasswordPolicyError("password does not meet policy")
    if normalized_password_lower in _COMMON_INTERNAL_PASSWORDS:
        raise PasswordPolicyError("password does not meet policy")
    if normalized_login and normalized_password_lower == normalized_login:
        raise PasswordPolicyError("password does not meet policy")
    if normalized_nome and normalized_password_lower == normalized_nome:
        raise PasswordPolicyError("password does not meet policy")


def hash_password(password: str) -> str:
    if not password.strip():
        raise ValueError("password must not be empty")

    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (
        InvalidHashError,
        VerificationError,
        VerifyMismatchError,
        TypeError,
        ValueError,
    ):
        return False
