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
    IluminacaoRelatorioResumoInternoResponse,
    IluminacaoRelatorioSolicitacaoInternaItem,
    IluminacaoRelatorioSolicitacoesInternasResult,
    IluminacaoSolicitacaoHistoricoInternoItem,
    IluminacaoSolicitacaoHistoricoInternoResult,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResult,
    IluminacaoSolicitacaoPrioridadeInternaItem,
    IluminacaoSolicitacaoStatusInternaItem,
    IluminacaoSolicitacoesInternasResult,
)
from app.schemas.iluminacao import TipoProblemaIluminacao
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import DATABASE_UNAVAILABLE_MESSAGE


INTERNAL_SOLICITACOES_PATH = "/api/internal/iluminacao/solicitacoes"
INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH = (
    "/api/internal/iluminacao/relatorios/solicitacoes.csv"
)
INTERNAL_RELATORIO_SOLICITACOES_RESUMO_PATH = (
    "/api/internal/iluminacao/relatorios/solicitacoes/resumo"
)
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
INTERNAL_SOLICITACAO_OBSERVACOES_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}/observacoes"
)
INTERNAL_SOLICITACAO_OBSERVACOES_PATH = (
    "/api/internal/iluminacao/solicitacoes/10/observacoes"
)
INTERNAL_SOLICITACAO_STATUS_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}/status"
)
INTERNAL_SOLICITACAO_STATUS_PATH = (
    "/api/internal/iluminacao/solicitacoes/10/status"
)
INTERNAL_SOLICITACAO_STATUS_CORRECAO_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}/status-correcao"
)
INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH = (
    "/api/internal/iluminacao/solicitacoes/10/status-correcao"
)
INTERNAL_SOLICITACAO_PRIORIDADE_ROUTE = (
    "/api/internal/iluminacao/solicitacoes/{solicitacao_id}/prioridade"
)
INTERNAL_SOLICITACAO_PRIORIDADE_PATH = (
    "/api/internal/iluminacao/solicitacoes/10/prioridade"
)
EXPECTED_PERMISSION = "iluminacao.solicitacoes.ler"
EXPECTED_HISTORICO_PERMISSION = "iluminacao.solicitacoes.ver_historico"
EXPECTED_OBSERVACOES_PERMISSION = "iluminacao.solicitacoes.ver_observacoes"
EXPECTED_COMENTAR_PERMISSION = "iluminacao.solicitacoes.comentar"
EXPECTED_ATUALIZAR_STATUS_PERMISSION = "iluminacao.solicitacoes.atualizar_status"
EXPECTED_ATUALIZAR_PRIORIDADE_PERMISSION = (
    "iluminacao.solicitacoes.atualizar_prioridade"
)
EXPECTED_CORRIGIR_STATUS_PERMISSION = "iluminacao.solicitacoes.corrigir_status"
EXPECTED_RELATORIO_PERMISSION = "admin.usuarios.ler"
EXPIRES_AT = datetime(2030, 5, 27, 13, 0, tzinfo=UTC)
CREATED_AT = datetime(2026, 5, 20, 10, 30, tzinfo=UTC)
UPDATED_AT = datetime(2026, 5, 21, 8, 15, tzinfo=UTC)
HISTORICO_CREATED_AT = datetime(2026, 5, 20, 11, 30, tzinfo=UTC)
OBSERVACAO_CREATED_AT = datetime(2026, 5, 20, 12, 30, tzinfo=UTC)
OBSERVACAO_EDITED_AT = datetime(2026, 5, 20, 13, 30, tzinfo=UTC)


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


def mutating_headers(value: str = "1") -> dict[str, str]:
    return {"X-Geoportal-Internal-Request": value}


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


def fake_observacao_item() -> IluminacaoSolicitacaoObservacaoInternaItem:
    return IluminacaoSolicitacaoObservacaoInternaItem(
        id=70,
        solicitacao_id=10,
        observacao="Equipe acionada.",
        visibilidade="interna",
        usuario_id="7",
        usuario_nome="Administrador Interno",
        criado_em=OBSERVACAO_CREATED_AT,
        editado_em=OBSERVACAO_EDITED_AT,
    )


