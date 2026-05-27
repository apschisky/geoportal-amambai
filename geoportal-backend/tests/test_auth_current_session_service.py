from datetime import UTC, datetime
import inspect

import pytest

from app.repositories.auth_session_repository import AuthSessionRecord
from app.services import auth_current_session_service
from app.services.auth_current_session_service import resolve_authenticated_session


TEST_TOKEN = "token-ficticio-para-validacao-de-sessao"
TEST_SECRET = "segredo-ficticio-para-validacao-de-sessao"
TEST_TOKEN_HASH = "hmac-sha256:hash-ficticio-de-sessao"
NOW = datetime(2026, 5, 27, 12, 0, tzinfo=UTC)
EXPIRES_AT = datetime(2026, 5, 27, 13, 0, tzinfo=UTC)


def active_session_record() -> AuthSessionRecord:
    return AuthSessionRecord(
        id=30,
        usuario_id=20,
        criado_em=NOW,
        expira_em=EXPIRES_AT,
        revogado_em=None,
    )


@pytest.mark.parametrize("token", ["", "   ", None])
def test_blank_token_returns_none_without_querying_repository(
    monkeypatch: pytest.MonkeyPatch,
    token: str,
) -> None:
    calls: list[str] = []

    def fake_hash_session_token(unused_token: str, unused_secret: str) -> str:
        calls.append("hash")
        return TEST_TOKEN_HASH

    def fake_get_active_session_by_token_hash(
        unused_token_hash: str,
        engine: object | None = None,
    ) -> AuthSessionRecord:
        calls.append("repository")
        return active_session_record()

    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        fake_hash_session_token,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        fake_get_active_session_by_token_hash,
    )

    response = resolve_authenticated_session(token, TEST_SECRET)

    assert response is None
    assert calls == []


@pytest.mark.parametrize("session_secret", ["", "   ", None])
def test_blank_session_secret_raises_value_error(session_secret: str) -> None:
    with pytest.raises(ValueError):
        resolve_authenticated_session(TEST_TOKEN, session_secret)


def test_valid_token_generates_hash_and_queries_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    engine = object()

    def fake_hash_session_token(token: str, secret: str) -> str:
        captured["token"] = token
        captured["secret"] = secret
        return TEST_TOKEN_HASH

    def fake_get_active_session_by_token_hash(
        token_hash: str,
        engine: object | None = None,
    ) -> AuthSessionRecord:
        captured["token_hash"] = token_hash
        captured["engine"] = engine
        return active_session_record()

    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        fake_hash_session_token,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        fake_get_active_session_by_token_hash,
    )

    response = resolve_authenticated_session(TEST_TOKEN, TEST_SECRET, engine=engine)

    assert response is not None
    assert captured == {
        "token": TEST_TOKEN,
        "secret": TEST_SECRET,
        "token_hash": TEST_TOKEN_HASH,
        "engine": engine,
    }
    assert str(captured["token_hash"]).startswith("hmac-sha256:")


def test_session_not_found_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        lambda token, secret: TEST_TOKEN_HASH,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        lambda token_hash, engine=None: None,
    )

    response = resolve_authenticated_session(TEST_TOKEN, TEST_SECRET)

    assert response is None


def test_found_session_returns_internal_authenticated_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        lambda token, secret: TEST_TOKEN_HASH,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        lambda token_hash, engine=None: active_session_record(),
    )

    response = resolve_authenticated_session(TEST_TOKEN, TEST_SECRET)

    assert response is not None
    assert response.usuario_id == 20
    assert response.sessao_id == 30
    assert response.expira_em == EXPIRES_AT


def test_response_does_not_expose_sensitive_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        lambda token, secret: TEST_TOKEN_HASH,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        lambda token_hash, engine=None: active_session_record(),
    )

    response = resolve_authenticated_session(TEST_TOKEN, TEST_SECRET)

    assert response is not None
    assert not hasattr(response, "token")
    assert not hasattr(response, "token_hash")
    assert not hasattr(response, "session_secret")
    assert not hasattr(response, "senha_hash")
    assert not hasattr(response, "password")


def test_repository_error_bubbles_as_internal_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_get_active_session_by_token_hash(
        token_hash: str,
        engine: object | None = None,
    ) -> AuthSessionRecord | None:
        raise RuntimeError("repository unavailable")

    monkeypatch.setattr(
        auth_current_session_service,
        "hash_session_token",
        lambda token, secret: TEST_TOKEN_HASH,
    )
    monkeypatch.setattr(
        auth_current_session_service,
        "get_active_session_by_token_hash",
        fake_get_active_session_by_token_hash,
    )

    with pytest.raises(RuntimeError):
        resolve_authenticated_session(TEST_TOKEN, TEST_SECRET)


def test_function_does_not_depend_on_fastapi_request() -> None:
    signature = inspect.signature(resolve_authenticated_session)

    assert "request" not in signature.parameters
    assert "token" in signature.parameters
    assert "session_secret" in signature.parameters
