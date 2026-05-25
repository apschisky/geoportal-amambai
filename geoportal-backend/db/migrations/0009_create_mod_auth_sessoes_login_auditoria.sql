-- Migration 0009
-- Cria apenas tabelas estruturais de sessoes e auditoria de login do schema mod_auth.
--
-- Requer que a migration 0006 ja tenha criado o schema mod_auth.
-- Requer que a migration 0007 ja tenha criado a tabela mod_auth.usuarios.
-- Esta migration nao cria login funcional, endpoint, seed, sessao real, auditoria real ou token real.
-- Esta migration nao cria usuario, senha, hash real, credencial, GRANT, trigger ou funcao.
-- Esta migration nao altera mod_iluminacao, plano, web_map ou a API publica.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

CREATE TABLE IF NOT EXISTS mod_auth.sessoes (
  id bigserial PRIMARY KEY,
  usuario_id bigint NOT NULL,
  token_hash varchar(255) NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogado_em timestamptz NULL,
  ip_hash varchar(255) NULL,
  user_agent_hash varchar(255) NULL,
  CONSTRAINT fk_mod_auth_sessoes_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES mod_auth.usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_mod_auth_sessoes_token_hash_not_blank
    CHECK (btrim(token_hash) <> ''),
  CONSTRAINT ck_mod_auth_sessoes_expira_em_after_criado_em
    CHECK (expira_em > criado_em),
  CONSTRAINT ck_mod_auth_sessoes_revogado_em_after_criado_em
    CHECK (revogado_em IS NULL OR revogado_em >= criado_em),
  CONSTRAINT ck_mod_auth_sessoes_ip_hash_not_blank
    CHECK (ip_hash IS NULL OR btrim(ip_hash) <> ''),
  CONSTRAINT ck_mod_auth_sessoes_user_agent_hash_not_blank
    CHECK (user_agent_hash IS NULL OR btrim(user_agent_hash) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_sessoes_token_hash
  ON mod_auth.sessoes (token_hash);

CREATE INDEX IF NOT EXISTS ix_mod_auth_sessoes_usuario_id
  ON mod_auth.sessoes (usuario_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_sessoes_expira_em
  ON mod_auth.sessoes (expira_em);

CREATE INDEX IF NOT EXISTS ix_mod_auth_sessoes_revogado_em
  ON mod_auth.sessoes (revogado_em);

COMMENT ON TABLE mod_auth.sessoes IS 'Sessoes internas ou identificadores seguros de autenticacao do Geoportal.';
COMMENT ON COLUMN mod_auth.sessoes.id IS 'Identificador interno da sessao.';
COMMENT ON COLUMN mod_auth.sessoes.usuario_id IS 'Usuario interno associado a sessao.';
COMMENT ON COLUMN mod_auth.sessoes.token_hash IS 'Hash ou identificador seguro do token; nunca deve armazenar token puro.';
COMMENT ON COLUMN mod_auth.sessoes.criado_em IS 'Data/hora de criacao da sessao.';
COMMENT ON COLUMN mod_auth.sessoes.expira_em IS 'Data/hora obrigatoria de expiracao da sessao.';
COMMENT ON COLUMN mod_auth.sessoes.revogado_em IS 'Data/hora opcional de revogacao da sessao.';
COMMENT ON COLUMN mod_auth.sessoes.ip_hash IS 'Hash opcional de origem; nao deve armazenar IP bruto quando houver alternativa segura.';
COMMENT ON COLUMN mod_auth.sessoes.user_agent_hash IS 'Hash opcional do user-agent; nao deve armazenar user-agent bruto quando houver alternativa segura.';

CREATE TABLE IF NOT EXISTS mod_auth.login_auditoria (
  id bigserial PRIMARY KEY,
  usuario_id bigint NULL,
  login_informado varchar(180) NULL,
  sucesso boolean NOT NULL,
  motivo_falha varchar(120) NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  origem varchar(80) NULL,
  CONSTRAINT fk_mod_auth_login_auditoria_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES mod_auth.usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_mod_auth_login_auditoria_login_informado_not_blank
    CHECK (login_informado IS NULL OR btrim(login_informado) <> ''),
  CONSTRAINT ck_mod_auth_login_auditoria_motivo_falha_not_blank
    CHECK (motivo_falha IS NULL OR btrim(motivo_falha) <> ''),
  CONSTRAINT ck_mod_auth_login_auditoria_origem_not_blank
    CHECK (origem IS NULL OR btrim(origem) <> '')
);

CREATE INDEX IF NOT EXISTS ix_mod_auth_login_auditoria_usuario_id
  ON mod_auth.login_auditoria (usuario_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_login_auditoria_login_informado
  ON mod_auth.login_auditoria (login_informado);

CREATE INDEX IF NOT EXISTS ix_mod_auth_login_auditoria_sucesso
  ON mod_auth.login_auditoria (sucesso);

CREATE INDEX IF NOT EXISTS ix_mod_auth_login_auditoria_criado_em
  ON mod_auth.login_auditoria (criado_em);

COMMENT ON TABLE mod_auth.login_auditoria IS 'Auditoria operacional de tentativas de login interno.';
COMMENT ON COLUMN mod_auth.login_auditoria.id IS 'Identificador interno do evento de auditoria de login.';
COMMENT ON COLUMN mod_auth.login_auditoria.usuario_id IS 'Usuario interno identificado na tentativa, quando aplicavel.';
COMMENT ON COLUMN mod_auth.login_auditoria.login_informado IS 'Login informado na tentativa; deve ser tratado como dado operacional sensivel.';
COMMENT ON COLUMN mod_auth.login_auditoria.sucesso IS 'Indica se a tentativa de login teve sucesso.';
COMMENT ON COLUMN mod_auth.login_auditoria.motivo_falha IS 'Motivo generico de falha, sem detalhes sensiveis.';
COMMENT ON COLUMN mod_auth.login_auditoria.criado_em IS 'Data/hora de registro da tentativa.';
COMMENT ON COLUMN mod_auth.login_auditoria.origem IS 'Origem operacional generica da tentativa, quando informada.';