def fake_status_item(status: str = "em_execucao") -> IluminacaoSolicitacaoStatusInternaItem:
    return IluminacaoSolicitacaoStatusInternaItem(
        id=10,
        status=status,
        atualizado_em=UPDATED_AT,
        finalizado_em=None,
    )


def fake_prioridade_item(
    prioridade: str = "alta",
) -> IluminacaoSolicitacaoPrioridadeInternaItem:
    return IluminacaoSolicitacaoPrioridadeInternaItem(
        id=10,
        prioridade=prioridade,
        atualizado_em=UPDATED_AT,
    )


def fake_relatorio_item() -> IluminacaoRelatorioSolicitacaoInternaItem:
    return IluminacaoRelatorioSolicitacaoInternaItem(
        protocolo="IP-2026-000010",
        status="aberta",
        prioridade="normal",
        tipo_problema="lampada_apagada",
        poste_id="POSTE-010",
        origem="geoportal_publico",
        localizacao_tipo="poste_mapa",
        criado_em=CREATED_AT,
        atualizado_em=UPDATED_AT,
        finalizado_em=None,
        duplicidade_suspeita=False,
        tempo_finalizacao_segundos=None,
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
            "ativos": "true",
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
        "ativos": True,
        "limit": 25,
        "offset": 5,
    }


