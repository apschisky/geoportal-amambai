from datetime import datetime
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine
from app.schemas.iluminacao import (
    IluminacaoConsultaRepositoryRecord,
    IluminacaoSolicitacaoHistoricoInternoItem,
    IluminacaoSolicitacaoHistoricoInternoResult,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoObservacaoInternaItem,
    IluminacaoSolicitacaoObservacoesInternasResult,
    IluminacaoSolicitacaoPrioridadeInternaItem,
    IluminacaoRelatorioSolicitacaoInternaItem,
    IluminacaoRelatorioSolicitacoesInternasResult,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    IluminacaoSolicitacaoStatusInternaItem,
    IluminacaoSolicitacoesInternasResult,
    StatusSolicitacaoIluminacao,
    TipoProblemaIluminacao,
)

ACTIVE_SOLICITACAO_STATUSES = (
    "aberta",
    "em_triagem",
    "encaminhada",
    "em_execucao",
    "aguardando_material",
)
OBSERVACAO_INTERNA_VISIBILIDADE = "interna"
HISTORICO_ACAO_OBSERVACAO_INTERNA = "observacao_interna"
HISTORICO_ACAO_ALTERACAO_STATUS = "alteracao_status"
HISTORICO_ACAO_ALTERACAO_PRIORIDADE = "alteracao_prioridade"
HISTORICO_ORIGEM_USUARIO_INTERNO = "usuario_interno"
HISTORICO_OBSERVACAO_RESUMIDA_MAX_LENGTH = 1000
STATUS_UPDATE_OUTCOME_UPDATED = "updated"
STATUS_UPDATE_OUTCOME_IDEMPOTENT = "idempotent"
STATUS_UPDATE_OUTCOME_NOT_FOUND = "not_found"
STATUS_UPDATE_OUTCOME_INVALID_TRANSITION = "invalid_transition"
PRIORIDADE_UPDATE_OUTCOME_UPDATED = "updated"
PRIORIDADE_UPDATE_OUTCOME_IDEMPOTENT = "idempotent"
PRIORIDADE_UPDATE_OUTCOME_NOT_FOUND = "not_found"
PRIORIDADE_UPDATE_OUTCOME_TERMINAL_STATUS = "terminal_status"


@dataclass(frozen=True)
class UpdateStatusSolicitacaoInternaResult:
    outcome: str
    solicitacao: IluminacaoSolicitacaoStatusInternaItem | None = None
    status_atual: str | None = None


@dataclass(frozen=True)
class UpdatePrioridadeSolicitacaoInternaResult:
    outcome: str
    solicitacao: IluminacaoSolicitacaoPrioridadeInternaItem | None = None
    prioridade_atual: str | None = None
    status_atual: str | None = None


def _normalize_required_text(value: str, field_name: str, max_length: int) -> str:
    normalized = value.strip()
    if len(normalized) < 3:
        raise ValueError(f"{field_name} must have at least 3 characters")
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} exceeds maximum length")
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def existe_solicitacao_ativa_para_poste(
    poste_id: str,
    engine: Engine | None = None,
) -> bool:
    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM mod_iluminacao.solicitacoes
            WHERE deleted_at IS NULL
              AND poste_id = :poste_id
              AND status IN (
                  'aberta',
                  'em_triagem',
                  'encaminhada',
                  'em_execucao',
                  'aguardando_material'
              )
        ) AS existe
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"poste_id": poste_id}).mappings().one()

    return bool(row["existe"])


