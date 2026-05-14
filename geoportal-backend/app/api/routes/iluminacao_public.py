from fastapi import APIRouter

from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)


router = APIRouter(prefix="/public/iluminacao", tags=["iluminacao-publica"])


@router.get("/health")
def iluminacao_public_health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "module": "iluminacao-publica",
    }


@router.post("/solicitacoes", response_model=IluminacaoSolicitacaoResponse, status_code=201)
def create_iluminacao_solicitacao(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    # POC sem persistência em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo="IP-2026-000001",
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
