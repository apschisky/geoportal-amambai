from app.core.config import settings
from app.repositories import iluminacao_repository
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.protocol_service import generate_protocol, generate_protocol_from_database


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    if settings.persist_solicitacoes:
        protocolo = generate_protocol_from_database()
        return iluminacao_repository.create_solicitacao(solicitacao, protocolo)

    protocolo = generate_protocol(prefix="IP", year=2026, sequence=1)

    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo=protocolo,
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
