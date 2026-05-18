from fastapi import APIRouter, HTTPException

from app.schemas.common import IluminacaoHealthResponse
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
)
from app.services.exceptions import DatabaseUnavailableError
from app.services.iluminacao_service import create_solicitacao_simulada


router = APIRouter(prefix="/public/iluminacao", tags=["iluminacao-publica"])


@router.get("/health", response_model=IluminacaoHealthResponse)
def iluminacao_public_health_check() -> IluminacaoHealthResponse:
    return IluminacaoHealthResponse(status="ok", module="iluminacao-publica")


@router.post("/solicitacoes", response_model=IluminacaoSolicitacaoResponse, status_code=201)
def create_iluminacao_solicitacao(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    try:
        return create_solicitacao_simulada(solicitacao)
    except DatabaseUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
