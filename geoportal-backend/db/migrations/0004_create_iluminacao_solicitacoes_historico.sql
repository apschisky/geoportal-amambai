-- Migration 0004
-- Cria a tabela interna de historico/auditoria de solicitacoes de Iluminacao Publica.
-- Destinada primeiro a homologacao.
-- Nao cria usuarios.
-- Nao cria GRANT.
-- Nao cria triggers.
-- Nao cria funcoes.
-- Nao altera a tabela mod_iluminacao.solicitacoes.
-- Requer que a migration 0002 ja tenha criado mod_iluminacao.solicitacoes.
-- Nao deve ser executada em producao sem backup, revisao e autorizacao.

CREATE TABLE IF NOT EXISTS mod_iluminacao.solicitacoes_historico (
    id bigserial PRIMARY KEY,
    solicitacao_id bigint NOT NULL,
    acao varchar(40) NOT NULL,
    status_anterior varchar(40) NULL,
    status_novo varchar(40) NULL,
    prioridade_anterior varchar(20) NULL,
    prioridade_nova varchar(20) NULL,
    usuario_id varchar(120) NULL,
    usuario_nome varchar(180) NULL,
    origem_acao varchar(40) NOT NULL DEFAULT 'sistema',
    observacao_resumida varchar(1000) NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_iluminacao_historico_solicitacao
        FOREIGN KEY (solicitacao_id)
        REFERENCES mod_iluminacao.solicitacoes (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_iluminacao_historico_acao CHECK (
        acao IN (
            'criacao',
            'alteracao_status',
            'alteracao_prioridade',
            'observacao_interna',
            'encerramento',
            'cancelamento',
            'reabertura'
        )
    ),
    CONSTRAINT ck_iluminacao_historico_origem_acao CHECK (
        origem_acao IN (
            'sistema',
            'usuario_interno',
            'importacao_controlada',
            'ajuste_administrativo'
        )
    ),
    CONSTRAINT ck_iluminacao_historico_status_anterior CHECK (
        status_anterior IS NULL
        OR status_anterior IN (
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
    CONSTRAINT ck_iluminacao_historico_status_novo CHECK (
        status_novo IS NULL
        OR status_novo IN (
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
    CONSTRAINT ck_iluminacao_historico_prioridade_anterior CHECK (
        prioridade_anterior IS NULL
        OR prioridade_anterior IN ('baixa', 'normal', 'alta', 'urgente')
    ),
    CONSTRAINT ck_iluminacao_historico_prioridade_nova CHECK (
        prioridade_nova IS NULL
        OR prioridade_nova IN ('baixa', 'normal', 'alta', 'urgente')
    ),
    CONSTRAINT ck_iluminacao_historico_usuario_id CHECK (
        usuario_id IS NULL
        OR btrim(usuario_id) <> ''
    ),
    CONSTRAINT ck_iluminacao_historico_usuario_nome CHECK (
        usuario_nome IS NULL
        OR btrim(usuario_nome) <> ''
    ),
    CONSTRAINT ck_iluminacao_historico_observacao_resumida CHECK (
        observacao_resumida IS NULL
        OR btrim(observacao_resumida) <> ''
    )
);

COMMENT ON TABLE mod_iluminacao.solicitacoes_historico IS 'Tabela interna de historico e auditoria de solicitacoes de Iluminacao Publica.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.id IS 'Identificador interno do evento de historico.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.solicitacao_id IS 'Referencia a solicitacao principal auditada.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.acao IS 'Tipo de acao registrada no historico.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.status_anterior IS 'Status anterior da solicitacao, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.status_novo IS 'Novo status da solicitacao, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.prioridade_anterior IS 'Prioridade anterior da solicitacao, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.prioridade_nova IS 'Nova prioridade da solicitacao, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.usuario_id IS 'Identificador do usuario ou ator interno responsavel, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.usuario_nome IS 'Nome exibivel do usuario ou ator interno responsavel, quando aplicavel.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.origem_acao IS 'Origem da acao registrada: sistema, usuario interno, importacao controlada ou ajuste administrativo.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.observacao_resumida IS 'Resumo operacional da acao, sem dados sensiveis desnecessarios.';
COMMENT ON COLUMN mod_iluminacao.solicitacoes_historico.criado_em IS 'Data e hora de criacao do evento de historico.';

CREATE INDEX IF NOT EXISTS ix_iluminacao_historico_solicitacao_id
    ON mod_iluminacao.solicitacoes_historico (solicitacao_id);

CREATE INDEX IF NOT EXISTS ix_iluminacao_historico_criado_em
    ON mod_iluminacao.solicitacoes_historico (criado_em);

CREATE INDEX IF NOT EXISTS ix_iluminacao_historico_acao
    ON mod_iluminacao.solicitacoes_historico (acao);

CREATE INDEX IF NOT EXISTS ix_iluminacao_historico_usuario_id
    ON mod_iluminacao.solicitacoes_historico (usuario_id);

CREATE INDEX IF NOT EXISTS ix_iluminacao_historico_origem_acao
    ON mod_iluminacao.solicitacoes_historico (origem_acao);
