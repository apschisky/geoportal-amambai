import pytest

from app.security.passwords import hash_password, verify_password


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
