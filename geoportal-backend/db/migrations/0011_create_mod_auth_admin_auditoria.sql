-- Migration 0011
-- Cria auditoria append-only para acoes administrativas internas.
--
-- Requer as migrations 0006, 0007 e 0008.
-- Nao cria usuarios, perfis, permissoes, vinculos, seeds ou GRANTs.
-- Nao armazena senha, hash, token, cookie, segredo ou payload bruto.

CREATE TABLE IF NOT EXISTS mod_auth.admin_auditoria (
  id bigserial PRIMARY KEY,
  ator_usuario_id bigint NOT NULL,
  ator_login varchar(80) NOT NULL,
  acao varchar(120) NOT NULL,
  entidade_tipo varchar(80) NOT NULL,
  entidade_id varchar(180) NULL,
  resultado varchar(30) NOT NULL,
  motivo varchar(500) NULL,
  resumo varchar(1000) NULL,
  justificativa varchar(1000) NULL,
  origem varchar(120) NULL,
  request_id varchar(120) NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_mod_auth_admin_auditoria_ator
    FOREIGN KEY (ator_usuario_id)
    REFERENCES mod_auth.usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_mod_auth_admin_auditoria_ator_login_not_blank
    CHECK (btrim(ator_login) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_acao_not_blank
    CHECK (btrim(acao) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_entidade_tipo_not_blank
    CHECK (btrim(entidade_tipo) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_entidade_id_not_blank
    CHECK (entidade_id IS NULL OR btrim(entidade_id) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_resultado
    CHECK (resultado IN ('sucesso', 'negada', 'erro_validacao')),
  CONSTRAINT ck_mod_auth_admin_auditoria_motivo_not_blank
    CHECK (motivo IS NULL OR btrim(motivo) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_resumo_not_blank
    CHECK (resumo IS NULL OR btrim(resumo) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_justificativa_not_blank
    CHECK (justificativa IS NULL OR btrim(justificativa) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_origem_not_blank
    CHECK (origem IS NULL OR btrim(origem) <> ''),
  CONSTRAINT ck_mod_auth_admin_auditoria_request_id_not_blank
    CHECK (request_id IS NULL OR btrim(request_id) <> '')
);

CREATE INDEX IF NOT EXISTS ix_mod_auth_admin_auditoria_criado_em
  ON mod_auth.admin_auditoria (criado_em);

CREATE INDEX IF NOT EXISTS ix_mod_auth_admin_auditoria_ator_usuario_id
  ON mod_auth.admin_auditoria (ator_usuario_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_admin_auditoria_acao
  ON mod_auth.admin_auditoria (acao);

CREATE INDEX IF NOT EXISTS ix_mod_auth_admin_auditoria_entidade
  ON mod_auth.admin_auditoria (entidade_tipo, entidade_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_admin_auditoria_resultado
  ON mod_auth.admin_auditoria (resultado);

COMMENT ON TABLE mod_auth.admin_auditoria IS
  'Auditoria append-only de acoes administrativas internas do Geoportal.';
COMMENT ON COLUMN mod_auth.admin_auditoria.ator_usuario_id IS
  'Usuario autenticado que iniciou a acao administrativa.';
COMMENT ON COLUMN mod_auth.admin_auditoria.ator_login IS
  'Snapshot sanitizado do login do ator no momento da acao.';
COMMENT ON COLUMN mod_auth.admin_auditoria.acao IS
  'Categoria tecnica da acao administrativa.';
COMMENT ON COLUMN mod_auth.admin_auditoria.resultado IS
  'Resultado sanitizado: sucesso, negada ou erro_validacao.';
COMMENT ON COLUMN mod_auth.admin_auditoria.resumo IS
  'Resumo sanitizado; nunca deve conter payload bruto ou segredo.';
