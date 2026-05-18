from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.repositories import iluminacao_repository
from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.exceptions import DatabaseUnavailableError
from app.services.protocol_service import generate_protocol, generate_protocol_from_database

DATABASE_UNAVAILABLE_MESSAGE = (
    "Servico temporariamente indisponivel. Tente novamente mais tarde."
)


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    if settings.persist_solicitacoes:
        try:
            protocolo = generate_protocol_from_database()
            return iluminacao_repository.create_solicitacao(solicitacao, protocolo)
        except (SQLAlchemyError, RuntimeError) as exc:
            raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    protocolo = generate_protocol(prefix="IP", year=2026, sequence=1)

    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo=protocolo,
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitação registrada em ambiente de teste.",
    )