def create_solicitacao(
    solicitacao: IluminacaoSolicitacaoCreate,
    protocolo: str,
    engine: Engine | None = None,
) -> IluminacaoSolicitacaoResponse:
    db_engine = engine or get_engine()

    statement = text(
        """
        INSERT INTO mod_iluminacao.solicitacoes (
            protocolo,
            localizacao_tipo,
            poste_id,
            geom,
            tipo_problema,
            descricao,
            observacoes_localizacao,
            ponto_referencia,
            poste_proximo_informado,
            nome_solicitante,
            contato_solicitante,
            duplicidade_suspeita
        )
        VALUES (
            :protocolo,
            :localizacao_tipo,
            :poste_id,
            ST_Transform(
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
                32721
            ),
            :tipo_problema,
            :descricao,
            :observacoes_localizacao,
            :ponto_referencia,
            :poste_proximo_informado,
            :nome_solicitante,
            :contato_solicitante,
            CASE
                WHEN CAST(:poste_id AS varchar) IS NULL THEN false
                ELSE EXISTS (
                    SELECT 1
                    FROM mod_iluminacao.solicitacoes existente
                    WHERE existente.deleted_at IS NULL
                      AND existente.poste_id = CAST(:poste_id AS varchar)
                      AND existente.tipo_problema = CAST(:tipo_problema AS varchar)
                      AND existente.status IN (
                          'aberta',
                          'em_triagem',
                          'encaminhada',
                          'em_execucao',
                          'aguardando_material'
                      )
                      AND existente.criado_em >= now() - interval '24 hours'
                )
            END
        )
        RETURNING protocolo, status
        """
    )

    params = {
        "protocolo": protocolo,
        "localizacao_tipo": solicitacao.localizacao_tipo.value,
        "poste_id": solicitacao.poste_id,
        "longitude": solicitacao.coordenada.longitude,
        "latitude": solicitacao.coordenada.latitude,
        "tipo_problema": solicitacao.tipo_problema.value,
        "descricao": solicitacao.descricao,
        "observacoes_localizacao": solicitacao.observacoes_localizacao,
        "ponto_referencia": solicitacao.ponto_referencia,
        "poste_proximo_informado": solicitacao.poste_proximo_informado,
        "nome_solicitante": solicitacao.nome_solicitante,
        "contato_solicitante": solicitacao.contato_solicitante,
    }

    with db_engine.begin() as connection:
        row = connection.execute(statement, params).mappings().one()

    return IluminacaoSolicitacaoResponse(
        protocolo=row["protocolo"],
        status=row["status"],
        message="Solicitacao registrada com sucesso.",
    )


def get_solicitacao_publica_por_protocolo(
    protocolo: str,
    engine: Engine | None = None,
) -> IluminacaoConsultaRepositoryRecord | None:
    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            protocolo,
            status,
            contato_solicitante,
            criado_em,
            COALESCE(atualizado_em, criado_em) AS atualizado_em
        FROM mod_iluminacao.solicitacoes
        WHERE protocolo = :protocolo
          AND deleted_at IS NULL
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(statement, {"protocolo": protocolo}).mappings().first()

    if row is None:
        return None

    return IluminacaoConsultaRepositoryRecord.model_validate(dict(row))


