from datetime import UTC, datetime
import inspect

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.routes import internal_iluminacao
from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import get_current_authenticated_session
from app.main import app as main_app
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoHistoricoInternoItem,
    IluminacaoSolicitacaoHistoricoInternoResult,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacoesInternasResult,
)
from app.schemas.iluminacao import TipoProblemaIluminacao
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import DATABASE_UNAVAILABLE_MESSAGE


INTERNAL_SOLICITACOES_PATH = "/api/internal/iluminacao/solicitacoes"
INTERNAL_SOLICITACAO_DETAIL_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}"
)
INTERNAL_SOLICITACAO_DETAIL_PATH = "/api/internal/iluminacao/solicitacoes/10"
INTERNAL_SOLICITACAO_HISTORICO_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}/historico"
)
INTERNAL_SOLICITACAO_HISTORICO_PATH = (
    "/api/internal/iluminacao/solicitacoes/10/historico"
)
EXPECTED_PERMISSION = "iluminacao.solicitacoes.ler"
EXPECTED_HISTORICO_PERMISSION = "iluminacao.solicitacoes.ver_historico"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 20, 10, 30, tzinfo=UTC)
UPDATED_AT = datetime(2026, 5, 21, 8, 15, tzinfo=UTC)
HISTORICO_CREATED_AT = datetime(2026, 5, 20, 11, 30, tzinfo=UTC)


def build_isolated_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_iluminacao.router)
    return app


def authenticated_current_session() -> AuthenticatedCurrentSession:
    return AuthenticatedCurrentSession(
        usuario_id=7,
        sessao_id=30,
        expira_em=EXPIRES_AT,
    )


def fake_solicitacao() -> IluminacaoSolicitacaoInternaItem:
    return IluminacaoSolicitacaoInternaItem(
        id=10,
        protocolo="IP-2026-000010",
        origem="geoportal_publico",
        localizacao_tipo="poste_mapa",
        poste_id="POSTE-010",
        tipo_problema="lampada_apagada",
        descricao="Lampada apagada na rua principal.",
        observacoes_localizacao=None,
        ponto_referencia="Perto da praca.",
        poste_proximo_informado=None,
        nome_solicitante="Solicitante Interno",
        contato_solicitante="contato interno",
        status="aberta",
        prioridade="normal",
        duplicidade_suspeita=False,
        latitude=-23.105,
        longitude=-55.225,
        criado_em=CREATED_AT,
        atualizado_em=UPDATED_AT,
        finalizado_em=None,
    )


def fake_historico_item() -> IluminacaoSolicitacaoHistoricoInternoItem:
    return IluminacaoSolicitacaoHistoricoInternoItem(
        id=50,
        solicitacao_id=10,
        acao="criacao",
        status_anterior=None,
        status_novo="aberta",
        prioridade_anterior=None,
        prioridade_nova="normal",
        usuario_id="7",
        usuario_nome="Administrador Interno",
        origem_acao="sistema",
        observacao_resumida="Solicitacao registrada.",
        criado_em=HISTORICO_CREATED_AT,
    )


def test_router_is_not_included_in_main_app_without_feature_flag() -> None:
    route_paths = {route.path for route in main_app.routes}

    assert INTERNAL_SOLICITACOES_PATH not in route_paths


