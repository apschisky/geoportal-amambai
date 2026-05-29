import pytest

from app.security.passwords import PasswordPolicyError
from app.security.passwords import hash_password
from app.security.passwords import validate_initial_password_policy
from app.security.passwords import verify_password


TEST_PASSWORD = "senha-ficticia-interna-123"


def test_hash_password_returns_string_without_original_password() -> None:
    password_hash = hash_password(TEST_PASSWORD)

    assert isinstance(password_hash, str)
    assert password_hash != TEST_PASSWORD
    assert TEST_PASSWORD not in password_hash


def test_hash_password_uses_unique_salt_for_same_password() -> None:
    first_hash = hash_password(TEST_PASSWORD)
    second_hash = hash_password(TEST_PASSWORD)

    assert first_hash != second_hash


def test_verify_password_returns_true_for_correct_password() -> None:
    password_hash = hash_password(TEST_PASSWORD)

    assert verify_password(TEST_PASSWORD, password_hash) is True


def test_verify_password_returns_false_for_wrong_password() -> None:
    password_hash = hash_password(TEST_PASSWORD)

    assert verify_password("senha-ficticia-errada-123", password_hash) is False


def test_verify_password_returns_false_for_invalid_hash() -> None:
    assert verify_password(TEST_PASSWORD, "hash-malformado") is False


@pytest.mark.parametrize("password", ["", "   "])
def test_hash_password_rejects_empty_or_blank_password(password: str) -> None:
    with pytest.raises(ValueError):
        hash_password(password)


def test_hash_password_generates_argon2id_hash() -> None:
    password_hash = hash_password(TEST_PASSWORD)

    assert password_hash.startswith("$argon2id$")


@pytest.mark.parametrize(
    "password",
    [
        "",
        "   ",
        "abc12",
        "abcdef",
        "123456",
        "usuario.teste",
        "Usuario Teste",
        "senha123",
        "admin123",
        "password123",
    ],
)
def test_validate_initial_password_policy_rejects_weak_passwords(
    password: str,
) -> None:
    with pytest.raises(PasswordPolicyError) as exc_info:
        validate_initial_password_policy(
            password,
            login="usuario.teste",
            nome="Usuario Teste",
    )

    assert str(exc_info.value) == "password does not meet policy"
    if password.strip():
        assert password.strip() not in str(exc_info.value)


def test_validate_initial_password_policy_rejects_too_long_password() -> None:
    password = f"SenhaForte1{'x' * 128}"

    with pytest.raises(PasswordPolicyError):
        validate_initial_password_policy(
            password,
            login="usuario.teste",
            nome="Usuario Teste",
        )


def test_validate_initial_password_policy_accepts_strong_password() -> None:
    assert (
        validate_initial_password_policy(
            "SenhaForte123",
            login="usuario.teste",
            nome="Usuario Teste",
        )
        is None
    )