def test_internal_solicitacoes_ativos_false_and_absent_preserve_full_listing(
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
    service_calls: list[dict[str, object]] = []

    def fake_listar_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoSolicitacoesInternasResult:
        service_calls.append(dict(kwargs))
        return IluminacaoSolicitacoesInternasResult(
            items=[fake_solicitacao()],
            total=1,
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_solicitacoes_internas",
        fake_listar_solicitacoes_internas,
    )
    client = TestClient(app)

    response_false = client.get(INTERNAL_SOLICITACOES_PATH, params={"ativos": "false"})
    response_absent = client.get(INTERNAL_SOLICITACOES_PATH)

    assert response_false.status_code == 200
    assert response_absent.status_code == 200
    assert service_calls[0]["ativos"] is False
    assert service_calls[1]["ativos"] is None


def test_internal_relatorio_csv_returns_200_for_admin_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    calls: dict[str, object] = {}
    service_calls: dict[str, object] = {}

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        calls.update(
            {
                "usuario_id": usuario_id,
                "permission_code": permission_code,
            }
        )
        return True

    def fake_listar_relatorio_solicitacoes_internas(
        **kwargs: object,
    ) -> IluminacaoRelatorioSolicitacoesInternasResult:
        service_calls.update(kwargs)
        return IluminacaoRelatorioSolicitacoesInternasResult(
            items=[fake_relatorio_item()],
        )

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_relatorio_solicitacoes_internas",
        fake_listar_relatorio_solicitacoes_internas,
    )
    client = TestClient(app)

    response = client.get(
        INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH,
        params={
            "status": "aberta",
            "prioridade": "normal",
            "tipo": "lampada_apagada",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert (
        response.headers["content-disposition"]
        == 'attachment; filename="relatorio_iluminacao_geral.csv"'
    )
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_RELATORIO_PERMISSION,
    }
    assert service_calls == {
        "data_inicio": None,
        "data_fim": None,
        "status": "aberta",
        "prioridade": "normal",
        "tipo_problema": TipoProblemaIluminacao.lampada_apagada,
    }
    assert "protocolo,status,prioridade,tipo_problema" in response.text
    assert "IP-2026-000010,aberta,normal,lampada_apagada" in response.text
    for forbidden in (
        "nome_solicitante",
        "contato_solicitante",
        "observacao",
        "descricao",
        "DATABASE_URL",
        "session_secret",
    ):
        assert forbidden not in response.text


def test_internal_relatorio_resumo_returns_200_for_admin_permission(
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

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_relatorio_solicitacoes_internas",
        lambda **kwargs: IluminacaoRelatorioSolicitacoesInternasResult(
            items=[fake_relatorio_item()]
        ),
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "resumir_relatorio_solicitacoes_internas",
        lambda items: IluminacaoRelatorioResumoInternoResponse(
            total=1,
            abertas=1,
            em_triagem=0,
            em_andamento=0,
            resolvidas=0,
            canceladas=0,
            indeferidas=0,
            nao_localizadas=0,
            por_prioridade={"normal": 1},
            por_tipo_problema={"lampada_apagada": 1},
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_RELATORIO_SOLICITACOES_RESUMO_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "total": 1,
        "abertas": 1,
        "em_triagem": 0,
        "em_andamento": 0,
        "resolvidas": 0,
        "canceladas": 0,
        "indeferidas": 0,
        "nao_localizadas": 0,
        "por_prioridade": {"normal": 1},
        "por_tipo_problema": {"lampada_apagada": 1},
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_RELATORIO_PERMISSION,
    }


def test_internal_relatorio_csv_returns_403_without_admin_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    permission_calls: list[str] = []

    def fake_has_permission(usuario_id: int, permission_code: str) -> bool:
        permission_calls.append(permission_code)
        return permission_code != EXPECTED_RELATORIO_PERMISSION

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    client = TestClient(app)

    forbidden = client.get(
        INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH,
        params={},
    )
    assert forbidden.status_code == 403
    assert EXPECTED_RELATORIO_PERMISSION in permission_calls


def test_internal_relatorio_resumo_returns_422_for_invalid_period(
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

    def fail_invalid_period(**kwargs: object) -> IluminacaoRelatorioSolicitacoesInternasResult:
        raise ValueError("data_fim must be greater than or equal to data_inicio")

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_relatorio_solicitacoes_internas",
        fail_invalid_period,
    )
    client = TestClient(app)

    invalid = client.get(
        INTERNAL_RELATORIO_SOLICITACOES_RESUMO_PATH,
        params={"data_inicio": "2026-06-30", "data_fim": "2026-06-01"},
    )

    assert invalid.status_code == 422
    assert invalid.json() == {"detail": "Invalid query parameters"}


def test_internal_relatorio_csv_returns_401_without_session() -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        lambda: (_ for _ in ()).throw(
            HTTPException(status_code=401, detail="Not authenticated")
        )
    )
    client = TestClient(app)

    response = client.get(INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH)

    assert response.status_code == 401


def test_internal_relatorio_resumo_returns_503_with_sanitized_message(
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
    ) -> IluminacaoRelatorioSolicitacoesInternasResult:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_relatorio_solicitacoes_internas",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_RELATORIO_SOLICITACOES_RESUMO_PATH)

    assert response.status_code == 503
    assert response.json() == {"detail": DATABASE_UNAVAILABLE_MESSAGE}
    for forbidden in (
        "DATABASE_URL",
        "db.internal",
        "senha",
        "token",
        "cookie",
        "traceback",
    ):
        assert forbidden not in response.text


def test_internal_relatorio_csv_accepts_single_date_filters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = build_isolated_app()
    app.dependency_overrides[get_current_authenticated_session] = (
        authenticated_current_session
    )
    service_calls: list[dict[str, object]] = []

    monkeypatch.setattr(
        auth_dependencies,
        "has_permission",
        lambda usuario_id, permission_code: True,
    )
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_relatorio_solicitacoes_internas",
        lambda **kwargs: service_calls.append(kwargs)
        or IluminacaoRelatorioSolicitacoesInternasResult(items=[fake_relatorio_item()]),
    )
    client = TestClient(app)

    desde_response = client.get(
        INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH,
        params={"data_inicio": "2026-06-01"},
    )
    ate_response = client.get(
        INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH,
        params={"data_fim": "2026-06-30"},
    )

    assert desde_response.status_code == 200
    assert (
        desde_response.headers["content-disposition"]
        == 'attachment; filename="relatorio_iluminacao_desde_2026-06-01.csv"'
    )
    assert ate_response.status_code == 200
    assert (
        ate_response.headers["content-disposition"]
        == 'attachment; filename="relatorio_iluminacao_ate_2026-06-30.csv"'
    )
    assert service_calls == [
        {
            "data_inicio": datetime(2026, 6, 1, tzinfo=UTC).date(),
            "data_fim": None,
            "status": None,
            "prioridade": None,
            "tipo_problema": None,
        },
        {
            "data_inicio": None,
            "data_fim": datetime(2026, 6, 30, tzinfo=UTC).date(),
            "status": None,
            "prioridade": None,
            "tipo_problema": None,
        },
    ]


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