def test_internal_solicitacoes_returns_200_for_authenticated_user_with_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    calls: dict[str, object] = {}

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        calls.update(
            {
                "usuario_id": usuario_id,
                "permission_code": permission_code,
            }
        )
        return True

    service_calls: dict[str, object] = {}

    def fake_listar_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoSolicitacoesInternasResult:
        service_calls.update(kwargs)
        return IluminacaoSolicitacoesInternasResult(
            items=[fake_solicitacao()],
            total=12,
        )

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        fake_listar_solicitacoes_internas,
    )
    client = TestClient(app)

    response = client.get(
        INTERNAL_SOLICITACOES_PATH,
        params={
            "status": "aberta",
            "protocolo": "IP-2026",
            "poste_id": "POSTE-010",
            "tipo_problema": "lampada_apagada",
            "prioridade": "normal",
            "criado_de": "2026-05-01T00:00:00Z",
            "criado_ate": "2026-05-31T23:59:00Z",
            "limit": 25,
            "offset": 5,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 10,
                "protocolo": "IP-2026-000010",
                "origem": "geoportal_publico",
                "localizacao_tipo": "poste_mapa",
                "poste_id": "POSTE-010",
                "tipo_problema": "lampada_apagada",
                "descricao": "Lampada apagada na rua principal.",
                "observacoes_localizacao": None,
                "ponto_referencia": "Perto da praca.",
                "poste_proximo_informado": None,
                "nome_solicitante": "Solicitante Interno",
                "contato_solicitante": "contato interno",
                "status": "aberta",
                "prioridade": "normal",
                "duplicidade_suspeita": False,
                "latitude": -23.105,
                "longitude": -55.225,
                "criado_em": "2026-05-20T10:30:00Z",
                "atualizado_em": "2026-05-21T08:15:00Z",
                "finalizado_em": None,
            }
        ],
        "limit": 25,
        "offset": 5,
        "total": 12,
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }
    assert service_calls == {
        "status": "aberta",
        "protocolo": "IP-2026",
        "poste_id": "POSTE-010",
        "tipo_problema": TipoProblemaIluminacao.lampada_apagada,
        "prioridade": "normal",
        "criado_de": datetime(2026, 5, 1, 0, 0, tzinfo=UTC),
        "criado_ate": datetime(2026, 5, 31, 23, 59, tzinfo=UTC),
        "limit": 25,
        "offset": 5,
    }


def test_internal_solicitacao_detail_returns_200_for_authenticated_user_with_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    calls: dict[str, object] = {}

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        calls.update(
            {
                "usuario_id": usuario_id,
                "permission_code": permission_code,
            }
        )
        return True

    service_calls: dict[str, object] = {}

    def fake_obter_solicitacao_interna_por_id(
        solicitacao_id: int,
    ) -> IluminacaoSolicitacaoInternaItem:
        service_calls["solicitacao_id"] = solicitacao_id
        return fake_solicitacao()

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        fake_obter_solicitacao_interna_por_id,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "id": 10,
        "protocolo": "IP-2026-000010",
        "origem": "geoportal_publico",
        "localizacao_tipo": "poste_mapa",
        "poste_id": "POSTE-010",
        "tipo_problema": "lampada_apagada",
        "descricao": "Lampada apagada na rua principal.",
        "observacoes_localizacao": None,
        "ponto_referencia": "Perto da praca.",
        "poste_proximo_informado": None,
        "nome_solicitante": "Solicitante Interno",
        "contato_solicitante": "contato interno",
        "status": "aberta",
        "prioridade": "normal",
        "duplicidade_suspeita": False,
        "latitude": -23.105,
        "longitude": -55.225,
        "criado_em": "2026-05-20T10:30:00Z",
        "atualizado_em": "2026-05-21T08:15:00Z",
        "finalizado_em": None,
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_PERMISSION,
    }
    assert service_calls == {"solicitacao_id": 10}


def test_internal_solicitacao_historico_returns_200_for_authenticated_user_with_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    calls: dict[str, object] = {}

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        calls.update(
            {
                "usuario_id": usuario_id,
                "permission_code": permission_code,
            }
        )
        return True

    service_calls: dict[str, object] = {}

    def fake_listar_historico_solicitacao_interna(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoHistoricoInternoResult:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "limit": limit,
                "offset": offset,
            }
        )
        return IluminacaoSolicitacaoHistoricoInternoResult(
            items=[fake_historico_item()],
            total=3,
        )

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        fake_listar_historico_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.get(
        INTERNAL_SOLICITACAO_HISTORICO_PATH,
        params={"limit": 25, "offset": 5},
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 50,
                "solicitacao_id": 10,
                "acao": "criacao",
                "status_anterior": None,
                "status_novo": "aberta",
                "prioridade_anterior": None,
                "prioridade_nova": "normal",
                "usuario_id": "7",
                "usuario_nome": "Administrador Interno",
                "origem_acao": "sistema",
                "observacao_resumida": "Solicitacao registrada.",
                "criado_em": "2026-05-20T11:30:00Z",
            }
        ],
        "limit": 25,
        "offset": 5,
        "total": 3,
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_HISTORICO_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "limit": 25,
        "offset": 5,
    }


