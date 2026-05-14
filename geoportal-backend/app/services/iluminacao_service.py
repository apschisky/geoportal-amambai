from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.protocol_service import generate_protocol


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo=generate_protocol(prefix="IP", year=2026, sequence=1),
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
