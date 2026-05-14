from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo="IP-2026-000001",
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