def test_internal_solicitacao_historico_returns_empty_list_when_no_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoHistoricoInternoResult(items=[], total=0)
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "limit": 50,
        "offset": 0,
        "total": 0,
    }


def test_internal_solicitacoes_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_internal_solicitacao_detail_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_internal_solicitacao_historico_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_internal_solicitacoes_returns_403_without_required_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        lambda **kwargs: IluminacaoSolicitacoesInternasResult(
            items=[fake_solicitacao()],
            total=1,
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "IP-2026-000010" not in response.text


def test_internal_solicitacao_detail_returns_403_without_required_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        lambda solicitacao_id: fake_solicitacao(),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_PERMISSION not in response.text
    assert "IP-2026-000010" not in response.text


def test_internal_solicitacao_historico_returns_403_without_required_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: False,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoHistoricoInternoResult(
                items=[fake_historico_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_HISTORICO_PERMISSION not in response.text
    assert "Solicitacao registrada" not in response.text


def test_get_internal_solicitacoes_does_not_require_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        lambda **kwargs: IluminacaoSolicitacoesInternasResult(
            items=[fake_solicitacao()],
            total=1,
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response.status_code == 200


def test_get_internal_solicitacao_detail_does_not_require_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        lambda solicitacao_id: fake_solicitacao(),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 200


def test_get_internal_solicitacao_historico_does_not_require_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoHistoricoInternoResult(
                items=[fake_historico_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 200


def test_internal_solicitacao_detail_returns_404_when_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_not_found(solicitacao_id: int) -> IluminacaoSolicitacaoInternaItem:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_internal_solicitacao_historico_returns_404_when_solicitacao_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_not_found(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoHistoricoInternoResult:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_internal_solicitacoes_database_error_is_sanitized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_with_database_error(
        **kwargs: object,
    ) -> IluminacaoSolicitacoesInternasResult:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response.status_code == 503
    assert response.json() == {"detail": DATABASE_UNAVAILABLE_MESSAGE}
    for forbidden in (
        "DATABASE_URL",
        "db.internal",
        "senha",
        "token",
        "cookie",
        "role",
        "GRANT",
        "SELECT",
        "traceback",
    ):
        assert forbidden not in response.text


def test_internal_solicitacao_detail_database_error_is_sanitized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_with_database_error(
        solicitacao_id: int,
    ) -> IluminacaoSolicitacaoInternaItem:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 503
    assert response.json() == {"detail": DATABASE_UNAVAILABLE_MESSAGE}
    for forbidden in (
        "DATABASE_URL",
        "db.internal",
        "senha",
        "token",
        "cookie",
        "role",
        "GRANT",
        "SELECT",
        "traceback",
    ):
        assert forbidden not in response.text


def test_internal_solicitacao_historico_database_error_is_sanitized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_with_database_error(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoHistoricoInternoResult:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 503
    assert response.json() == {"detail": DATABASE_UNAVAILABLE_MESSAGE}
    for forbidden in (
        "DATABASE_URL",
        "db.internal",
        "senha",
        "token",
        "cookie",
        "role",
        "GRANT",
        "SELECT",
        "traceback",
    ):
        assert forbidden not in response.text


def test_internal_solicitacoes_validates_query_params(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    client = TestClient(app)

    for params in (
        {"status": "status_invalido"},
        {"tipo_problema": "tipo_invalido"},
        {"protocolo": ""},
        {"poste_id": ""},
        {"prioridade": ""},
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
    ):
        response = client.get(INTERNAL_SOLICITACOES_PATH, params=params)
        assert response.status_code == 422


def test_internal_solicitacoes_rejects_invalid_period(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )

    def fail_invalid_period(**kwargs: object) -> IluminacaoSolicitacoesInternasResult:
        raise ValueError("criado_de must be less than or equal to criado_ate")

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        fail_invalid_period,
    )
    client = TestClient(app)

    response = client.get(
        INTERNAL_SOLICITACOES_PATH,
        params={
            "criado_de": "2026-06-01T00:00:00Z",
            "criado_ate": "2026-05-01T00:00:00Z",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid query parameters"}
    assert "criado_de" not in response.text


def test_internal_solicitacao_detail_validates_positive_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    client = TestClient(app)

    response = client.get("/api/internal/iluminacao/solicitacoes/0")

    assert response.status_code == 422


def test_internal_solicitacao_historico_validates_query_params(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    client = TestClient(app)

    for path, params in (
        ("/api/internal/iluminacao/solicitacoes/0/historico", {}),
        (INTERNAL_SOLICITACAO_HISTORICO_PATH, {"limit": 0}),
        (INTERNAL_SOLICITACAO_HISTORICO_PATH, {"limit": 101}),
        (INTERNAL_SOLICITACAO_HISTORICO_PATH, {"offset": -1}),
    ):
        response = client.get(path, params=params)
        assert response.status_code == 422


def test_internal_solicitacoes_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        lambda **kwargs: IluminacaoSolicitacoesInternasResult(
            items=[fake_solicitacao()],
            total=1,
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response.status_code == 200
    response_text = response.text
    body = response.json()
    assert set(body) == {"items", "limit", "offset", "total"}
    assert body["total"] == 1
    assert set(body["items"][0]) == {
        "id",
        "protocolo",
        "origem",
        "localizacao_tipo",
        "poste_id",
        "tipo_problema",
        "descricao",
        "observacoes_localizacao",
        "ponto_referencia",
        "poste_proximo_informado",
        "nome_solicitante",
        "contato_solicitante",
        "status",
        "prioridade",
        "duplicidade_suspeita",
        "latitude",
        "longitude",
        "criado_em",
        "atualizado_em",
        "finalizado_em",
    }
    for forbidden in (
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "SQL",
        "role",
        "GRANT",
        "cookie",
        "deleted_at",
        "deleted_reason",
    ):
        assert forbidden not in response_text


def test_internal_solicitacao_detail_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "obter_solicitacao_interna_por_id",
        lambda solicitacao_id: fake_solicitacao(),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_DETAIL_PATH)

    assert response.status_code == 200
    response_text = response.text
    body = response.json()
    assert set(body) == {
        "id",
        "protocolo",
        "origem",
        "localizacao_tipo",
        "poste_id",
        "tipo_problema",
        "descricao",
        "observacoes_localizacao",
        "ponto_referencia",
        "poste_proximo_informado",
        "nome_solicitante",
        "contato_solicitante",
        "status",
        "prioridade",
        "duplicidade_suspeita",
        "latitude",
        "longitude",
        "criado_em",
        "atualizado_em",
        "finalizado_em",
    }
    for forbidden in (
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "SQL",
        "role",
        "GRANT",
        "cookie",
        "deleted_at",
        "deleted_reason",
        "historico",
        "observacoes_internas",
        "anexos",
    ):
        assert forbidden not in response_text


def test_internal_solicitacao_historico_response_does_not_expose_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_historico_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoHistoricoInternoResult(
                items=[fake_historico_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_HISTORICO_PATH)

    assert response.status_code == 200
    response_text = response.text
    body = response.json()
    assert set(body) == {"items", "limit", "offset", "total"}
    assert body["total"] == 1
    assert set(body["items"][0]) == {
        "id",
        "solicitacao_id",
        "acao",
        "status_anterior",
        "status_novo",
        "prioridade_anterior",
        "prioridade_nova",
        "usuario_id",
        "usuario_nome",
        "origem_acao",
        "observacao_resumida",
        "criado_em",
    }
    for forbidden in (
        "senha_hash",
        "token_hash",
        "session_secret",
        "DATABASE_URL",
        "SQL",
        "role",
        "GRANT",
        "cookie",
        "deleted_at",
        "deleted_reason",
        "anexos",
    ):
        assert forbidden not in response_text


def test_internal_iluminacao_router_uses_permission_without_hardcoded_login() -> None:
    source = inspect.getsource(internal_iluminacao)
    route_paths = {route.path for route in internal_iluminacao.router.routes}

    assert INTERNAL_SOLICITACOES_PATH in route_paths
    assert INTERNAL_SOLICITACAO_DETAIL_ROUTE in route_paths
    assert INTERNAL_SOLICITACAO_HISTORICO_ROUTE in route_paths
    assert "require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)" in source
    assert "require_permission(LIST_INTERNAL_ILUMINACAO_HISTORICO_PERMISSION)" in source
    assert EXPECTED_PERMISSION in source
    assert EXPECTED_HISTORICO_PERMISSION in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "require_internal_mutating_request_header" not in source
    assert "DELETE" not in source.upper()


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
