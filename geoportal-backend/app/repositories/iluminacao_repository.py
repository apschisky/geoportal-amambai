from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine
from app.schemas.iluminacao import (
    IluminacaoConsultaRepositoryRecord,
    IluminacaoSolicitacaoInternaItem,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
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
