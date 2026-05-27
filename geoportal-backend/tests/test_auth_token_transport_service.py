import inspect

import pytest

from app.services import auth_token_transport_service
from app.services.auth_token_transport_service import extract_session_token


TEST_COOKIE_TOKEN = "token-cookie-ficticio"
TEST_BEARER_TOKEN = "token-bearer-ficticio"


def test_without_header_and_cookie_returns_none() -> None:
    response = extract_session_token()

    assert response.token is None
    assert response.transport is None
    assert response.is_ambiguous is False
    assert response.is_malformed is False


def test_valid_cookie_returns_cookie_token() -> None:
    response = extract_session_token(session_cookie=TEST_COOKIE_TOKEN)

    assert response.token == TEST_COOKIE_TOKEN
    assert response.transport == "cookie"
    assert response.is_ambiguous is False
    assert response.is_malformed is False


def test_valid_bearer_returns_bearer_token() -> None:
    response = extract_session_token(
        authorization_header=f"Bearer {TEST_BEARER_TOKEN}",
    )

    assert response.token == TEST_BEARER_TOKEN
    assert response.transport == "bearer"
    assert response.is_ambiguous is False
    assert response.is_malformed is False


def test_cookie_token_is_trimmed() -> None:
    response = extract_session_token(session_cookie=f"  {TEST_COOKIE_TOKEN}  ")

    assert response.token == TEST_COOKIE_TOKEN
    assert response.transport == "cookie"


def test_bearer_token_is_trimmed() -> None:
    response = extract_session_token(
        authorization_header=f"  Bearer   {TEST_BEARER_TOKEN}  ",
    )

    assert response.token == TEST_BEARER_TOKEN
    assert response.transport == "bearer"


@pytest.mark.parametrize(
    "authorization_header",
    [
        "Token token-ficticio",
        "Bearer",
        "Bearer    ",
        "Basic credencial-ficticia",
        "Bearer token-ficticio parte-extra",
    ],
)
def test_malformed_authorization_returns_generic_invalid_result(
    authorization_header: str,
) -> None:
    response = extract_session_token(authorization_header=authorization_header)

    assert response.token is None
    assert response.transport is None
    assert response.is_ambiguous is False
    assert response.is_malformed is True


def test_empty_cookie_is_ignored_as_absent() -> None:
    response = extract_session_token(session_cookie="   ")

    assert response.token is None
    assert response.transport is None
    assert response.is_malformed is False


def test_cookie_and_bearer_together_are_ambiguous() -> None:
    response = extract_session_token(
        authorization_header=f"Bearer {TEST_BEARER_TOKEN}",
        session_cookie=TEST_COOKIE_TOKEN,
    )

    assert response.token is None
    assert response.transport is None
    assert response.is_ambiguous is True
    assert response.is_malformed is False


def test_result_does_not_keep_raw_authorization_or_cookie() -> None:
    response = extract_session_token(
        authorization_header=f"Bearer {TEST_BEARER_TOKEN}",
    )

    assert not hasattr(response, "authorization_header")
    assert not hasattr(response, "session_cookie")
    assert not hasattr(response, "cookie")
    assert not hasattr(response, "header")


def test_invalid_preferred_transport_raises_value_error() -> None:
    with pytest.raises(ValueError):
        extract_session_token(preferred_transport="jwt")


def test_function_does_not_depend_on_fastapi_request() -> None:
    signature = inspect.signature(extract_session_token)
    module_source = inspect.getsource(auth_token_transport_service)

    assert "request" not in signature.parameters
    assert "fastapi" not in module_source.lower()
    assert "authorization_header" in signature.parameters
    assert "session_cookie" in signature.parameters