def list_solicitacoes_internas(
    *,
    status: StatusSolicitacaoIluminacao | None = None,
    protocolo: str | None = None,
    poste_id: str | None = None,
    tipo_problema: TipoProblemaIluminacao | None = None,
    prioridade: str | None = None,
    criado_de: datetime | None = None,
    criado_ate: datetime | None = None,
    ativos: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    engine: Engine | None = None,
) -> IluminacaoSolicitacoesInternasResult:
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be greater than or equal to 0")

    db_engine = engine or get_engine()
    status_value = status.value if status is not None else None
    tipo_problema_value = tipo_problema.value if tipo_problema is not None else None

    statement = text(
        """
        SELECT
            id,
            protocolo,
            origem,
            localizacao_tipo,
            poste_id,
            tipo_problema,
            descricao,
            observacoes_localizacao,
            ponto_referencia,
            poste_proximo_informado,
            nome_solicitante,
            contato_solicitante,
            status,
            prioridade,
            duplicidade_suspeita,
            ST_Y(ST_Transform(geom, 4326)) AS latitude,
            ST_X(ST_Transform(geom, 4326)) AS longitude,
            criado_em,
            atualizado_em,
            finalizado_em
        FROM mod_iluminacao.solicitacoes
        WHERE deleted_at IS NULL
          AND (
              CAST(:status AS varchar) IS NULL
              OR status = CAST(:status AS varchar)
          )
          AND (
              CAST(:protocolo AS varchar) IS NULL
              OR protocolo ILIKE ('%' || CAST(:protocolo AS varchar) || '%')
          )
          AND (
              CAST(:poste_id AS varchar) IS NULL
              OR poste_id ILIKE ('%' || CAST(:poste_id AS varchar) || '%')
          )
          AND (
              CAST(:tipo_problema AS varchar) IS NULL
              OR tipo_problema = CAST(:tipo_problema AS varchar)
          )
          AND (
              CAST(:prioridade AS varchar) IS NULL
              OR prioridade = CAST(:prioridade AS varchar)
          )
          AND (
              CAST(:criado_de AS timestamp) IS NULL
              OR criado_em >= CAST(:criado_de AS timestamp)
          )
          AND (
              CAST(:criado_ate AS timestamp) IS NULL
              OR criado_em <= CAST(:criado_ate AS timestamp)
          )
          AND (
              CAST(:ativos AS boolean) IS NOT TRUE
              OR status NOT IN (
                  'resolvida',
                  'cancelada',
                  'indeferida',
                  'nao_localizado'
              )
          )
        ORDER BY criado_em DESC, id DESC
        LIMIT :limit
        OFFSET :offset
        """
    )
    count_statement = text(
        """
        SELECT COUNT(*) AS total
        FROM mod_iluminacao.solicitacoes
        WHERE deleted_at IS NULL
          AND (
              CAST(:status AS varchar) IS NULL
              OR status = CAST(:status AS varchar)
          )
          AND (
              CAST(:protocolo AS varchar) IS NULL
              OR protocolo ILIKE ('%' || CAST(:protocolo AS varchar) || '%')
          )
          AND (
              CAST(:poste_id AS varchar) IS NULL
              OR poste_id ILIKE ('%' || CAST(:poste_id AS varchar) || '%')
          )
          AND (
              CAST(:tipo_problema AS varchar) IS NULL
              OR tipo_problema = CAST(:tipo_problema AS varchar)
          )
          AND (
              CAST(:prioridade AS varchar) IS NULL
              OR prioridade = CAST(:prioridade AS varchar)
          )
          AND (
              CAST(:criado_de AS timestamp) IS NULL
              OR criado_em >= CAST(:criado_de AS timestamp)
          )
          AND (
              CAST(:criado_ate AS timestamp) IS NULL
              OR criado_em <= CAST(:criado_ate AS timestamp)
          )
          AND (
              CAST(:ativos AS boolean) IS NOT TRUE
              OR status NOT IN (
                  'resolvida',
                  'cancelada',
                  'indeferida',
                  'nao_localizado'
              )
          )
        """
    )

    params = {
        "status": status_value,
        "protocolo": protocolo,
        "poste_id": poste_id,
        "tipo_problema": tipo_problema_value,
        "prioridade": prioridade,
        "criado_de": criado_de,
        "criado_ate": criado_ate,
        "ativos": ativos,
        "limit": limit,
        "offset": offset,
    }
    count_params = {
        key: value
        for key, value in params.items()
        if key not in {"limit", "offset"}
    }

    with db_engine.begin() as connection:
        rows = connection.execute(statement, params).mappings().all()
        total_row = connection.execute(count_statement, count_params).mappings().one()

    return IluminacaoSolicitacoesInternasResult(
        items=[
            IluminacaoSolicitacaoInternaItem.model_validate(dict(row))
            for row in rows
        ],
        total=int(total_row["total"]),
    )


def list_relatorio_solicitacoes_internas(
    *,
    data_inicio: datetime | None,
    data_fim_exclusive: datetime | None,
    status: StatusSolicitacaoIluminacao | None = None,
    prioridade: str | None = None,
    tipo_problema: TipoProblemaIluminacao | None = None,
    engine: Engine | None = None,
) -> IluminacaoRelatorioSolicitacoesInternasResult:
    db_engine = engine or get_engine()
    status_value = status.value if status is not None else None
    tipo_problema_value = tipo_problema.value if tipo_problema is not None else None

    statement = text(
        """
        SELECT
            protocolo,
            status,
            prioridade,
            tipo_problema,
            poste_id,
            origem,
            localizacao_tipo,
            criado_em,
            atualizado_em,
            finalizado_em,
            duplicidade_suspeita,
            CASE
                WHEN finalizado_em IS NULL THEN NULL
                ELSE EXTRACT(EPOCH FROM (finalizado_em - criado_em))
            END AS tempo_finalizacao_segundos
        FROM mod_iluminacao.solicitacoes
        WHERE deleted_at IS NULL
          AND (
              CAST(:data_inicio AS timestamp) IS NULL
              OR criado_em >= CAST(:data_inicio AS timestamp)
          )
          AND (
              CAST(:data_fim_exclusive AS timestamp) IS NULL
              OR criado_em < CAST(:data_fim_exclusive AS timestamp)
          )
          AND (
              CAST(:status AS varchar) IS NULL
              OR status = CAST(:status AS varchar)
          )
          AND (
              CAST(:prioridade AS varchar) IS NULL
              OR prioridade = CAST(:prioridade AS varchar)
          )
          AND (
              CAST(:tipo_problema AS varchar) IS NULL
              OR tipo_problema = CAST(:tipo_problema AS varchar)
          )
        ORDER BY criado_em ASC, protocolo ASC
        """
    )
    params = {
        "data_inicio": data_inicio,
        "data_fim_exclusive": data_fim_exclusive,
        "status": status_value,
        "prioridade": prioridade,
        "tipo_problema": tipo_problema_value,
    }

    with db_engine.begin() as connection:
        rows = connection.execute(statement, params).mappings().all()

    return IluminacaoRelatorioSolicitacoesInternasResult(
        items=[
            IluminacaoRelatorioSolicitacaoInternaItem.model_validate(dict(row))
            for row in rows
        ],
    )


