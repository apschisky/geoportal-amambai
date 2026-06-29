from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.core.database import get_engine


@dataclass(frozen=True)
class AdminPermissionSeed:
    modulo: str
    chave: str
    descricao: str


@dataclass(frozen=True)
class BootstrapAdminProfileResult:
    usuario_id: int
    perfil_id: int
    permissao_ids: tuple[int, ...]
    perfil_permissoes_criadas: int
    usuario_perfil_criado: bool


@dataclass(frozen=True)
class BootstrapProfilePermissionsResult:
    perfil_id: int
    permissao_ids: tuple[int, ...]
    perfil_permissoes_criadas: int


@dataclass(frozen=True)
class InternalAdminProfileListItem:
    id: int
    chave: str
    nome: str
    ativo: bool
    criado_em: datetime


def _normalize_required(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be empty")
    return normalized


def _normalize_description(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _row_id(row: Any) -> int:
    if row is None:
        raise RuntimeError("expected row was not returned")
    return int(row["id"])


def _get_user_id_by_login_with_connection(
    connection: Connection,
    *,
    login: str,
) -> int | None:
    normalized_login = _normalize_required(login, "login").lower()

    statement = text(
        """
        SELECT id
        FROM mod_auth.usuarios
        WHERE lower(login) = lower(:login)
        LIMIT 1
        """
    )
    row = connection.execute(statement, {"login": normalized_login}).mappings().first()
    if row is None:
        return None
    return int(row["id"])


def get_user_id_by_login(
    *,
    login: str,
    engine: Engine | None = None,
) -> int | None:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        return _get_user_id_by_login_with_connection(connection, login=login)


def list_internal_admin_profiles(
    *,
    limit: int = 500,
    engine: Engine | None = None,
) -> list[InternalAdminProfileListItem]:
    if limit <= 0:
        raise ValueError("limit must be positive")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            chave,
            nome,
            ativo,
            criado_em
        FROM mod_auth.perfis
        WHERE ativo = :active
        ORDER BY lower(nome), lower(chave), id
        LIMIT :limit
        """
    )

    with db_engine.begin() as connection:
        rows = connection.execute(
            statement,
            {"active": True, "limit": limit},
        ).mappings().all()

    return [InternalAdminProfileListItem(**dict(row)) for row in rows]


def _ensure_permission_with_connection(
    connection: Connection,
    *,
    modulo: str,
    chave: str,
    descricao: str | None,
) -> int:
    normalized_modulo = _normalize_required(modulo, "modulo").lower()
    normalized_chave = _normalize_required(chave, "chave").lower()
    normalized_descricao = _normalize_description(descricao)

    select_statement = text(
        """
        SELECT id, ativo
        FROM mod_auth.permissoes
        WHERE lower(modulo) = lower(:modulo)
          AND lower(chave) = lower(:chave)
        LIMIT 1
        """
    )
    row = connection.execute(
        select_statement,
        {"modulo": normalized_modulo, "chave": normalized_chave},
    ).mappings().first()
    if row is not None:
        if row["ativo"] is not True:
            raise ValueError("existing permission is inactive; automatic reactivation is not allowed")
        return int(row["id"])

    insert_statement = text(
        """
        INSERT INTO mod_auth.permissoes (
            modulo,
            chave,
            descricao,
            ativo
        )
        VALUES (
            :modulo,
            :chave,
            :descricao,
            true
        )
        RETURNING id
        """
    )
    inserted = connection.execute(
        insert_statement,
        {
            "modulo": normalized_modulo,
            "chave": normalized_chave,
            "descricao": normalized_descricao,
        },
    ).mappings().first()
    return _row_id(inserted)


def _get_existing_permission_id_with_connection(
    connection: Connection,
    *,
    modulo: str,
    chave: str,
) -> int:
    normalized_modulo = _normalize_required(modulo, "modulo").lower()
    normalized_chave = _normalize_required(chave, "chave").lower()

    statement = text(
        """
        SELECT id, ativo
        FROM mod_auth.permissoes
        WHERE lower(modulo) = lower(:modulo)
          AND lower(chave) = lower(:chave)
        LIMIT 1
        """
    )
    row = connection.execute(
        statement,
        {"modulo": normalized_modulo, "chave": normalized_chave},
    ).mappings().first()
    permission_code = f"{normalized_modulo}.{normalized_chave}"
    if row is None:
        raise ValueError(f"required permission was not found: {permission_code}")
    if row["ativo"] is not True:
        raise ValueError(f"required permission is inactive: {permission_code}")
    return int(row["id"])

def ensure_permission(
    *,
    modulo: str,
    chave: str,
    descricao: str | None,
    engine: Engine | None = None,
) -> int:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        return _ensure_permission_with_connection(
            connection,
            modulo=modulo,
            chave=chave,
            descricao=descricao,
        )


def _ensure_profile_with_connection(
    connection: Connection,
    *,
    chave: str,
    nome: str,
    descricao: str | None,
) -> int:
    normalized_chave = _normalize_required(chave, "chave").lower()
    normalized_nome = _normalize_required(nome, "nome")
    normalized_descricao = _normalize_description(descricao)

    select_statement = text(
        """
        SELECT id, ativo
        FROM mod_auth.perfis
        WHERE lower(chave) = lower(:chave)
        LIMIT 1
        """
    )
    row = connection.execute(select_statement, {"chave": normalized_chave}).mappings().first()
    if row is not None:
        if row["ativo"] is not True:
            raise ValueError("existing profile is inactive; automatic reactivation is not allowed")
        return int(row["id"])

    insert_statement = text(
        """
        INSERT INTO mod_auth.perfis (
            chave,
            nome,
            descricao,
            ativo
        )
        VALUES (
            :chave,
            :nome,
            :descricao,
            true
        )
        RETURNING id
        """
    )
    inserted = connection.execute(
        insert_statement,
        {
            "chave": normalized_chave,
            "nome": normalized_nome,
            "descricao": normalized_descricao,
        },
    ).mappings().first()
    return _row_id(inserted)


def ensure_profile(
    *,
    chave: str,
    nome: str,
    descricao: str | None,
    engine: Engine | None = None,
) -> int:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        return _ensure_profile_with_connection(
            connection,
            chave=chave,
            nome=nome,
            descricao=descricao,
        )


def _ensure_profile_permission_with_connection(
    connection: Connection,
    *,
    perfil_id: int,
    permissao_id: int,
) -> bool:
    if perfil_id <= 0:
        raise ValueError("perfil_id must be positive")
    if permissao_id <= 0:
        raise ValueError("permissao_id must be positive")

    select_statement = text(
        """
        SELECT 1
        FROM mod_auth.perfil_permissoes
        WHERE perfil_id = :perfil_id
          AND permissao_id = :permissao_id
        LIMIT 1
        """
    )
    row = connection.execute(
        select_statement,
        {"perfil_id": perfil_id, "permissao_id": permissao_id},
    ).mappings().first()
    if row is not None:
        return False

    insert_statement = text(
        """
        INSERT INTO mod_auth.perfil_permissoes (
            perfil_id,
            permissao_id
        )
        VALUES (
            :perfil_id,
            :permissao_id
        )
        """
    )
    connection.execute(
        insert_statement,
        {"perfil_id": perfil_id, "permissao_id": permissao_id},
    )
    return True


def ensure_profile_permission(
    *,
    perfil_id: int,
    permissao_id: int,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        return _ensure_profile_permission_with_connection(
            connection,
            perfil_id=perfil_id,
            permissao_id=permissao_id,
        )


def _ensure_user_profile_with_connection(
    connection: Connection,
    *,
    usuario_id: int,
    perfil_id: int,
) -> bool:
    if usuario_id <= 0:
        raise ValueError("usuario_id must be positive")
    if perfil_id <= 0:
        raise ValueError("perfil_id must be positive")

    select_statement = text(
        """
        SELECT ativo
        FROM mod_auth.usuario_perfis
        WHERE usuario_id = :usuario_id
          AND perfil_id = :perfil_id
          AND modulo IS NULL
        LIMIT 1
        """
    )
    row = connection.execute(
        select_statement,
        {"usuario_id": usuario_id, "perfil_id": perfil_id},
    ).mappings().first()
    if row is not None:
        if row["ativo"] is not True:
            raise ValueError("existing user profile link is inactive; automatic reactivation is not allowed")
        return False

    insert_statement = text(
        """
        INSERT INTO mod_auth.usuario_perfis (
            usuario_id,
            perfil_id,
            modulo,
            ativo
        )
        VALUES (
            :usuario_id,
            :perfil_id,
            NULL,
            true
        )
        """
    )
    connection.execute(
        insert_statement,
        {"usuario_id": usuario_id, "perfil_id": perfil_id},
    )
    return True


def ensure_user_profile(
    *,
    usuario_id: int,
    perfil_id: int,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        return _ensure_user_profile_with_connection(
            connection,
            usuario_id=usuario_id,
            perfil_id=perfil_id,
        )


def bootstrap_internal_admin_profile(
    *,
    login: str,
    perfil_chave: str,
    perfil_nome: str,
    perfil_descricao: str | None,
    permissoes: Sequence[AdminPermissionSeed],
    engine: Engine | None = None,
) -> BootstrapAdminProfileResult:
    normalized_login = _normalize_required(login, "login").lower()
    if not permissoes:
        raise ValueError("permissoes must not be empty")

    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        usuario_id = _get_user_id_by_login_with_connection(connection, login=normalized_login)
        if usuario_id is None:
            raise ValueError("internal user was not found")

        permissao_ids = tuple(
            _ensure_permission_with_connection(
                connection,
                modulo=permissao.modulo,
                chave=permissao.chave,
                descricao=permissao.descricao,
            )
            for permissao in permissoes
        )
        perfil_id = _ensure_profile_with_connection(
            connection,
            chave=perfil_chave,
            nome=perfil_nome,
            descricao=perfil_descricao,
        )
        profile_links_created = sum(
            1
            for permissao_id in permissao_ids
            if _ensure_profile_permission_with_connection(
                connection,
                perfil_id=perfil_id,
                permissao_id=permissao_id,
            )
        )
        user_profile_created = _ensure_user_profile_with_connection(
            connection,
            usuario_id=usuario_id,
            perfil_id=perfil_id,
        )

    return BootstrapAdminProfileResult(
        usuario_id=usuario_id,
        perfil_id=perfil_id,
        permissao_ids=permissao_ids,
        perfil_permissoes_criadas=profile_links_created,
        usuario_perfil_criado=user_profile_created,
    )

def bootstrap_profile_with_existing_permissions(
    *,
    perfil_chave: str,
    perfil_nome: str,
    perfil_descricao: str | None,
    permissoes: Sequence[AdminPermissionSeed],
    engine: Engine | None = None,
) -> BootstrapProfilePermissionsResult:
    if not permissoes:
        raise ValueError("permissoes must not be empty")

    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        permissao_ids = tuple(
            _get_existing_permission_id_with_connection(
                connection,
                modulo=permissao.modulo,
                chave=permissao.chave,
            )
            for permissao in permissoes
        )
        perfil_id = _ensure_profile_with_connection(
            connection,
            chave=perfil_chave,
            nome=perfil_nome,
            descricao=perfil_descricao,
        )
        profile_links_created = sum(
            1
            for permissao_id in permissao_ids
            if _ensure_profile_permission_with_connection(
                connection,
                perfil_id=perfil_id,
                permissao_id=permissao_id,
            )
        )

    return BootstrapProfilePermissionsResult(
        perfil_id=perfil_id,
        permissao_ids=permissao_ids,
        perfil_permissoes_criadas=profile_links_created,
    )
