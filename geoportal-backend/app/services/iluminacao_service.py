from app.core.config import settings
from app.repositories import iluminacao_repository
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.protocol_service import generate_protocol


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    protocolo = generate_protocol(prefix="IP", year=2026, sequence=1)

    if settings.persist_solicitacoes:
        return iluminacao_repository.create_solicitacao(solicitacao, protocolo)

    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo=protocolo,
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