def get_solicitacao_interna_por_id(
    solicitacao_id: int,
    engine: Engine | None = None,
) -> IluminacaoSolicitacaoInternaItem | None:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            protocolo,
            origem,
            localizacao_tipo,
            poste_id,
            tipo_problema,
            descricao,
            observacoes_localizacao,
            ponto_referencia,
            poste_proximo_informado,
            nome_solicitante,
            contato_solicitante,
            status,
            prioridade,
            duplicidade_suspeita,
            ST_Y(ST_Transform(geom, 4326)) AS latitude,
            ST_X(ST_Transform(geom, 4326)) AS longitude,
            criado_em,
            atualizado_em,
            finalizado_em
        FROM mod_iluminacao.solicitacoes
        WHERE id = :solicitacao_id
          AND deleted_at IS NULL
        LIMIT 1
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(
            statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().first()

    if row is None:
        return None

    return IluminacaoSolicitacaoInternaItem.model_validate(dict(row))


def solicitacao_interna_existe(
    solicitacao_id: int,
    engine: Engine | None = None,
) -> bool:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM mod_iluminacao.solicitacoes
            WHERE id = :solicitacao_id
              AND deleted_at IS NULL
        ) AS existe
        """
    )

    with db_engine.begin() as connection:
        row = connection.execute(
            statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().one()

    return bool(row["existe"])


def list_historico_solicitacao_interna(
    solicitacao_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
    engine: Engine | None = None,
) -> IluminacaoSolicitacaoHistoricoInternoResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be greater than or equal to 0")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            solicitacao_id,
            acao,
            status_anterior,
            status_novo,
            prioridade_anterior,
            prioridade_nova,
            usuario_id,
            usuario_nome,
            origem_acao,
            observacao_resumida,
            criado_em
        FROM mod_iluminacao.solicitacoes_historico
        WHERE solicitacao_id = :solicitacao_id
        ORDER BY criado_em ASC, id ASC
        LIMIT :limit
        OFFSET :offset
        """
    )
    count_statement = text(
        """
        SELECT COUNT(*) AS total
        FROM mod_iluminacao.solicitacoes_historico
        WHERE solicitacao_id = :solicitacao_id
        """
    )

    params = {
        "solicitacao_id": solicitacao_id,
        "limit": limit,
        "offset": offset,
    }

    with db_engine.begin() as connection:
        rows = connection.execute(statement, params).mappings().all()
        total_row = connection.execute(
            count_statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().one()

    return IluminacaoSolicitacaoHistoricoInternoResult(
        items=[
            IluminacaoSolicitacaoHistoricoInternoItem.model_validate(dict(row))
            for row in rows
        ],
        total=int(total_row["total"]),
    )


def list_observacoes_solicitacao_interna(
    solicitacao_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
    engine: Engine | None = None,
) -> IluminacaoSolicitacaoObservacoesInternasResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be greater than or equal to 0")

    db_engine = engine or get_engine()

    statement = text(
        """
        SELECT
            id,
            solicitacao_id,
            observacao,
            visibilidade,
            usuario_id,
            usuario_nome,
            criado_em,
            editado_em
        FROM mod_iluminacao.solicitacoes_observacoes
        WHERE solicitacao_id = :solicitacao_id
          AND deleted_at IS NULL
          AND visibilidade = 'interna'
        ORDER BY criado_em ASC, id ASC
        LIMIT :limit
        OFFSET :offset
        """
    )
    count_statement = text(
        """
        SELECT COUNT(*) AS total
        FROM mod_iluminacao.solicitacoes_observacoes
        WHERE solicitacao_id = :solicitacao_id
          AND deleted_at IS NULL
          AND visibilidade = 'interna'
        """
    )

    params = {
        "solicitacao_id": solicitacao_id,
        "limit": limit,
        "offset": offset,
    }

    with db_engine.begin() as connection:
        rows = connection.execute(statement, params).mappings().all()
        total_row = connection.execute(
            count_statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().one()

    return IluminacaoSolicitacaoObservacoesInternasResult(
        items=[
            IluminacaoSolicitacaoObservacaoInternaItem.model_validate(dict(row))
            for row in rows
        ],
        total=int(total_row["total"]),
    )


def create_observacao_solicitacao_interna(
    solicitacao_id: int,
    *,
    observacao: str,
    usuario_id: str,
    usuario_nome: str | None = None,
    engine: Engine | None = None,
) -> IluminacaoSolicitacaoObservacaoInternaItem | None:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    observacao_normalizada = _normalize_required_text(
        observacao,
        "observacao",
        2000,
    )
    usuario_id_normalizado = usuario_id.strip()
    if not usuario_id_normalizado:
        raise ValueError("usuario_id must not be empty")
    usuario_nome_normalizado = _normalize_optional_text(usuario_nome)
    observacao_resumida = observacao_normalizada[
        :HISTORICO_OBSERVACAO_RESUMIDA_MAX_LENGTH
    ]

    db_engine = engine or get_engine()

    exists_statement = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM mod_iluminacao.solicitacoes
            WHERE id = :solicitacao_id
              AND deleted_at IS NULL
        ) AS existe
        """
    )
    observacao_statement = text(
        """
        INSERT INTO mod_iluminacao.solicitacoes_observacoes (
            solicitacao_id,
            observacao,
            visibilidade,
            usuario_id,
            usuario_nome
        )
        VALUES (
            :solicitacao_id,
            :observacao,
            :visibilidade,
            :usuario_id,
            :usuario_nome
        )
        RETURNING
            id,
            solicitacao_id,
            observacao,
            visibilidade,
            usuario_id,
            usuario_nome,
            criado_em,
            editado_em
        """
    )
    historico_statement = text(
        """
        INSERT INTO mod_iluminacao.solicitacoes_historico (
            solicitacao_id,
            acao,
            status_anterior,
            status_novo,
            prioridade_anterior,
            prioridade_nova,
            usuario_id,
            usuario_nome,
            origem_acao,
            observacao_resumida
        )
        VALUES (
            :solicitacao_id,
            :acao,
            NULL,
            NULL,
            NULL,
            NULL,
            :usuario_id,
            :usuario_nome,
            :origem_acao,
            :observacao_resumida
        )
        """
    )

    with db_engine.begin() as connection:
        exists_row = connection.execute(
            exists_statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().one()
        if not bool(exists_row["existe"]):
            return None

        observacao_row = connection.execute(
            observacao_statement,
            {
                "solicitacao_id": solicitacao_id,
                "observacao": observacao_normalizada,
                "visibilidade": OBSERVACAO_INTERNA_VISIBILIDADE,
                "usuario_id": usuario_id_normalizado,
                "usuario_nome": usuario_nome_normalizado,
            },
        ).mappings().one()
        connection.execute(
            historico_statement,
            {
                "solicitacao_id": solicitacao_id,
                "acao": HISTORICO_ACAO_OBSERVACAO_INTERNA,
                "usuario_id": usuario_id_normalizado,
                "usuario_nome": usuario_nome_normalizado,
                "origem_acao": HISTORICO_ORIGEM_USUARIO_INTERNO,
                "observacao_resumida": observacao_resumida,
            },
        )

    return IluminacaoSolicitacaoObservacaoInternaItem.model_validate(
        dict(observacao_row)
    )


def update_status_solicitacao_interna(
    solicitacao_id: int,
    *,
    status_novo: str,
    allowed_current_statuses: set[str],
    is_terminal_status: bool,
    observacao_resumida: str,
    usuario_id: str,
    usuario_nome: str | None = None,
    engine: Engine | None = None,
) -> UpdateStatusSolicitacaoInternaResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    status_novo_normalizado = _normalize_required_text(status_novo, "status", 40)
    observacao_normalizada = _normalize_required_text(
        observacao_resumida,
        "observacao_resumida",
        HISTORICO_OBSERVACAO_RESUMIDA_MAX_LENGTH,
    )
    usuario_id_normalizado = usuario_id.strip()
    if not usuario_id_normalizado:
        raise ValueError("usuario_id must not be empty")
    usuario_nome_normalizado = _normalize_optional_text(usuario_nome)

    db_engine = engine or get_engine()

    select_statement = text(
        """
        SELECT
            id,
            status,
            atualizado_em,
            finalizado_em
        FROM mod_iluminacao.solicitacoes
        WHERE id = :solicitacao_id
          AND deleted_at IS NULL
        FOR UPDATE
        """
    )
    update_statement = text(
        """
        UPDATE mod_iluminacao.solicitacoes
        SET
            status = :status_novo,
            atualizado_em = now(),
            finalizado_em = CASE
                WHEN :is_terminal_status THEN now()
                ELSE NULL
            END
        WHERE id = :solicitacao_id
          AND deleted_at IS NULL
        RETURNING
            id,
            status,
            atualizado_em,
            finalizado_em
        """
    )
    historico_statement = text(
        """
        INSERT INTO mod_iluminacao.solicitacoes_historico (
            solicitacao_id,
            acao,
            status_anterior,
            status_novo,
            prioridade_anterior,
            prioridade_nova,
            usuario_id,
            usuario_nome,
            origem_acao,
            observacao_resumida
        )
        VALUES (
            :solicitacao_id,
            :acao,
            :status_anterior,
            :status_novo,
            NULL,
            NULL,
            :usuario_id,
            :usuario_nome,
            :origem_acao,
            :observacao_resumida
        )
        """
    )

    with db_engine.begin() as connection:
        current_row = connection.execute(
            select_statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().first()

        if current_row is None:
            return UpdateStatusSolicitacaoInternaResult(
                outcome=STATUS_UPDATE_OUTCOME_NOT_FOUND
            )

        status_atual = str(current_row["status"])
        if status_atual == status_novo_normalizado:
            return UpdateStatusSolicitacaoInternaResult(
                outcome=STATUS_UPDATE_OUTCOME_IDEMPOTENT,
                solicitacao=IluminacaoSolicitacaoStatusInternaItem.model_validate(
                    dict(current_row)
                ),
                status_atual=status_atual,
            )

        if status_atual not in allowed_current_statuses:
            return UpdateStatusSolicitacaoInternaResult(
                outcome=STATUS_UPDATE_OUTCOME_INVALID_TRANSITION,
                status_atual=status_atual,
            )

        updated_row = connection.execute(
            update_statement,
            {
                "solicitacao_id": solicitacao_id,
                "status_novo": status_novo_normalizado,
                "is_terminal_status": is_terminal_status,
            },
        ).mappings().one()

        connection.execute(
            historico_statement,
            {
                "solicitacao_id": solicitacao_id,
                "acao": HISTORICO_ACAO_ALTERACAO_STATUS,
                "status_anterior": status_atual,
                "status_novo": status_novo_normalizado,
                "usuario_id": usuario_id_normalizado,
                "usuario_nome": usuario_nome_normalizado,
                "origem_acao": HISTORICO_ORIGEM_USUARIO_INTERNO,
                "observacao_resumida": observacao_normalizada,
            },
        )

    return UpdateStatusSolicitacaoInternaResult(
        outcome=STATUS_UPDATE_OUTCOME_UPDATED,
        solicitacao=IluminacaoSolicitacaoStatusInternaItem.model_validate(
            dict(updated_row)
        ),
        status_atual=status_atual,
    )


def update_prioridade_solicitacao_interna(
    solicitacao_id: int,
    *,
    prioridade_nova: str,
    terminal_statuses: set[str],
    observacao_resumida: str,
    usuario_id: str,
    usuario_nome: str | None = None,
    engine: Engine | None = None,
) -> UpdatePrioridadeSolicitacaoInternaResult:
    if solicitacao_id < 1:
        raise ValueError("solicitacao_id must be greater than or equal to 1")

    prioridade_nova_normalizada = _normalize_required_text(
        prioridade_nova,
        "prioridade",
        20,
    )
    observacao_normalizada = _normalize_required_text(
        observacao_resumida,
        "observacao_resumida",
        HISTORICO_OBSERVACAO_RESUMIDA_MAX_LENGTH,
    )
    usuario_id_normalizado = usuario_id.strip()
    if not usuario_id_normalizado:
        raise ValueError("usuario_id must not be empty")
    usuario_nome_normalizado = _normalize_optional_text(usuario_nome)

    db_engine = engine or get_engine()

    select_statement = text(
        """
        SELECT
            id,
            status,
            prioridade,
            atualizado_em
        FROM mod_iluminacao.solicitacoes
        WHERE id = :solicitacao_id
          AND deleted_at IS NULL
        FOR UPDATE
        """
    )
    update_statement = text(
        """
        UPDATE mod_iluminacao.solicitacoes
        SET
            prioridade = :prioridade_nova,
            atualizado_em = now()
        WHERE id = :solicitacao_id
          AND deleted_at IS NULL
        RETURNING
            id,
            prioridade,
            atualizado_em
        """
    )
    historico_statement = text(
        """
        INSERT INTO mod_iluminacao.solicitacoes_historico (
            solicitacao_id,
            acao,
            status_anterior,
            status_novo,
            prioridade_anterior,
            prioridade_nova,
            usuario_id,
            usuario_nome,
            origem_acao,
            observacao_resumida
        )
        VALUES (
            :solicitacao_id,
            :acao,
            NULL,
            NULL,
            :prioridade_anterior,
            :prioridade_nova,
            :usuario_id,
            :usuario_nome,
            :origem_acao,
            :observacao_resumida
        )
        """
    )

    with db_engine.begin() as connection:
        current_row = connection.execute(
            select_statement,
            {"solicitacao_id": solicitacao_id},
        ).mappings().first()

        if current_row is None:
            return UpdatePrioridadeSolicitacaoInternaResult(
                outcome=PRIORIDADE_UPDATE_OUTCOME_NOT_FOUND
            )

        status_atual = str(current_row["status"])
        prioridade_atual = str(current_row["prioridade"])

        if status_atual in terminal_statuses:
            return UpdatePrioridadeSolicitacaoInternaResult(
                outcome=PRIORIDADE_UPDATE_OUTCOME_TERMINAL_STATUS,
                prioridade_atual=prioridade_atual,
                status_atual=status_atual,
            )

        if prioridade_atual == prioridade_nova_normalizada:
            return UpdatePrioridadeSolicitacaoInternaResult(
                outcome=PRIORIDADE_UPDATE_OUTCOME_IDEMPOTENT,
                solicitacao=IluminacaoSolicitacaoPrioridadeInternaItem.model_validate(
                    {
                        "id": current_row["id"],
                        "prioridade": current_row["prioridade"],
                        "atualizado_em": current_row["atualizado_em"],
                    }
                ),
                prioridade_atual=prioridade_atual,
                status_atual=status_atual,
            )

        updated_row = connection.execute(
            update_statement,
            {
                "solicitacao_id": solicitacao_id,
                "prioridade_nova": prioridade_nova_normalizada,
            },
        ).mappings().one()

        connection.execute(
            historico_statement,
            {
                "solicitacao_id": solicitacao_id,
                "acao": HISTORICO_ACAO_ALTERACAO_PRIORIDADE,
                "prioridade_anterior": prioridade_atual,
                "prioridade_nova": prioridade_nova_normalizada,
                "usuario_id": usuario_id_normalizado,
                "usuario_nome": usuario_nome_normalizado,
                "origem_acao": HISTORICO_ORIGEM_USUARIO_INTERNO,
                "observacao_resumida": observacao_normalizada,
            },
        )

    return UpdatePrioridadeSolicitacaoInternaResult(
        outcome=PRIORIDADE_UPDATE_OUTCOME_UPDATED,
        solicitacao=IluminacaoSolicitacaoPrioridadeInternaItem.model_validate(
            dict(updated_row)
        ),
        prioridade_atual=prioridade_atual,
        status_atual=status_atual,
    )
