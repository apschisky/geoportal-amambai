from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.rate_limit import check_rate_limit
from app.schemas.common import IluminacaoHealthResponse
from app.schemas.iluminacao import (
    IluminacaoConsultaPublicResponse,
    IluminacaoConsultaRequest,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
)
from app.services.exceptions import DatabaseUnavailableError, PublicConsultaNotFoundError
from app.services.iluminacao_service import (
    PUBLIC_CONSULTA_NOT_FOUND_MESSAGE,
    consultar_solicitacao_publica,
    create_solicitacao_simulada,
)

RATE_LIMIT_MESSAGE = "Muitas solicitacoes em pouco tempo. Tente novamente mais tarde."

router = APIRouter(prefix="/public/iluminacao", tags=["iluminacao-publica"])


@router.get("/health", response_model=IluminacaoHealthResponse)
def iluminacao_public_health_check() -> IluminacaoHealthResponse:
    return IluminacaoHealthResponse(status="ok", module="iluminacao-publica")


@router.post("/solicitacoes", response_model=IluminacaoSolicitacaoResponse, status_code=201)
def create_iluminacao_solicitacao(
    request: Request,
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    client_ip = request.client.host if request.client else "unknown"

    if settings.rate_limit_enabled and not check_rate_limit(
        client_ip,
        settings.rate_limit_max_requests,
        settings.rate_limit_window_seconds,
    ):
        raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)

    try:
        return create_solicitacao_simulada(solicitacao)
    except DatabaseUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/consulta", response_model=IluminacaoConsultaPublicResponse)
def consulta_iluminacao_solicitacao(
    request: Request,
    consulta: IluminacaoConsultaRequest,
) -> IluminacaoConsultaPublicResponse:
    client_ip = request.client.host if request.client else "unknown"

    if settings.rate_limit_enabled and not check_rate_limit(
        client_ip,
        settings.rate_limit_max_requests,
        settings.rate_limit_window_seconds,
    ):
        raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)

    try:
        return consultar_solicitacao_publica(consulta)
    except PublicConsultaNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=PUBLIC_CONSULTA_NOT_FOUND_MESSAGE,
        ) from exc
    except DatabaseUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
