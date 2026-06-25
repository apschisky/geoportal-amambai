from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.sql.elements import TextClause

from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkNotFoundError,
)
from app.repositories.auth_admin_user_profile_repository import (
    list_internal_user_profile_links,
)


CREATED_AT = datetime(2026, 6, 25, 10, 0, tzinfo=UTC)


class FakeResult:
    def __init__(
        self,
        *,
        row: dict[str, Any] | None = None,
        rows: list[dict[str, Any]] | None = None,
    ) -> None:
        self.row = row
        self.rows = rows or []

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row

    def all(self) -> list[dict[str, Any]]:
        return self.rows


class FakeConnection:
    def __init__(self, results: list[FakeResult]) -> None:
        self.results = list(results)
        self.statements: list[TextClause] = []
        self.params: list[dict[str, Any]] = []

    def execute(
        self,
        statement: TextClause,
        params: dict[str, Any],
    ) -> FakeResult:
        self.statements.append(statement)
        self.params.append(params)
        return self.results.pop(0)


class FakeBegin:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class FakeEngine:
    def __init__(self, results: list[FakeResult]) -> None:
        self.connection = FakeConnection(results)

    def begin(self) -> FakeBegin:
        return FakeBegin(self.connection)


def test_lists_global_and_module_user_profile_links() -> None:
    engine = FakeEngine(
        [
            FakeResult(row={"id": 8}),
            FakeResult(
                rows=[
                    {
                        "usuario_id": 8,
                        "perfil_id": 3,
                        "chave": "administrador-interno-geoportal",
                        "nome": "Administrador Interno",
                        "modulo": None,
                        "ativo": True,
                        "criado_em": CREATED_AT,
                    },
                    {
                        "usuario_id": 8,
                        "perfil_id": 4,
                        "chave": "manutencao-iluminacao",
                        "nome": "Manutencao",
                        "modulo": "iluminacao",
                        "ativo": False,
                        "criado_em": CREATED_AT,
                    },
                ]
            ),
        ]
    )

    links = list_internal_user_profile_links(usuario_id=8, engine=engine)

    assert [(link.perfil_id, link.modulo, link.ativo) for link in links] == [
        (3, None, True),
        (4, "iluminacao", False),
    ]
    sql = "\n".join(str(item) for item in engine.connection.statements)
    assert "FROM mod_auth.usuario_perfis up" in sql
    assert "INNER JOIN mod_auth.perfis pf" in sql
    assert "senha_hash" not in sql
    assert engine.connection.params == [{"usuario_id": 8}, {"usuario_id": 8}]


def test_missing_user_returns_not_found_before_profile_query() -> None:
    engine = FakeEngine([FakeResult(row=None)])

    with pytest.raises(InternalUserProfileLinkNotFoundError):
        list_internal_user_profile_links(usuario_id=999, engine=engine)

    assert len(engine.connection.statements) == 1


def test_invalid_user_id_is_rejected_without_database_access() -> None:
    engine = FakeEngine([])

    with pytest.raises(ValueError, match="usuario_id must be positive"):
        list_internal_user_profile_links(usuario_id=0, engine=engine)

    assert engine.connection.statements == []
