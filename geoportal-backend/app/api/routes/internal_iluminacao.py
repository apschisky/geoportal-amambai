from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.dependencies import auth_dependencies
from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import require_permission
from app.schemas.iluminacao import (
    IluminacaoDashboardRankingInternoResponse,
    IluminacaoDashboardResumoInternoResponse,
    IluminacaoDashboardSeriesInternoResponse,
    IluminacaoMapaOcorrenciaPopupResponse,
    IluminacaoMapaOcorrenciasResponse,
    IluminacaoRelatorioResumoInternoResponse,
    IluminacaoSolicitacaoHistoricoInternoResponse,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaCreate,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResponse,
    IluminacaoSolicitacaoPrioridadeInternaResponse,
    IluminacaoSolicitacaoPrioridadeInternaUpdate,
    IluminacaoSolicitacaoStatusCorrecaoInternaUpdate,
    IluminacaoSolicitacaoStatusInternaResponse,
    IluminacaoSolicitacaoStatusInternaUpdate,
    IluminacaoSolicitacoesInternasResponse,
    StatusSolicitacaoIluminacao,
    TipoProblemaIluminacao,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import criar_observacao_solicitacao_interna
from app.services.iluminacao_service import atualizar_status_solicitacao_interna
from app.services.iluminacao_service import atualizar_prioridade_solicitacao_interna
from app.services.iluminacao_service import build_relatorio_solicitacoes_csv
from app.services.iluminacao_service import corrigir_status_solicitacao_interna
from app.services.iluminacao_service import listar_historico_solicitacao_interna
from app.services.iluminacao_service import listar_mapa_ocorrencias_internas
from app.services.iluminacao_service import listar_observacoes_solicitacao_interna
from app.services.iluminacao_service import listar_relatorio_solicitacoes_internas
from app.services.iluminacao_service import listar_solicitacoes_internas
from app.services.iluminacao_service import montar_nome_arquivo_relatorio_solicitacoes
from app.services.iluminacao_service import obter_dashboard_ranking_interno
from app.services.iluminacao_service import obter_dashboard_resumo_interno
from app.services.iluminacao_service import obter_dashboard_series_interno
from app.services.iluminacao_service import obter_mapa_ocorrencia_popup_interno
from app.services.iluminacao_service import obter_solicitacao_interna_por_id
from app.services.iluminacao_service import resumir_relatorio_solicitacoes_internas
from app.services.iluminacao_service import SolicitacaoInternaNotFoundError
from app.services.iluminacao_service import (
    SolicitacaoInternaPrioridadeTerminalStatusError,
)
from app.services.iluminacao_service import SolicitacaoInternaStatusTransitionError
from app.services.iluminacao_service import SolicitacaoInternaStatusCorrecaoError


LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION = "iluminacao.solicitacoes.ler"
LIST_INTERNAL_ILUMINACAO_HISTORICO_PERMISSION = (
    "iluminacao.solicitacoes.ver_historico"
)
LIST_INTERNAL_ILUMINACAO_OBSERVACOES_PERMISSION = (
    "iluminacao.solicitacoes.ver_observacoes"
)
CREATE_INTERNAL_ILUMINACAO_OBSERVACAO_PERMISSION = "iluminacao.solicitacoes.comentar"
UPDATE_INTERNAL_ILUMINACAO_STATUS_PERMISSION = (
    "iluminacao.solicitacoes.atualizar_status"
)
UPDATE_INTERNAL_ILUMINACAO_PRIORIDADE_PERMISSION = (
    "iluminacao.solicitacoes.atualizar_prioridade"
)
CORRIGIR_INTERNAL_ILUMINACAO_STATUS_PERMISSION = (
    "iluminacao.solicitacoes.corrigir_status"
)
EXPORT_INTERNAL_ILUMINACAO_RELATORIO_PERMISSION = "admin.usuarios.ler"
READ_INTERNAL_ILUMINACAO_DASHBOARD_PERMISSION = "iluminacao.dashboard.ler"
READ_INTERNAL_ILUMINACAO_CONTACT_DATA_PERMISSION = (
    "iluminacao.solicitacoes.ver_dados_contato"
)
router = APIRouter(prefix="/api/internal/iluminacao", tags=["internal-iluminacao"])


@router.get("/mapa/ocorrencias", response_model=IluminacaoMapaOcorrenciasResponse)
def list_internal_mapa_ocorrencias(
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    ativos: bool | None = Query(default=None),
    limit: int = Query(default=250, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)
    ),
) -> IluminacaoMapaOcorrenciasResponse:
    try:
        result = listar_mapa_ocorrencias_internas(
            status=status_filter,
            prioridade=prioridade,
            ativos=ativos,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoMapaOcorrenciasResponse(
        items=result.items,
        limit=limit,
        offset=offset,
        total=result.total,
    )


@router.get(
    "/mapa/ocorrencias/{solicitacao_id}/popup",
    response_model=IluminacaoMapaOcorrenciaPopupResponse,
)
def get_internal_mapa_ocorrencia_popup(
    solicitacao_id: int = Path(ge=1),
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)
    ),
) -> IluminacaoMapaOcorrenciaPopupResponse:
    try:
        incluir_dados_contato = auth_dependencies.has_permission(
            current_session.usuario_id,
            READ_INTERNAL_ILUMINACAO_CONTACT_DATA_PERMISSION,
        )
        return obter_mapa_ocorrencia_popup_interno(
            solicitacao_id,
            incluir_dados_contato=incluir_dados_contato,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get("/solicitacoes", response_model=IluminacaoSolicitacoesInternasResponse)
def list_internal_solicitacoes(
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    protocolo: str | None = Query(default=None, min_length=1, max_length=20),
    poste_id: str | None = Query(default=None, min_length=1, max_length=80),
    tipo_problema: TipoProblemaIluminacao | None = Query(default=None),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    criado_de: datetime | None = Query(default=None),
    criado_ate: datetime | None = Query(default=None),
    ativos: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)
    ),
) -> IluminacaoSolicitacoesInternasResponse:
    try:
        result = listar_solicitacoes_internas(
            status=status_filter,
            protocolo=protocolo,
            poste_id=poste_id,
            tipo_problema=tipo_problema,
            prioridade=prioridade,
            criado_de=criado_de,
            criado_ate=criado_ate,
            ativos=ativos,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacoesInternasResponse(
        items=result.items,
        limit=limit,
        offset=offset,
        total=result.total,
    )


@router.get("/relatorios/solicitacoes.csv")
def export_internal_solicitacoes_report_csv(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    tipo_problema: TipoProblemaIluminacao | None = Query(default=None, alias="tipo"),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(EXPORT_INTERNAL_ILUMINACAO_RELATORIO_PERMISSION)
    ),
) -> Response:
    try:
        result = listar_relatorio_solicitacoes_internas(
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=status_filter,
            prioridade=prioridade,
            tipo_problema=tipo_problema,
        )
        csv_content = build_relatorio_solicitacoes_csv(result.items)
        filename = montar_nome_arquivo_relatorio_solicitacoes(
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get(
    "/relatorios/solicitacoes/resumo",
    response_model=IluminacaoRelatorioResumoInternoResponse,
)
def get_internal_solicitacoes_report_summary(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    tipo_problema: TipoProblemaIluminacao | None = Query(default=None, alias="tipo"),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(EXPORT_INTERNAL_ILUMINACAO_RELATORIO_PERMISSION)
    ),
) -> IluminacaoRelatorioResumoInternoResponse:
    try:
        result = listar_relatorio_solicitacoes_internas(
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=status_filter,
            prioridade=prioridade,
            tipo_problema=tipo_problema,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return resumir_relatorio_solicitacoes_internas(result.items)


@router.get(
    "/dashboard/resumo",
    response_model=IluminacaoDashboardResumoInternoResponse,
)
def get_internal_dashboard_summary(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    tipo_problema: TipoProblemaIluminacao | None = Query(default=None, alias="tipo"),
    ativos: bool | None = Query(default=None),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(READ_INTERNAL_ILUMINACAO_DASHBOARD_PERMISSION)
    ),
) -> IluminacaoDashboardResumoInternoResponse:
    try:
        return obter_dashboard_resumo_interno(
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=status_filter,
            prioridade=prioridade,
            tipo_problema=tipo_problema,
            ativos=ativos,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get(
    "/dashboard/ranking",
    response_model=IluminacaoDashboardRankingInternoResponse,
)
def get_internal_dashboard_ranking(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    prioridade: str | None = Query(default=None, min_length=1, max_length=40),
    tipo_problema: TipoProblemaIluminacao | None = Query(default=None, alias="tipo"),
    limit: int = Query(default=10, ge=1, le=20),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(READ_INTERNAL_ILUMINACAO_DASHBOARD_PERMISSION)
    ),
) -> IluminacaoDashboardRankingInternoResponse:
    try:
        return obter_dashboard_ranking_interno(
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=status_filter,
            prioridade=prioridade,
            tipo_problema=tipo_problema,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get(
    "/dashboard/series",
    response_model=IluminacaoDashboardSeriesInternoResponse,
)
def get_internal_dashboard_series(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    granularidade: str = Query(default="dia", min_length=1, max_length=10),
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(READ_INTERNAL_ILUMINACAO_DASHBOARD_PERMISSION)
    ),
) -> IluminacaoDashboardSeriesInternoResponse:
    try:
        return obter_dashboard_series_interno(
            data_inicio=data_inicio,
            data_fim=data_fim,
            granularidade=granularidade,
            status=status_filter,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get(
    "/solicitacoes/{solicitacao_id}",
    response_model=IluminacaoSolicitacaoInternaItem,
)
def get_internal_solicitacao_detail(
    solicitacao_id: int = Path(ge=1),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)
    ),
) -> IluminacaoSolicitacaoInternaItem:
    try:
        return obter_solicitacao_interna_por_id(solicitacao_id)
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get(
    "/solicitacoes/{solicitacao_id}/historico",
    response_model=IluminacaoSolicitacaoHistoricoInternoResponse,
)
def list_internal_solicitacao_historico(
    solicitacao_id: int = Path(ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_HISTORICO_PERMISSION)
    ),
) -> IluminacaoSolicitacaoHistoricoInternoResponse:
    try:
        result = listar_historico_solicitacao_interna(
            solicitacao_id,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacaoHistoricoInternoResponse(
        items=result.items,
        limit=limit,
        offset=offset,
        total=result.total,
    )


@router.get(
    "/solicitacoes/{solicitacao_id}/observacoes",
    response_model=IluminacaoSolicitacaoObservacoesInternasResponse,
)
def list_internal_solicitacao_observacoes(
    solicitacao_id: int = Path(ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_OBSERVACOES_PERMISSION)
    ),
) -> IluminacaoSolicitacaoObservacoesInternasResponse:
    try:
        result = listar_observacoes_solicitacao_interna(
            solicitacao_id,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid query parameters",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacaoObservacoesInternasResponse(
        items=result.items,
        limit=limit,
        offset=offset,
        total=result.total,
    )


