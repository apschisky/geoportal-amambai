from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.dependencies.auth_dependencies import require_internal_mutating_request_header
from app.dependencies.auth_dependencies import require_permission
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoHistoricoInternoResponse,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaCreate,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResponse,
    IluminacaoSolicitacaoPrioridadeInternaResponse,
    IluminacaoSolicitacaoPrioridadeInternaUpdate,
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
from app.services.iluminacao_service import listar_historico_solicitacao_interna
from app.services.iluminacao_service import listar_observacoes_solicitacao_interna
from app.services.iluminacao_service import listar_solicitacoes_internas
from app.services.iluminacao_service import obter_solicitacao_interna_por_id
from app.services.iluminacao_service import SolicitacaoInternaNotFoundError
from app.services.iluminacao_service import (
    SolicitacaoInternaPrioridadeTerminalStatusError,
)
from app.services.iluminacao_service import SolicitacaoInternaStatusTransitionError


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

router = APIRouter(prefix="/api/internal/iluminacao", tags=["internal-iluminacao"])


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
