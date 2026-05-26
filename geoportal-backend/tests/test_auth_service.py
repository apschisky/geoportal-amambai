from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.auth_session_repository import AuthSessionRecord
from app.repositories.auth_user_repository import AuthUserRecord
from app.services import auth_service


TEST_LOGIN = "usuario.ficticio"
TEST_PASSWORD = "senha-ficticia-para-teste"
TEST_SECRET = "segredo-ficticio-para-testes"
TEST_TOKEN = "token-ficticio-gerado-interno"
TEST_TOKEN_HASH = "hmac-sha256:hash-ficticio-de-sessao"
TEST_PASSWORD_HASH = "argon2id-hash-ficticio"
NOW = datetime(2026, 5, 26, 12, 0, tzinfo=UTC)
EXPIRES_AT = datetime(2026, 5, 26, 13, 0, tzinfo=UTC)
DEFAULT_AUTH_USER = object()


def auth_user(
    ativo: bool = True,
    bloqueado_ate: datetime | None = None,
    desativado_em: datetime | None = None,
) -> AuthUserRecord:
    return AuthUserRecord(
        id=20,
        nome="Usuario Ficticio",
        email="usuario.ficticio@example.test",
        login=TEST_LOGIN,
        senha_hash=TEST_PASSWORD_HASH,
        ativo=ativo,
        bloqueado_ate=bloqueado_ate,
        desativado_em=desativado_em,
    )


def auth_session() -> AuthSessionRecord:
    return AuthSessionRecord(
        id=30,
        usuario_id=20,
        criado_em=NOW,
        expira_em=EXPIRES_AT,
        revogado_em=None,
    )


def patch_successful_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    user: AuthUserRecord | None | object = DEFAULT_AUTH_USER,
    verify_result: bool = True,
    record_result: bool = True,
) -> dict[str, object]:
    calls: dict[str, object] = {
        "get_user": 0,
        "verify": 0,
        "create_session": 0,
        "record_login": 0,
    }

    def fake_get_auth_user_by_login(login_informado: str, engine: object = None):
        calls["get_user"] += 1
        calls["login_informado"] = login_informado
        calls["get_user_engine"] = engine
        return auth_user() if user is DEFAULT_AUTH_USER else user

    def fake_verify_password(password: str, senha_hash: str) -> bool:
        calls["verify"] += 1
        calls["password"] = password
        calls["senha_hash"] = senha_hash
        return verify_result

    def fake_generate_session_token() -> str:
        calls["generate_token"] = True
        return TEST_TOKEN

    def fake_hash_session_token(token: str, secret: str) -> str:
        calls["hash_token"] = token
        calls["hash_secret"] = secret
        return TEST_TOKEN_HASH

    def fake_build_session_expiration(
        now: datetime | None = None,
        minutes: int = 60,
    ) -> datetime:
        calls["expiration_now"] = now
        calls["expiration_minutes"] = minutes
        return EXPIRES_AT

    def fake_create_session(
        usuario_id: int,
        token_hash: str,
        expira_em: datetime,
        engine: object = None,
    ) -> AuthSessionRecord:
        calls["create_session"] += 1
        calls["session_usuario_id"] = usuario_id
        calls["session_token_hash"] = token_hash
        calls["session_expira_em"] = expira_em
        calls["session_engine"] = engine
        return auth_session()

    def fake_record_successful_login(usuario_id: int, engine: object = None) -> bool:
        calls["record_login"] += 1
        calls["record_usuario_id"] = usuario_id
        calls["record_engine"] = engine
        return record_result

    monkeypatch.setattr(
        auth_service,
        "get_auth_user_by_login",
        fake_get_auth_user_by_login,
    )
    monkeypatch.setattr(auth_service, "verify_password", fake_verify_password)
    monkeypatch.setattr(
        auth_service,
        "generate_session_token",
        fake_generate_session_token,
    )
    monkeypatch.setattr(auth_service, "hash_session_token", fake_hash_session_token)
    monkeypatch.setattr(
        auth_service,
        "build_session_expiration",
        fake_build_session_expiration,
    )
    monkeypatch.setattr(auth_service, "create_session", fake_create_session)
    monkeypatch.setattr(
        auth_service,
        "record_successful_login",
        fake_record_successful_login,
    )

    return calls