def test_internal_solicitacao_observacoes_returns_200_for_authenticated_user_with_permission(
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

    def fake_listar_observacoes_solicitacao_interna(
        solicitacao_id: int,
        *,
        limit: int,
        offset: int,
    ) -> IluminacaoSolicitacaoObservacoesInternasResult:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "limit": limit,
                "offset": offset,
            }
        )
        return IluminacaoSolicitacaoObservacoesInternasResult(
            items=[fake_observacao_item()],
            total=2,
        )

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "listar_observacoes_solicitacao_interna",
        fake_listar_observacoes_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.get(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        params={"limit": 25, "offset": 5},
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 70,
                "solicitacao_id": 10,
                "observacao": "Equipe acionada.",
                "visibilidade": "interna",
                "usuario_id": "7",
                "usuario_nome": "Administrador Interno",
                "criado_em": "2026-05-20T12:30:00Z",
                "editado_em": "2026-05-20T13:30:00Z",
            }
        ],
        "limit": 25,
        "offset": 5,
        "total": 2,
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_OBSERVACOES_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "limit": 25,
        "offset": 5,
    }


def test_internal_solicitacao_observacoes_returns_empty_list_when_no_observations(
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
        "listar_observacoes_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoObservacoesInternasResult(items=[], total=0)
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "limit": 50,
        "offset": 0,
        "total": 0,
    }


def test_create_internal_solicitacao_observacao_returns_201_with_permission_and_header(
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

    def fake_criar_observacao_solicitacao_interna(
        solicitacao_id: int,
        *,
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoObservacaoInternaItem:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "observacao": observacao,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        return fake_observacao_item()

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "criar_observacao_solicitacao_interna",
        fake_criar_observacao_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "  Equipe acionada.  "},
        headers=mutating_headers(),
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": 70,
        "solicitacao_id": 10,
        "observacao": "Equipe acionada.",
        "visibilidade": "interna",
        "usuario_id": "7",
        "usuario_nome": "Administrador Interno",
        "criado_em": "2026-05-20T12:30:00Z",
        "editado_em": "2026-05-20T13:30:00Z",
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_COMENTAR_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "observacao": "Equipe acionada.",
        "usuario_id": 7,
        "usuario_nome": None,
    }


