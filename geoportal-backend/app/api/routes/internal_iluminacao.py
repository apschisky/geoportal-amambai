from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.dependencies.auth_dependencies import require_permission
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacoesInternasResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import listar_solicitacoes_internas
from app.services.iluminacao_service import obter_solicitacao_interna_por_id
from app.services.iluminacao_service import SolicitacaoInternaNotFoundError


LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION = "iluminacao.solicitacoes.ler"

router = APIRouter(prefix="/api/internal/iluminacao", tags=["internal-iluminacao"])


@router.get("/solicitacoes", response_model=IluminacaoSolicitacoesInternasResponse)
def list_internal_solicitacoes(
    status_filter: StatusSolicitacaoIluminacao | None = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _current_session: AuthenticatedCurrentSession = Depends(
        require_permission(LIST_INTERNAL_ILUMINACAO_SOLICITACOES_PERMISSION)
    ),
) -> IluminacaoSolicitacoesInternasResponse:
    try:
        items = listar_solicitacoes_internas(
            status=status_filter,
            limit=limit,
            offset=offset,
        )
    except DatabaseUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return IluminacaoSolicitacoesInternasResponse(
        items=items,
        limit=limit,
        offset=offset,
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