@pytest.mark.parametrize(
    ("login_informado", "password"),
    [
        ("", TEST_PASSWORD),
        ("   ", TEST_PASSWORD),
        (TEST_LOGIN, ""),
        (TEST_LOGIN, "   "),
    ],
)
def test_authenticate_user_returns_generic_failure_for_blank_inputs(
    monkeypatch: pytest.MonkeyPatch,
    login_informado: str,
    password: str,
) -> None:
    calls = patch_successful_dependencies(monkeypatch)

    response = auth_service.authenticate_user(
        login_informado=login_informado,
        password=password,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert response is None
    assert calls["get_user"] == 0
    assert calls["verify"] == 0
    assert calls["create_session"] == 0
    assert calls["record_login"] == 0


@pytest.mark.parametrize("session_secret", ["", "   "])
def test_authenticate_user_rejects_blank_session_secret(
    session_secret: str,
) -> None:
    with pytest.raises(ValueError):
        auth_service.authenticate_user(
            login_informado=TEST_LOGIN,
            password=TEST_PASSWORD,
            session_secret=session_secret,
            now=NOW,
        )


@pytest.mark.parametrize(
    "user",
    [
        None,
        auth_user(ativo=False),
        auth_user(desativado_em=NOW),
        auth_user(bloqueado_ate=NOW + timedelta(minutes=1)),
    ],
)
def test_authenticate_user_returns_same_generic_failure_for_user_denials(
    monkeypatch: pytest.MonkeyPatch,
    user: AuthUserRecord | None,
) -> None:
    calls = patch_successful_dependencies(monkeypatch, user=user)

    response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert response is None
    assert calls["verify"] == 0
    assert calls["create_session"] == 0
    assert calls["record_login"] == 0


@pytest.mark.parametrize(
    "bloqueado_ate",
    [
        NOW,
        NOW - timedelta(minutes=1),
    ],
)
def test_authenticate_user_allows_past_or_equal_block_until(
    monkeypatch: pytest.MonkeyPatch,
    bloqueado_ate: datetime,
) -> None:
    calls = patch_successful_dependencies(
        monkeypatch,
        user=auth_user(bloqueado_ate=bloqueado_ate),
    )

    response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert response is not None
    assert calls["verify"] == 1
    assert calls["create_session"] == 1


def test_authenticate_user_returns_generic_failure_for_wrong_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = patch_successful_dependencies(monkeypatch, verify_result=False)

    response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert response is None
    assert calls["verify"] == 1
    assert calls["create_session"] == 0
    assert calls["record_login"] == 0


def test_authenticate_user_success_creates_session_without_returning_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = object()
    calls = patch_successful_dependencies(monkeypatch)

    response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        engine=engine,
        now=NOW,
        session_minutes=45,
    )

    assert response is not None
    assert response.usuario_id == 20
    assert response.nome == "Usuario Ficticio"
    assert response.login == TEST_LOGIN
    assert response.token == TEST_TOKEN
    assert response.expira_em == EXPIRES_AT
    assert response.session_id == 30
    assert not hasattr(response, "token_hash")
    assert not hasattr(response, "senha_hash")
    assert not hasattr(response, "password")

    assert calls["login_informado"] == TEST_LOGIN
    assert calls["get_user_engine"] is engine
    assert calls["password"] == TEST_PASSWORD
    assert calls["senha_hash"] == TEST_PASSWORD_HASH
    assert calls["hash_token"] == TEST_TOKEN
    assert calls["hash_secret"] == TEST_SECRET
    assert calls["session_usuario_id"] == 20
    assert calls["session_token_hash"] == TEST_TOKEN_HASH
    assert calls["session_token_hash"] != TEST_TOKEN
    assert str(calls["session_token_hash"]).startswith("hmac-sha256:")
    assert calls["session_expira_em"] == EXPIRES_AT
    assert calls["session_engine"] is engine
    assert calls["expiration_now"] == NOW
    assert calls["expiration_minutes"] == 45
    assert calls["record_login"] == 1
    assert calls["record_usuario_id"] == 20
    assert calls["record_engine"] is engine


def test_authenticate_user_success_does_not_fail_when_login_timestamp_update_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = patch_successful_dependencies(monkeypatch, record_result=False)

    response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert response is not None
    assert calls["create_session"] == 1
    assert calls["record_login"] == 1


def test_authenticate_user_failure_modes_are_indistinguishable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = patch_successful_dependencies(monkeypatch, user=None)
    missing_user_response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    calls = patch_successful_dependencies(monkeypatch, verify_result=False)
    wrong_password_response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    calls = patch_successful_dependencies(monkeypatch, user=auth_user(ativo=False))
    inactive_response = auth_service.authenticate_user(
        login_informado=TEST_LOGIN,
        password=TEST_PASSWORD,
        session_secret=TEST_SECRET,
        now=NOW,
    )

    assert missing_user_response is None
    assert wrong_password_response is None
    assert inactive_response is None
    assert calls["create_session"] == 0
