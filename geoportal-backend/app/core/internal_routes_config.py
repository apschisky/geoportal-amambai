import os


INTERNAL_ROUTES_ENABLED_ENV_VAR = "GEOPORTAL_INTERNAL_ROUTES_ENABLED"

_TRUE_VALUES = frozenset({"true", "1", "yes", "on"})
_FALSE_VALUES = frozenset({"false", "0", "no", "off"})


def is_internal_routes_enabled(value: str | None = None) -> bool:
    if not isinstance(value, str):
        return False

    normalized_value = value.strip().lower()
    if not normalized_value:
        return False
    if normalized_value in _TRUE_VALUES:
        return True
    if normalized_value in _FALSE_VALUES:
        return False

    return False


def are_internal_routes_enabled_from_env() -> bool:
    return is_internal_routes_enabled(os.getenv(INTERNAL_ROUTES_ENABLED_ENV_VAR))
