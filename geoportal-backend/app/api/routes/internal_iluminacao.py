from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies.auth_dependencies import require_permission
from app.schemas.iluminacao import (
    IluminacaoSolicitacoesInternasResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.auth_current_session_service import AuthenticatedCurrentSession
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import listar_solicitacoes_internas


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
