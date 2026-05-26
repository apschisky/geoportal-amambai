from datetime import UTC, datetime, timedelta
import inspect

import pytest

from app.security import sessions
from app.security.sessions import (
    build_session_expiration,
    generate_session_token,
    hash_session_token,
    is_session_expired,
    is_session_revoked,
    verify_session_token,
)


TEST_SECRET = "segredo-ficticio-para-testes-de-sessao"
TEST_TOKEN = "token-ficticio-de-alta-entropia-para-teste"


def test_generate_session_token_returns_string_with_minimum_size() -> None:
    token = generate_session_token()

    assert isinstance(token, str)
    assert len(token) >= 32


def test_generate_session_token_returns_different_values() -> None:
    first_token = generate_session_token()
    second_token = generate_session_token()

    assert first_token != second_token


def test_hash_session_token_does_not_return_original_token() -> None:
    token_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)

    assert isinstance(token_hash, str)
    assert token_hash != TEST_TOKEN
    assert TEST_TOKEN not in token_hash


def test_hash_session_token_is_stable_for_same_token_and_secret() -> None:
    first_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)
    second_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)

    assert first_hash == second_hash


def test_hash_session_token_changes_for_different_token() -> None:
    first_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)
    second_hash = hash_session_token(f"{TEST_TOKEN}-outro", TEST_SECRET)

    assert first_hash != second_hash


def test_verify_session_token_returns_true_for_correct_token() -> None:
    token_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)

    assert verify_session_token(TEST_TOKEN, token_hash, TEST_SECRET) is True


def test_verify_session_token_returns_false_for_wrong_token() -> None:
    token_hash = hash_session_token(TEST_TOKEN, TEST_SECRET)

    assert verify_session_token("token-ficticio-incorreto", token_hash, TEST_SECRET) is False


@pytest.mark.parametrize(
    ("token", "token_hash", "secret"),
    [
        (TEST_TOKEN, "hash-malformado", TEST_SECRET),
        ("", "hash-malformado", TEST_SECRET),
        (TEST_TOKEN, "", TEST_SECRET),
        (TEST_TOKEN, "hash-malformado", ""),
        (None, "hash-malformado", TEST_SECRET),
        (TEST_TOKEN, None, TEST_SECRET),
        (TEST_TOKEN, "hash-malformado", None),
    ],
)
def test_verify_session_token_returns_false_for_invalid_inputs(
    token: str,
    token_hash: str,
    secret: str,
) -> None:
    assert verify_session_token(token, token_hash, secret) is False


def test_verify_session_token_uses_constant_time_compare() -> None:
    source = inspect.getsource(sessions.verify_session_token)

    assert "hmac.compare_digest" in source


def test_build_session_expiration_returns_future_utc_datetime() -> None:
    now = datetime(2026, 5, 26, 12, 0, tzinfo=UTC)

    expires_at = build_session_expiration(now=now, minutes=30)

    assert expires_at == now + timedelta(minutes=30)
    assert expires_at.tzinfo is UTC


def test_build_session_expiration_normalizes_naive_datetime_to_utc() -> None:
    now = datetime(2026, 5, 26, 12, 0)

    expires_at = build_session_expiration(now=now, minutes=30)

    assert expires_at == datetime(2026, 5, 26, 12, 30, tzinfo=UTC)


def test_is_session_expired_returns_false_before_expiration() -> None:
    expires_at = datetime(2026, 5, 26, 12, 30, tzinfo=UTC)
    now = datetime(2026, 5, 26, 12, 29, 59, tzinfo=UTC)

    assert is_session_expired(expires_at, now=now) is False


@pytest.mark.parametrize(
    "now",
    [
        datetime(2026, 5, 26, 12, 30, tzinfo=UTC),
        datetime(2026, 5, 26, 12, 31, tzinfo=UTC),
    ],
)
def test_is_session_expired_returns_true_at_or_after_expiration(
    now: datetime,
) -> None:
    expires_at = datetime(2026, 5, 26, 12, 30, tzinfo=UTC)

    assert is_session_expired(expires_at, now=now) is True


def test_is_session_revoked_returns_false_for_none() -> None:
    assert is_session_revoked(None) is False


def test_is_session_revoked_returns_true_for_datetime() -> None:
    revoked_at = datetime(2026, 5, 26, 12, 0, tzinfo=UTC)

    assert is_session_revoked(revoked_at) is True
