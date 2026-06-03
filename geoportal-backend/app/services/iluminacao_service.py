from datetime import datetime
import re

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.repositories import iluminacao_repository
from app.schemas.iluminacao import (
    IluminacaoConsultaPublicResponse,
    IluminacaoConsultaRepositoryRecord,
    IluminacaoConsultaRequest,
    IluminacaoSolicitacaoHistoricoInternoResult,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResult,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    IluminacaoSolicitacaoStatusInternaItem,
    IluminacaoSolicitacoesInternasResult,
    StatusSolicitacaoIluminacao,
    TipoProblemaIluminacao,
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

SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE = "Solicitacao nao encontrada."
SOLICITACAO_STATUS_TRANSITION_INVALID_MESSAGE = "Transicao de status invalida."

ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "aberta": {"em_triagem", "cancelada", "indeferida"},
    "em_triagem": {
        "encaminhada",
        "aguardando_material",
        "nao_localizado",
        "cancelada",
        "indeferida",
    },
    "encaminhada": {
        "em_execucao",
        "aguardando_material",
        "nao_localizado",
        "cancelada",
    },
    "em_execucao": {"aguardando_material", "resolvida", "nao_localizado"},
    "aguardando_material": {"encaminhada", "em_execucao", "cancelada"},
}
TERMINAL_STATUS_SOLICITACAO = {
    "resolvida",
    "cancelada",
    "indeferida",
    "nao_localizado",
}
VALID_STATUS_SOLICITACAO = {status.value for status in StatusSolicitacaoIluminacao}


class SolicitacaoInternaNotFoundError(RuntimeError):
    pass


class SolicitacaoInternaStatusTransitionError(RuntimeError):
    pass


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


def _normalize_optional_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


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


def listar_solicitacoes_internas(
    *,
    status: StatusSolicitacaoIluminacao | None = None,
    protocolo: str | None = None,
    poste_id: str | None = None,
    tipo_problema: TipoProblemaIluminacao | None = None,
    prioridade: str | None = None,
    criado_de: datetime | None = None,
    criado_ate: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> IluminacaoSolicitacoesInternasResult:
    if criado_de is not None and criado_ate is not None and criado_de > criado_ate:
        raise ValueError("criado_de must be less than or equal to criado_ate")

    try:
        return iluminacao_repository.list_solicitacoes_internas(
            status=status,
            protocolo=_normalize_optional_filter(protocolo),
            poste_id=_normalize_optional_filter(poste_id),
            tipo_problema=tipo_problema,
            prioridade=_normalize_optional_filter(prioridade),
            criado_de=criado_de,
            criado_ate=criado_ate,
            limit=limit,
            offset=offset,
        )
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc


def obter_solicitacao_interna_por_id(
    solicitacao_id: int,
) -> IluminacaoSolicitacaoInternaItem:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    try:
        solicitacao = iluminacao_repository.get_solicitacao_interna_por_id(
            solicitacao_id
        )
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    if solicitacao is None:
        raise SolicitacaoInternaNotFoundError(SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE)

    return solicitacao


def listar_historico_solicitacao_interna(
    solicitacao_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
) -> IluminacaoSolicitacaoHistoricoInternoResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be greater than or equal to 0")

    try:
        if not iluminacao_repository.solicitacao_interna_existe(solicitacao_id):
            raise SolicitacaoInternaNotFoundError(
                SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE
            )
        return iluminacao_repository.list_historico_solicitacao_interna(
            solicitacao_id,
            limit=limit,
            offset=offset,
        )
    except SolicitacaoInternaNotFoundError:
        raise
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc


def listar_observacoes_solicitacao_interna(
    solicitacao_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
) -> IluminacaoSolicitacaoObservacoesInternasResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be greater than or equal to 0")

    try:
        if not iluminacao_repository.solicitacao_interna_existe(solicitacao_id):
            raise SolicitacaoInternaNotFoundError(
                SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE
            )
        return iluminacao_repository.list_observacoes_solicitacao_interna(
            solicitacao_id,
            limit=limit,
            offset=offset,
        )
    except SolicitacaoInternaNotFoundError:
        raise
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc


def _normalize_observacao_interna(observacao: str) -> str:
    normalized = observacao.strip()
    if len(normalized) < 3:
        raise ValueError("observacao must have at least 3 characters")
    if len(normalized) > 2000:
        raise ValueError("observacao exceeds maximum length")
    return normalized


def _normalize_status_update_observacao(observacao: str) -> str:
    normalized = observacao.strip()
    if len(normalized) < 3:
        raise ValueError("observacao must have at least 3 characters")
    if len(normalized) > 1000:
        raise ValueError("observacao exceeds maximum length")
    return normalized


def _normalize_status_solicitacao(
    status: StatusSolicitacaoIluminacao | str,
) -> str:
    status_value = status.value if isinstance(status, StatusSolicitacaoIluminacao) else status
    if status_value not in VALID_STATUS_SOLICITACAO:
        raise ValueError("status is invalid")
    return status_value


def _allowed_current_statuses_for(target_status: str) -> set[str]:
    return {
        current_status
        for current_status, target_statuses in ALLOWED_STATUS_TRANSITIONS.items()
        if target_status in target_statuses
    }


def _is_terminal_status(status: str) -> bool:
    return status in TERMINAL_STATUS_SOLICITACAO


def criar_observacao_solicitacao_interna(
    solicitacao_id: int,
    *,
    observacao: str,
    usuario_id: int,
    usuario_nome: str | None = None,
) -> IluminacaoSolicitacaoObservacaoInternaItem:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if usuario_id < 1:
        raise ValueError("usuario_id must be greater than or equal to 1")

    observacao_normalizada = _normalize_observacao_interna(observacao)

    try:
        item = iluminacao_repository.create_observacao_solicitacao_interna(
            solicitacao_id,
            observacao=observacao_normalizada,
            usuario_id=str(usuario_id),
            usuario_nome=usuario_nome,
        )
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    if item is None:
        raise SolicitacaoInternaNotFoundError(SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE)

    return item


def atualizar_status_solicitacao_interna(
    solicitacao_id: int,
    *,
    status: StatusSolicitacaoIluminacao | str,
    observacao: str,
    usuario_id: int,
    usuario_nome: str | None = None,
) -> IluminacaoSolicitacaoStatusInternaItem:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if usuario_id < 1:
        raise ValueError("usuario_id must be greater than or equal to 1")

    status_novo = _normalize_status_solicitacao(status)
    observacao_normalizada = _normalize_status_update_observacao(observacao)

    try:
        result = iluminacao_repository.update_status_solicitacao_interna(
            solicitacao_id,
            status_novo=status_novo,
            allowed_current_statuses=_allowed_current_statuses_for(status_novo),
            is_terminal_status=_is_terminal_status(status_novo),
            observacao_resumida=observacao_normalizada,
            usuario_id=str(usuario_id),
            usuario_nome=usuario_nome,
        )
    except (SQLAlchemyError, RuntimeError) as exc:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

    if result.outcome == iluminacao_repository.STATUS_UPDATE_OUTCOME_NOT_FOUND:
        raise SolicitacaoInternaNotFoundError(SOLICITACAO_INTERNA_NOT_FOUND_MESSAGE)

    if result.outcome == iluminacao_repository.STATUS_UPDATE_OUTCOME_INVALID_TRANSITION:
        raise SolicitacaoInternaStatusTransitionError(
            SOLICITACAO_STATUS_TRANSITION_INVALID_MESSAGE
        )

    if result.solicitacao is None:
        raise DatabaseUnavailableError(DATABASE_UNAVAILABLE_MESSAGE)

    return result.solicitacao
