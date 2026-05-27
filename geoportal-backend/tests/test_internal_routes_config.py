import inspect

import pytest

from app.core import internal_routes_config
from app.core.internal_routes_config import are_internal_routes_enabled_from_env
from app.core.internal_routes_config import is_internal_routes_enabled


@pytest.mark.parametrize("value", [None, "", "   "])
def test_empty_values_disable_internal_routes(value: str | None) -> None:
    assert is_internal_routes_enabled(value) is False


@pytest.mark.parametrize(
    "value",
    [
        "false",
        "False",
        "FALSE",
        "0",
        "no",
        "off",
        "  false  ",
        "  OFF  ",
    ],
)
def test_false_values_disable_internal_routes(value: str) -> None:
    assert is_internal_routes_enabled(value) is False


@pytest.mark.parametrize(
    "value",
    [
        "true",
        "True",
        "TRUE",
        "1",
        "yes",
        "on",
        "  true  ",
        "  ON  ",
    ],
)
def test_true_values_enable_internal_routes(value: str) -> None:
    assert is_internal_routes_enabled(value) is True


@pytest.mark.parametrize("value", ["enabled", "sim", "2", "truthy", "prod"])
def test_invalid_values_disable_internal_routes_fail_closed(value: str) -> None:
    assert is_internal_routes_enabled(value) is False


def test_from_env_returns_false_when_env_is_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(
        internal_routes_config.INTERNAL_ROUTES_ENABLED_ENV_VAR,
        raising=False,
    )

    assert are_internal_routes_enabled_from_env() is False


def test_from_env_reads_future_flag_without_printing_value(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(
        internal_routes_config.INTERNAL_ROUTES_ENABLED_ENV_VAR,
        " true ",
    )

    assert are_internal_routes_enabled_from_env() is True
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""


def test_from_env_invalid_value_disables_internal_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        internal_routes_config.INTERNAL_ROUTES_ENABLED_ENV_VAR,
        "invalid-value",
    )

    assert are_internal_routes_enabled_from_env() is False


def test_config_does_not_depend_on_fastapi_or_router_registration() -> None:
    source = inspect.getsource(internal_routes_config)

    assert "fastapi" not in source.lower()
    assert "APIRouter" not in source
    assert "include_router" not in source
    assert "internal_auth_smoke" not in source
