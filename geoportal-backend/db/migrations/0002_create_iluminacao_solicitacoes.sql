-- Migration 0002
-- Cria a tabela operacional inicial de solicitacoes de Iluminacao Publica.
-- Destinada primeiro a homologacao.
-- Nao cria usuarios.
-- Nao cria GRANT.
-- Nao cria triggers.
-- Nao cria historico.
-- Nao cria anexos.
-- Requer que a migration 0001 ja tenha criado o schema mod_iluminacao.
-- Requer PostGIS habilitado no banco antes da execucao.
-- Nao cria extensao PostGIS.
-- Nao deve ser executada em producao sem backup, revisao e autorizacao.

CREATE TABLE IF NOT EXISTS mod_iluminacao.solicitacoes (
    id bigserial PRIMARY KEY,
    protocolo varchar(20) NOT NULL,
    origem varchar(40) NOT NULL DEFAULT 'geoportal_publico',
    localizacao_tipo varchar(30) NOT NULL,
    poste_id varchar(80) NULL,
    geom geometry(Point, 32721) NOT NULL,
    tipo_problema varchar(50) NOT NULL,
    descricao varchar(1000) NOT NULL,
    observacoes_localizacao varchar(500) NULL,
    ponto_referencia varchar(300) NULL,
    poste_proximo_informado varchar(120) NULL,
    nome_solicitante varchar(120) NOT NULL,
    contato_solicitante varchar(120) NOT NULL,
    status varchar(40) NOT NULL DEFAULT 'aberta',
    prioridade varchar(20) NOT NULL DEFAULT 'normal',
    duplicidade_suspeita boolean NOT NULL DEFAULT false,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    finalizado_em timestamptz NULL,
    deleted_at timestamptz NULL,
    deleted_reason varchar(500) NULL,

    CONSTRAINT ux_iluminacao_solicitacoes_protocolo UNIQUE (protocolo),
    CONSTRAINT ck_iluminacao_solicitacoes_protocolo CHECK (
        btrim(protocolo) <> ''
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_origem CHECK (
        origem IN ('geoportal_publico', 'painel_interno', 'importacao_controlada')
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_localizacao_tipo CHECK (
        localizacao_tipo IN ('poste_mapa', 'ponto_manual')
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_tipo_problema CHECK (
        tipo_problema IN (
            'lampada_apagada',
            'lampada_piscando',
            'lampada_acesa_dia',
            'poste_danificado',
            'braco_luminaria_danificada',
            'fiacao_aparente',
            'outro'
        )
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_status CHECK (
        status IN (
            'aberta',
            'em_triagem',
            'encaminhada',
            'em_execucao',
            'aguardando_material',
            'nao_localizado',
            'resolvida',
            'indeferida',
            'cancelada'
        )
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_prioridade CHECK (
        prioridade IN ('baixa', 'normal', 'alta', 'urgente')
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_descricao CHECK (
        length(btrim(descricao)) >= 5
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_localizacao CHECK (
        (
            localizacao_tipo = 'poste_mapa'
            AND poste_id IS NOT NULL
            AND btrim(poste_id) <> ''
        )
        OR
        (
            localizacao_tipo = 'ponto_manual'
            AND (
                (
                    observacoes_localizacao IS NOT NULL
                    AND btrim(observacoes_localizacao) <> ''
                )
                OR
                (
                    ponto_referencia IS NOT NULL
                    AND btrim(ponto_referencia) <> ''
                )
            )
        )
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_nome_solicitante CHECK (
        length(btrim(nome_solicitante)) >= 2
    ),
    CONSTRAINT ck_iluminacao_solicitacoes_contato_solicitante CHECK (
        length(btrim(contato_solicitante)) >= 5
    )
);

COMMENT ON TABLE mod_iluminacao.solicitacoes IS 'Tabela operacional inicial de solicitacoes de Iluminacao Publica.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.id IS 'Identificador interno da solicitacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.protocolo IS 'Protocolo publico unico da solicitacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.origem IS 'Origem tecnica da solicitacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.localizacao_tipo IS 'Tipo de localizacao informada: poste_mapa ou ponto_manual.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.poste_id IS 'Identificador do poste quando selecionado no mapa.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.geom IS 'Ponto da solicitacao em SIRGAS 2000 / UTM zone 21S, SRID 32721.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.tipo_problema IS 'Tipo tecnico do problema informado.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.descricao IS 'Descricao publica do problema informado.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.observacoes_localizacao IS 'Observacoes sobre localizacao manual do poste.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.ponto_referencia IS 'Ponto de referencia informado pelo cidadao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.poste_proximo_informado IS 'Informacao de poste proximo quando o poste correto nao for localizado.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.nome_solicitante IS 'Nome do solicitante para contato operacional.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.contato_solicitante IS 'Contato do solicitante para esclarecimentos operacionais.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.status IS 'Status tecnico atual da solicitacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.prioridade IS 'Prioridade operacional da solicitacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.duplicidade_suspeita IS 'Indica possivel duplicidade identificada pela aplicacao ou triagem.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.criado_em IS 'Data e hora de criacao do registro.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.atualizado_em IS 'Data e hora da ultima atualizacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.finalizado_em IS 'Data e hora de finalizacao, quando houver.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.deleted_at IS 'Data e hora de soft delete, quando houver.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes.deleted_reason IS 'Motivo do soft delete, quando houver.';

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_status
    ON mod_iluminacao.solicitacoes (status);

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_criado_em
    ON mod_iluminacao.solicitacoes (criado_em);

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_poste_id
    ON mod_iluminacao.solicitacoes (poste_id);

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_tipo_problema
    ON mod_iluminacao.solicitacoes (tipo_problema);

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_localizacao_tipo
    ON mod_iluminacao.solicitacoes (localizacao_tipo);

CREATE INDEX IF NOT EXISTS ix_iluminacao_solicitacoes_geom
    ON mod_iluminacao.solicitacoes USING gist (geom);
