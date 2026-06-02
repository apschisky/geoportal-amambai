from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.dependencies.auth_dependencies import require_permission
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoHistoricoInternoResponse,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResponse,
    IluminacaoSolicitacoesInternasResponse,
    StatusSolicitacaoIluminacao,
    TipoProblemaIluminacao,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import listar_historico_solicitacao_interna
from app.services.iluminacao_service import listar_observacoes_solicitacao_interna
from app.services.iluminacao_service import listar_solicitacoes_internas
from app.services.iluminacao_service import obter_solicitacao_interna_por_id
from app.services.iluminacao_service import SolicitacaoInternaNotFoundError


LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION = "iluminacao.solicitacoes.ler"
LIST_INTERNAL_ILUMINACAO_HISTORICO_PERMISSION = (
    "iluminacao.solicitacoes.ver_historico"
)
LIST_INTERNAL_ILUMINACAO_OBSERVACOES_PERMISSION = (
    "iluminacao.solicitacoes.ver_observacoes"
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
