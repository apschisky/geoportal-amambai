-- Migration 0005
-- Cria a tabela interna de observacoes operacionais de solicitacoes de Iluminacao Publica.
-- Destinada primeiro a homologacao.
-- Nao cria usuarios.
-- Nao cria GRANT.
-- Nao cria triggers.
-- Nao cria funcoes.
-- Nao altera a tabela mod_iluminacao.solicitacoes.
-- Nao altera a tabela mod_iluminacao.solicitacoes_historico.
-- Requer que a migration 0002 ja tenha criado mod_iluminacao.solicitacoes.
-- Nao deve ser executada em producao sem backup, revisao e autorizacao.

CREATE TABLE IF NOT EXISTS mod_iluminacao.solicitacoes_observacoes (
    id bigserial PRIMARY KEY,
    solicitacao_id bigint NOT NULL,
    observacao varchar(2000) NOT NULL,
    visibilidade varchar(30) NOT NULL DEFAULT 'interna',
    usuario_id varchar(120) NULL,
    usuario_nome varchar(180) NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    editado_em timestamptz NULL,
    deleted_at timestamptz NULL,

    CONSTRAINT fk_iluminacao_observacoes_solicitacao
        FOREIGN KEY (solicitacao_id)
        REFERENCES mod_iluminacao.solicitacoes (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_iluminacao_observacoes_visibilidade CHECK (
        visibilidade IN ('interna', 'publica_futura')
    ),
    CONSTRAINT ck_iluminacao_observacoes_observacao CHECK (
        length(btrim(observacao)) >= 3
    ),
    CONSTRAINT ck_iluminacao_observacoes_usuario_id CHECK (
        usuario_id IS NULL
        OR btrim(usuario_id) <> ''
    ),
    CONSTRAINT ck_iluminacao_observacoes_usuario_nome CHECK (
        usuario_nome IS NULL
        OR btrim(usuario_nome) <> ''
    ),
    CONSTRAINT ck_iluminacao_observacoes_editado_em CHECK (
        editado_em IS NULL
        OR editado_em >= criado_em
    ),
    CONSTRAINT ck_iluminacao_observacoes_deleted_at CHECK (
        deleted_at IS NULL
        OR deleted_at >= criado_em
    )
);

COMMENT ON TABLE mod_iluminacao.solicitacoes_observacoes IS 'Tabela interna de observacoes operacionais de solicitacoes de Iluminacao Publica.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.id IS 'Identificador interno da observacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.solicitacao_id IS 'Referencia a solicitacao principal associada a observacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.observacao IS 'Texto da observacao operacional interna.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.visibilidade IS 'Visibilidade da observacao. Na primeira fase, somente interna deve ser usada; publica_futura e reserva conceitual e nao autoriza exposicao automatica ao cidadao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.usuario_id IS 'Identificador do usuario ou ator interno responsavel, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.usuario_nome IS 'Nome exibivel do usuario ou ator interno responsavel, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.criado_em IS 'Data e hora de criacao da observacao.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.editado_em IS 'Data e hora de edicao da observacao, quando aplicavel futuramente.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_observacoes.deleted_at IS 'Data e hora de soft delete da observacao, quando aplicavel futuramente.';

CREATE INDEX IF NOT EXISTS ix_iluminacao_observacoes_solicitacao_id
    ON mod_iluminacao.solicitacoes_observacoes (solicitacao_id);

CREATE INDEX IF NOT EXISTS ix_iluminacao_observacoes_criado_em
    ON mod_iluminacao.solicitacoes_observacoes (criado_em);

CREATE INDEX IF NOT EXISTS ix_iluminacao_observacoes_usuario_id
    ON mod_iluminacao.solicitacoes_observacoes (usuario_id);

CREATE INDEX IF NOT EXISTS ix_iluminacao_observacoes_visibilidade
    ON mod_iluminacao.solicitacoes_observacoes (visibilidade);

CREATE INDEX IF NOT EXISTS ix_iluminacao_observacoes_deleted_at
    ON mod_iluminacao.solicitacoes_observacoes (deleted_at);