@router.post(
    "/solicitacoes/{solicitacao_id}/observacoes",
    response_model=IluminacaoSolicitacaoObservacaoInternaItem,
    status_code=status.HTTP_201_CREATED,
)
def create_internal_solicitacao_observacao(
    payload: IluminacaoSolicitacaoObservacaoInternaCreate,
    solicitacao_id: int = Path(ge=1),
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(CREATE_INTERNAL_ILUMINACAO_OBSERVACAO_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> IluminacaoSolicitacaoObservacaoInternaItem:
    try:
        return criar_observacao_solicitacao_interna(
            solicitacao_id,
            observacao=payload.observacao,
            usuario_id=current_session.usuario_id,
            usuario_nome=None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid payload",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.patch(
    "/solicitacoes/{solicitacao_id}/status",
    response_model=IluminacaoSolicitacaoStatusInternaResponse,
)
def update_internal_solicitacao_status(
    payload: IluminacaoSolicitacaoStatusInternaUpdate,
    solicitacao_id: int = Path(ge=1),
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(UPDATE_INTERNAL_ILUMINACAO_STATUS_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> IluminacaoSolicitacaoStatusInternaResponse:
    try:
        solicitacao = atualizar_status_solicitacao_interna(
            solicitacao_id,
            status=payload.status,
            observacao=payload.observacao,
            usuario_id=current_session.usuario_id,
            usuario_nome=None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid payload",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except SolicitacaoInternaStatusTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invalid status transition",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacaoStatusInternaResponse(solicitacao=solicitacao)


@router.patch(
    "/solicitacoes/{solicitacao_id}/status-correcao",
    response_model=IluminacaoSolicitacaoStatusInternaResponse,
)
def correct_internal_solicitacao_status(
    payload: IluminacaoSolicitacaoStatusCorrecaoInternaUpdate,
    solicitacao_id: int = Path(ge=1),
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(CORRIGIR_INTERNAL_ILUMINACAO_STATUS_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> IluminacaoSolicitacaoStatusInternaResponse:
    try:
        solicitacao = corrigir_status_solicitacao_interna(
            solicitacao_id,
            novo_status=payload.novo_status,
            justificativa=payload.justificativa,
            usuario_id=current_session.usuario_id,
            usuario_nome=None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid payload",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except SolicitacaoInternaStatusCorrecaoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invalid administrative status correction",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacaoStatusInternaResponse(solicitacao=solicitacao)


@router.patch(
    "/solicitacoes/{solicitacao_id}/prioridade",
    response_model=IluminacaoSolicitacaoPrioridadeInternaResponse,
)
def update_internal_solicitacao_prioridade(
    payload: IluminacaoSolicitacaoPrioridadeInternaUpdate,
    solicitacao_id: int = Path(ge=1),
    current_session: AuthenticatedCurrentSession = Depends(
        require_permission(UPDATE_INTERNAL_ILUMINACAO_PRIORIDADE_PERMISSION)
    ),
    _internal_request: None = Depends(require_internal_mutating_request_header),
) -> IluminacaoSolicitacaoPrioridadeInternaResponse:
    try:
        solicitacao = atualizar_prioridade_solicitacao_interna(
            solicitacao_id,
            prioridade=payload.prioridade,
            observacao=payload.observacao,
            usuario_id=current_session.usuario_id,
            usuario_nome=None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid payload",
        ) from exc
    except SolicitacaoInternaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        ) from exc
    except SolicitacaoInternaPrioridadeTerminalStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invalid priority transition",
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacaoPrioridadeInternaResponse(solicitacao=solicitacao)
