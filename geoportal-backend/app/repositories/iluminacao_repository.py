from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import get_engine
from app.schemas.iluminacao import (
    IluminacaoConsultaRepositoryRecord,
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
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