def test_update_internal_solicitacao_status_returns_200_with_permission_and_header(
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

    def fake_atualizar_status_solicitacao_interna(
        solicitacao_id: int,
        *,
        status: object,
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "status": status,
                "observacao": observacao,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        return fake_status_item()

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "atualizar_status_solicitacao_interna",
        fake_atualizar_status_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={
            "status": "em_execucao",
            "observacao": "  Equipe iniciou atendimento.  ",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "solicitacao": {
            "id": 10,
            "status": "em_execucao",
            "atualizado_em": "2026-05-21T08:15:00Z",
            "finalizado_em": None,
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_ATUALIZAR_STATUS_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "status": "em_execucao",
        "observacao": "Equipe iniciou atendimento.",
        "usuario_id": 7,
        "usuario_nome": None,
    }


def test_update_internal_solicitacao_status_allows_idempotent_status(
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
        "atualizar_status_solicitacao_interna",
        lambda solicitacao_id, *, status, observacao, usuario_id, usuario_nome: (
            fake_status_item(status="aberta")
        ),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "aberta", "observacao": "Reenvio idempotente."},
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json()["solicitacao"]["status"] == "aberta"


def test_correct_internal_solicitacao_status_returns_200_with_permission_and_header(
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

    def fake_corrigir_status_solicitacao_interna(
        solicitacao_id: int,
        *,
        novo_status: object,
        justificativa: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "novo_status": novo_status,
                "justificativa": justificativa,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        status_value = getattr(novo_status, "value", novo_status)
        return fake_status_item(status=str(status_value))

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "corrigir_status_solicitacao_interna",
        fake_corrigir_status_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "  Correcao administrativa segura.  ",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "solicitacao": {
            "id": 10,
            "status": "em_execucao",
            "atualizado_em": "2026-05-21T08:15:00Z",
            "finalizado_em": None,
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_CORRIGIR_STATUS_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "novo_status": "em_execucao",
        "justificativa": "Correcao administrativa segura.",
        "usuario_id": 7,
        "usuario_nome": None,
    }


def test_correct_internal_solicitacao_status_allows_idempotent_status(
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
        "corrigir_status_solicitacao_interna",
        lambda solicitacao_id, *, novo_status, justificativa, usuario_id, usuario_nome: (
            fake_status_item(status="resolvida")
        ),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "resolvida",
            "justificativa": "Correcao administrativa idempotente.",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json()["solicitacao"]["status"] == "resolvida"


def test_update_internal_solicitacao_prioridade_returns_200_with_permission_and_header(
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

    def fake_atualizar_prioridade_solicitacao_interna(
        solicitacao_id: int,
        *,
        prioridade: str,
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoPrioridadeInternaItem:
        service_calls.update(
            {
                "solicitacao_id": solicitacao_id,
                "prioridade": prioridade,
                "observacao": observacao,
                "usuario_id": usuario_id,
                "usuario_nome": usuario_nome,
            }
        )
        return fake_prioridade_item(prioridade=prioridade)

    monkeypatch.setattr(auth_dependencies, "has_permission", fake_has_permission)
    monkeypatch.setattr(
        internal_iluminacao,
        "atualizar_prioridade_solicitacao_interna",
        fake_atualizar_prioridade_solicitacao_interna,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_PRIORIDADE_PATH,
        json={
            "prioridade": "alta",
            "observacao": "  Ajuste operacional de criticidade.  ",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "solicitacao": {
            "id": 10,
            "prioridade": "alta",
            "atualizado_em": "2026-05-21T08:15:00Z",
        }
    }
    assert calls == {
        "usuario_id": 7,
        "permission_code": EXPECTED_ATUALIZAR_PRIORIDADE_PERMISSION,
    }
    assert service_calls == {
        "solicitacao_id": 10,
        "prioridade": "alta",
        "observacao": "Ajuste operacional de criticidade.",
        "usuario_id": 7,
        "usuario_nome": None,
    }


def test_update_internal_solicitacao_prioridade_allows_idempotent_priority(
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
        "atualizar_prioridade_solicitacao_interna",
        lambda solicitacao_id, *, prioridade, observacao, usuario_id, usuario_nome: (
            fake_prioridade_item(prioridade="normal")
        ),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_PRIORIDADE_PATH,
        json={"prioridade": "normal", "observacao": "Reenvio idempotente."},
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    assert response.json()["solicitacao"]["prioridade"] == "normal"


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


def test_internal_solicitacao_observacoes_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_create_internal_solicitacao_observacao_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_update_internal_solicitacao_status_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_correct_internal_solicitacao_status_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "Correcao administrativa segura.",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_update_internal_solicitacao_prioridade_returns_401_without_valid_session() -> None:
    app = build_isolated_app()

    def fake_auth_failure() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_authenticated_session] = fake_auth_failure
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_PRIORIDADE_PATH,
        json={"prioridade": "alta", "observacao": "Ajuste operacional."},
        headers=mutating_headers(),
    )

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


def test_internal_solicitacao_observacoes_returns_403_without_required_permission(
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
        "listar_observacoes_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoObservacoesInternasResult(
                items=[fake_observacao_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_OBSERVACOES_PERMISSION not in response.text
    assert "Equipe acionada" not in response.text


def test_create_internal_solicitacao_observacao_returns_403_without_required_permission(
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
        "criar_observacao_solicitacao_interna",
        lambda *args, **kwargs: fake_observacao_item(),
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_COMENTAR_PERMISSION not in response.text
    assert "Equipe acionada" not in response.text


def test_update_internal_solicitacao_status_returns_403_without_required_permission(
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
        "atualizar_status_solicitacao_interna",
        lambda *args, **kwargs: fake_status_item(),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_ATUALIZAR_STATUS_PERMISSION not in response.text
    assert "em_execucao" not in response.text


def test_correct_internal_solicitacao_status_returns_403_without_required_permission(
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
        "corrigir_status_solicitacao_interna",
        lambda *args, **kwargs: fake_status_item(),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "Correcao administrativa segura.",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_CORRIGIR_STATUS_PERMISSION not in response.text
    assert "em_execucao" not in response.text


def test_update_internal_solicitacao_prioridade_returns_403_without_required_permission(
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
        "atualizar_prioridade_solicitacao_interna",
        lambda *args, **kwargs: fake_prioridade_item(),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_PRIORIDADE_PATH,
        json={"prioridade": "alta", "observacao": "Ajuste operacional."},
        headers=mutating_headers(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert EXPECTED_ATUALIZAR_PRIORIDADE_PERMISSION not in response.text
    assert "alta" not in response.text


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


def test_get_internal_solicitacao_observacoes_does_not_require_mutating_header(
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
        "listar_observacoes_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoObservacoesInternasResult(
                items=[fake_observacao_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 200


@pytest.mark.parametrize("headers", ({}, mutating_headers("0")))
def test_create_internal_solicitacao_observacao_requires_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
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
        "criar_observacao_solicitacao_interna",
        lambda *args, **kwargs: fake_observacao_item(),
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}
    assert "Equipe acionada" not in response.text


@pytest.mark.parametrize("headers", ({}, mutating_headers("0")))
def test_update_internal_solicitacao_status_requires_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
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
        "atualizar_status_solicitacao_interna",
        lambda *args, **kwargs: fake_status_item(),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}
    assert "em_execucao" not in response.text


@pytest.mark.parametrize("headers", ({}, mutating_headers("0")))
def test_correct_internal_solicitacao_status_requires_mutating_header(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
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
        "corrigir_status_solicitacao_interna",
        lambda *args, **kwargs: fake_status_item(),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "Correcao administrativa segura.",
        },
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid internal request"}
    assert "em_execucao" not in response.text


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


def test_internal_solicitacao_observacoes_returns_404_when_solicitacao_not_found(
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
    ) -> IluminacaoSolicitacaoObservacoesInternasResult:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_observacoes_solicitacao_interna",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_create_internal_solicitacao_observacao_returns_404_when_solicitacao_not_found(
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
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoObservacaoInternaItem:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "criar_observacao_solicitacao_interna",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=mutating_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_update_internal_solicitacao_status_returns_404_when_solicitacao_not_found(
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
        status: object,
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "atualizar_status_solicitacao_interna",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=mutating_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_update_internal_solicitacao_status_returns_409_for_invalid_transition(
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

    def fail_invalid_transition(*args: object, **kwargs: object) -> None:
        raise internal_iluminacao.SolicitacaoInternaStatusTransitionError(
            "Transicao de status invalida."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "atualizar_status_solicitacao_interna",
        fail_invalid_transition,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "aberta", "observacao": "Tentativa de reabertura."},
        headers=mutating_headers(),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Invalid status transition"}
    assert "Transicao" not in response.text


def test_correct_internal_solicitacao_status_returns_404_when_solicitacao_not_found(
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
        novo_status: object,
        justificativa: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        raise internal_iluminacao.SolicitacaoInternaNotFoundError(
            "Solicitacao nao encontrada."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "corrigir_status_solicitacao_interna",
        fail_not_found,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "Correcao administrativa segura.",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert "Solicitacao nao encontrada" not in response.text


def test_correct_internal_solicitacao_status_returns_409_for_invalid_correction(
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

    def fail_invalid_correction(*args: object, **kwargs: object) -> None:
        raise internal_iluminacao.SolicitacaoInternaStatusCorrecaoError(
            "Correcao administrativa de status invalida."
        )

    monkeypatch.setattr(
        internal_iluminacao,
        "corrigir_status_solicitacao_interna",
        fail_invalid_correction,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "aberta",
            "justificativa": "Correcao administrativa bloqueada.",
        },
        headers=mutating_headers(),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Invalid administrative status correction"}
    assert "Correcao" not in response.text


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


def test_internal_solicitacao_observacoes_database_error_is_sanitized(
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
    ) -> IluminacaoSolicitacaoObservacoesInternasResult:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "listar_observacoes_solicitacao_interna",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

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


def test_create_internal_solicitacao_observacao_database_error_is_sanitized(
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
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoObservacaoInternaItem:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "criar_observacao_solicitacao_interna",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=mutating_headers(),
    )

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


def test_update_internal_solicitacao_status_database_error_is_sanitized(
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
        status: object,
        observacao: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "atualizar_status_solicitacao_interna",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=mutating_headers(),
    )

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


def test_correct_internal_solicitacao_status_database_error_is_sanitized(
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
        novo_status: object,
        justificativa: str,
        usuario_id: int,
        usuario_nome: str | None = None,
    ) -> IluminacaoSolicitacaoStatusInternaItem:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    monkeypatch.setattr(
        internal_iluminacao,
        "corrigir_status_solicitacao_interna",
        fail_with_database_error,
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
        json={
            "novo_status": "em_execucao",
            "justificativa": "Correcao administrativa segura.",
        },
        headers=mutating_headers(),
    )

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
        {"ativos": "abc"},
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


def test_internal_solicitacao_observacoes_validates_query_params(
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
        ("/api/internal/iluminacao/solicitacoes/0/observacoes", {}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"limit": 0}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"limit": 101}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"offset": -1}),
    ):
        response = client.get(path, params=params)
        assert response.status_code == 422


def test_create_internal_solicitacao_observacao_validates_path_and_payload(
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

    for path, payload in (
        ("/api/internal/iluminacao/solicitacoes/0/observacoes", {"observacao": "Ok."}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"observacao": ""}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"observacao": "  "}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"observacao": " ab "}),
        (INTERNAL_SOLICITACAO_OBSERVACOES_PATH, {"observacao": "a" * 2001}),
        (
            INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
            {"observacao": "Equipe acionada.", "visibilidade": "publica_futura"},
        ),
        (
            INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
            {"observacao": "Equipe acionada.", "usuario_id": "7"},
        ),
    ):
        response = client.post(path, json=payload, headers=mutating_headers())
        assert response.status_code == 422


def test_update_internal_solicitacao_status_validates_path_and_payload(
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

    for path, payload in (
        (
            "/api/internal/iluminacao/solicitacoes/0/status",
            {"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        ),
        (INTERNAL_SOLICITACAO_STATUS_PATH, {"observacao": "Equipe iniciou."}),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {"status": "rejeitada", "observacao": "Status invalido."},
        ),
        (INTERNAL_SOLICITACAO_STATUS_PATH, {"status": "em_execucao"}),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {"status": "em_execucao", "observacao": ""},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {"status": "em_execucao", "observacao": "  "},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {"status": "em_execucao", "observacao": " ab "},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {"status": "em_execucao", "observacao": "a" * 1001},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {
                "status": "em_execucao",
                "observacao": "Equipe iniciou atendimento.",
                "prioridade": "alta",
            },
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_PATH,
            {
                "status": "em_execucao",
                "observacao": "Equipe iniciou atendimento.",
                "usuario_id": "7",
            },
        ),
    ):
        response = client.patch(path, json=payload, headers=mutating_headers())
        assert response.status_code == 422


def test_correct_internal_solicitacao_status_validates_path_and_payload(
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

    for path, payload in (
        (
            "/api/internal/iluminacao/solicitacoes/0/status-correcao",
            {
                "novo_status": "em_execucao",
                "justificativa": "Correcao administrativa segura.",
            },
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"justificativa": "Correcao administrativa segura."},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "rejeitada", "justificativa": "Status invalido."},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "em_execucao"},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "em_execucao", "justificativa": ""},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "em_execucao", "justificativa": "  "},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "em_execucao", "justificativa": " curta "},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {"novo_status": "em_execucao", "justificativa": "a" * 1001},
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {
                "novo_status": "em_execucao",
                "justificativa": "Correcao administrativa segura.",
                "status": "resolvida",
            },
        ),
        (
            INTERNAL_SOLICITACAO_STATUS_CORRECAO_PATH,
            {
                "novo_status": "em_execucao",
                "justificativa": "Correcao administrativa segura.",
                "usuario_id": "7",
            },
        ),
    ):
        response = client.patch(path, json=payload, headers=mutating_headers())
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


def test_internal_solicitacao_observacoes_response_does_not_expose_sensitive_fields(
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
        "listar_observacoes_solicitacao_interna",
        lambda solicitacao_id, *, limit, offset: (
            IluminacaoSolicitacaoObservacoesInternasResult(
                items=[fake_observacao_item()],
                total=1,
            )
        ),
    )
    client = TestClient(app)

    response = client.get(INTERNAL_SOLICITACAO_OBSERVACOES_PATH)

    assert response.status_code == 200
    response_text = response.text
    body = response.json()
    assert set(body) == {"items", "limit", "offset", "total"}
    assert body["total"] == 1
    assert set(body["items"][0]) == {
        "id",
        "solicitacao_id",
        "observacao",
        "visibilidade",
        "usuario_id",
        "usuario_nome",
        "criado_em",
        "editado_em",
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
        "publica_futura",
        "anexos",
    ):
        assert forbidden not in response_text


def test_create_internal_solicitacao_observacao_response_does_not_expose_sensitive_fields(
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
        "criar_observacao_solicitacao_interna",
        lambda solicitacao_id, *, observacao, usuario_id, usuario_nome: (
            fake_observacao_item()
        ),
    )
    client = TestClient(app)

    response = client.post(
        INTERNAL_SOLICITACAO_OBSERVACOES_PATH,
        json={"observacao": "Equipe acionada."},
        headers=mutating_headers(),
    )

    assert response.status_code == 201
    response_text = response.text
    body = response.json()
    assert set(body) == {
        "id",
        "solicitacao_id",
        "observacao",
        "visibilidade",
        "usuario_id",
        "usuario_nome",
        "criado_em",
        "editado_em",
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
        "publica_futura",
        "historico",
        "anexos",
    ):
        assert forbidden not in response_text


def test_update_internal_solicitacao_status_response_does_not_expose_sensitive_fields(
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
        "atualizar_status_solicitacao_interna",
        lambda solicitacao_id, *, status, observacao, usuario_id, usuario_nome: (
            fake_status_item()
        ),
    )
    client = TestClient(app)

    response = client.patch(
        INTERNAL_SOLICITACAO_STATUS_PATH,
        json={"status": "em_execucao", "observacao": "Equipe iniciou atendimento."},
        headers=mutating_headers(),
    )

    assert response.status_code == 200
    response_text = response.text
    body = response.json()
    assert set(body) == {"solicitacao"}
    assert set(body["solicitacao"]) == {
        "id",
        "status",
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
        "prioridade",
        "protocolo",
        "nome_solicitante",
        "contato_solicitante",
        "observacao",
        "historico",
        "anexos",
    ):
        assert forbidden not in response_text


def test_internal_iluminacao_router_uses_permission_without_hardcoded_login() -> None:
    source = inspect.getsource(internal_iluminacao)
    route_paths = {route.path for route in internal_iluminacao.router.routes}

    assert INTERNAL_SOLICITACOES_PATH in route_paths
    assert INTERNAL_RELATORIO_SOLICITACOES_CSV_PATH in route_paths
    assert INTERNAL_RELATORIO_SOLICITACOES_RESUMO_PATH in route_paths
    assert INTERNAL_SOLICITACAO_DETAIL_ROUTE in route_paths
    assert INTERNAL_SOLICITACAO_HISTORICO_ROUTE in route_paths
    assert INTERNAL_SOLICITACAO_OBSERVACOES_ROUTE in route_paths
    assert INTERNAL_SOLICITACAO_STATUS_ROUTE in route_paths
    assert INTERNAL_SOLICITACAO_STATUS_CORRECAO_ROUTE in route_paths
    assert "require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)" in source
    assert "require_permission(LIST_INTERNAL_ILUMINACAO_HISTORICO_PERMISSION)" in source
    assert "require_permission(LIST_INTERNAL_ILUMINACAO_OBSERVACOES_PERMISSION)" in source
    assert "require_permission(CREATE_INTERNAL_ILUMINACAO_OBSERVACAO_PERMISSION)" in source
    assert "require_permission(UPDATE_INTERNAL_ILUMINACAO_STATUS_PERMISSION)" in source
    assert "require_permission(CORRIGIR_INTERNAL_ILUMINACAO_STATUS_PERMISSION)" in source
    assert "require_permission(EXPORT_INTERNAL_ILUMINACAO_RELATORIO_PERMISSION)" in source
    assert EXPECTED_PERMISSION in source
    assert EXPECTED_HISTORICO_PERMISSION in source
    assert EXPECTED_OBSERVACOES_PERMISSION in source
    assert EXPECTED_COMENTAR_PERMISSION in source
    assert EXPECTED_ATUALIZAR_STATUS_PERMISSION in source
    assert EXPECTED_CORRIGIR_STATUS_PERMISSION in source
    assert EXPECTED_RELATORIO_PERMISSION in source
    assert "admin.homologacao" not in source
    assert "login ==" not in source
    assert "require_internal_mutating_request_header" in source
    assert "DELETE" not in source.upper()


def test_public_iluminacao_health_is_not_affected() -> None:
    client = TestClient(main_app)

    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
