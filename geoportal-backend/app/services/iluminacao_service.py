import re

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.repositories import iluminacao_repository
from app.schemas.iluminacao import (
    IluminacaoConsultaPublicResponse,
    IluminacaoConsultaRepositoryRecord,
    IluminacaoConsultaRequest,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services.exceptions import DatabaseUnavailableError, PublicConsultaNotFoundError
from app.services.exceptions import SolicitacaoDuplicadaAtivaError
from app.services.protocol_service import generate_protocol, generate_protocol_from_database

DATABASE_UNAVAILABLE_MESSAGE = (
    "Servico temporariamente indisponivel. Tente novamente mais tarde."
)
PUBLIC_CONSULTA_NOT_FOUND_MESSAGE = (
    "Solicitacao nao encontrada ou dados de confirmacao invalidos."
)
SOLICITACAO_DUPLICADA_ATIVA_MESSAGE = (
    "Já existe uma solicitação aberta para este poste. "
    "A equipe responsável já foi notificada."
)

STATUS_PUBLICO_MAP = {
    "aberta": (
        "Aberta",
        "Sua solicitacao foi registrada e esta aguardando analise.",
    ),
    "em_triagem": (
        "Em analise",
        "Sua solicitacao esta em analise pela equipe responsavel.",
    ),
    "encaminhada": (
        "Encaminhada",
        "Sua solicitacao foi encaminhada para atendimento.",
    ),
    "em_execucao": (
        "Em execucao",
        "O atendimento da solicitacao esta em execucao.",
    ),
    "aguardando_material": (
        "Aguardando material",
        "A solicitacao aguarda disponibilidade de material ou recurso necessario.",
    ),
    "resolvida": (
        "Concluida",
        "A solicitacao foi concluida.",
    ),
    "concluida": (
        "Concluida",
        "A solicitacao foi concluida.",
    ),
    "cancelada": (
        "Encerrada",
        "A solicitacao foi encerrada.",
    ),
    "nao_atendida": (
        "Encerrada",
        "A solicitacao foi encerrada.",
    ),
    "nao_localizado": (
        "Encerrada",
        "A solicitacao foi encerrada.",
    ),
    "indeferida": (
        "Encerrada",
        "A solicitacao foi encerrada.",
    ),
}


def create_solicitacao_simulada(
    solicitacao: IluminacaoSolicitacaoCreate,
) -> IluminacaoSolicitacaoResponse:
    if settings.persist_solicitacoes:
        try:
            if (
                solicitacao.localizacao_tipo.value == "poste_mapa"
                and solicitacao.poste_id
                and iluminacao_repository.existe_solicitacao_ativa_para_poste(
                    solicitacao.poste_id
                )
            ):
                raise SolicitacaoDuplicadaAtivaError(
                    SOLICITACAO_DUPLICADA_ATIVA_MESSAGE
                )

            protocolo = generate_protocol_from_database()
            return iluminacao_repository.create_solicitacao(solicitacao, protocolo)
        except (SQLAlchemyError, RuntimeError) as exc:
            if isinstance(exc, SolicitacaoDuplicadaAtivaError):
                raise
            raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    protocolo = generate_protocol(prefix="IP", year=2026, sequence=1)

    # POC sem persistencia em banco.
    return IluminacaoSolicitacaoResponse(
        protocolo=protocolo,
        status=StatusSolicitacaoIluminacao.aberta,
        message="Solicitacao registrada em ambiente de teste.",
    )


def _only_digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def _to_public_date(value):
    return value.date() if hasattr(value, "date") else value


def _status_publico(status: str) -> tuple[str, str]:
    return STATUS_PUBLICO_MAP.get(
        status,
        (
            "Em acompanhamento",
            "Sua solicitacao esta em acompanhamento.",
        ),
    )


def _build_public_consulta_response(
    record: IluminacaoConsultaRepositoryRecord,
) -> IluminacaoConsultaPublicResponse:
    status_publico, mensagem = _status_publico(record.status)
    data_abertura = _to_public_date(record.criado_em)
    ultima_atualizacao = _to_public_date(record.atualizado_em or record.criado_em)

    return IluminacaoConsultaPublicResponse(
        protocolo=record.protocolo,
        status=record.status,
        status_publico=status_publico,
        data_abertura=data_abertura,
        ultima_atualizacao=ultima_atualizacao,
        mensagem=mensagem,
    )


def consultar_solicitacao_publica(
    consulta: IluminacaoConsultaRequest,
) -> IluminacaoConsultaPublicResponse:
    try:
        record = iluminacao_repository.get_solicitacao_publica_por_protocolo(
            consulta.protocolo
        )
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    if record is None:
        raise PublicConsultaNotFoundError(PUBLIC_CONSULTA_NOT_FOUND_MESSAGE)

    contato_digits = _only_digits(record.contato_solicitante)
    if len(contato_digits) < 4 or contato_digits[-4:] != consulta.contato_confirmacao:
        raise PublicConsultaNotFoundError(PUBLIC_CONSULTA_NOT_FOUND_MESSAGE)

    return _build_public_consulta_response(record)
