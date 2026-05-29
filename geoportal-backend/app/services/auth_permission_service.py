from sqlalchemy.engine import Engine

from app.repositories.auth_permission_repository import (
    get_effective_permissions_for_user,
)


def get_user_permissions(
    usuario_id: int,
    engine: Engine | None = None,
) -> set[str]:
    return get_effective_permissions_for_user(usuario_id, engine=engine)


def has_permission(
    usuario_id: int,
    permission_code: str,
    engine: Engine | None = None,
) -> bool:
    normalized_permission = permission_code.strip().lower()
    if not normalized_permission:
        return False

    return normalized_permission in get_user_permissions(usuario_id, engine=engine)
