from dataclasses import dataclass
import re

_IDENTIFIER_PATTERN = re.compile(r'^[a-z0-9._-]+$')

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.core.database import get_engine


ADMIN_AUDIT_RESULTS = frozenset({"sucesso", "negada", "erro_validacao"})
_SENSITIVE_MARKERS = (
    "password",
    "senha",
    "hash",
    "token",
    "cookie",
    "session_secret",
    "database_url",
)


@dataclass(frozen=True)
class AdminAuditContext:
    ator_usuario_id: int
    ator_login: str
    origem: str = "api_internal"
    request_id: str | None = None


def sanitize_admin_audit_text(
    value: str | None,
    *,
    max_length: int,
) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value))
    normalized = " ".join(normalized.split()).strip()
    if not normalized:
        return None
    lowered = normalized.lower()
    if any(marker in lowered for marker in _SENSITIVE_MARKERS):
        return "[redacted]"
    return normalized[:max_length]


def normalize_admin_audit_reason(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if len(normalized) > 120 or _IDENTIFIER_PATTERN.fullmatch(normalized) is None:
        raise ValueError('motivo is invalid')
    return normalized


def normalize_admin_audit_context(context: AdminAuditContext) -> AdminAuditContext:
    if context.ator_usuario_id <= 0:
        raise ValueError("ator_usuario_id must be positive")
    ator_login = sanitize_admin_audit_text(context.ator_login, max_length=80)
    if ator_login is None:
        ator_login = f"usuario:{context.ator_usuario_id}"
    origem = sanitize_admin_audit_text(context.origem, max_length=120)
    request_id = sanitize_admin_audit_text(context.request_id, max_length=120)
    return AdminAuditContext(
        ator_usuario_id=context.ator_usuario_id,
        ator_login=ator_login,
        origem=origem or "api_internal",
        request_id=request_id,
    )


def record_admin_audit_event_with_connection(
    connection: Connection,
    *,
    context: AdminAuditContext,
    acao: str,
    entidade_tipo: str,
    entidade_id: str | int | None,
    resultado: str,
    motivo: str | None = None,
    resumo: str | None = None,
    justificativa: str | None = None,
) -> None:
    normalized_context = normalize_admin_audit_context(context)
    normalized_action = acao.strip().lower()
    normalized_entity_type = entidade_tipo.strip().lower()
    normalized_result = resultado.strip().lower()
    if not normalized_action or len(normalized_action) > 120 or _IDENTIFIER_PATTERN.fullmatch(normalized_action) is None:
        raise ValueError("acao must not be empty")
    if not normalized_entity_type or len(normalized_entity_type) > 80 or _IDENTIFIER_PATTERN.fullmatch(normalized_entity_type) is None:
        raise ValueError("entidade_tipo must not be empty")
    if normalized_result not in ADMIN_AUDIT_RESULTS:
        raise ValueError("resultado is invalid")

    normalized_entity_id = sanitize_admin_audit_text(
        None if entidade_id is None else str(entidade_id),
        max_length=180,
    )
    params = {
        "ator_usuario_id": normalized_context.ator_usuario_id,
        "ator_login": normalized_context.ator_login,
        "acao": normalized_action,
        "entidade_tipo": normalized_entity_type,
        "entidade_id": normalized_entity_id,
        "resultado": normalized_result,
        "motivo": sanitize_admin_audit_text(motivo, max_length=500),
        "resumo": sanitize_admin_audit_text(resumo, max_length=1000),
        "justificativa": sanitize_admin_audit_text(
            justificativa,
            max_length=1000,
        ),
        "origem": normalized_context.origem,
        "request_id": normalized_context.request_id,
    }
    params['motivo'] = normalize_admin_audit_reason(motivo)
    statement = text(
        """
        INSERT INTO mod_auth.admin_auditoria (
            ator_usuario_id,
            ator_login,
            acao,
            entidade_tipo,
            entidade_id,
            resultado,
            motivo,
            resumo,
            justificativa,
            origem,
            request_id
        )
        VALUES (
            :ator_usuario_id,
            :ator_login,
            :acao,
            :entidade_tipo,
            :entidade_id,
            :resultado,
            :motivo,
            :resumo,
            :justificativa,
            :origem,
            :request_id
        )
        """
    )
    connection.execute(statement, params)


def record_admin_audit_event(
    *,
    context: AdminAuditContext,
    acao: str,
    entidade_tipo: str,
    entidade_id: str | int | None,
    resultado: str,
    motivo: str | None = None,
    resumo: str | None = None,
    justificativa: str | None = None,
    engine: Engine | None = None,
) -> None:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        record_admin_audit_event_with_connection(
            connection,
            context=context,
            acao=acao,
            entidade_tipo=entidade_tipo,
            entidade_id=entidade_id,
            resultado=resultado,
            motivo=motivo,
            resumo=resumo,
            justificativa=justificativa,
        )


__all__ = [
    "ADMIN_AUDIT_RESULTS",
    "AdminAuditContext",
    "normalize_admin_audit_context",
    "record_admin_audit_event",
    "record_admin_audit_event_with_connection",
    "sanitize_admin_audit_text",
]
