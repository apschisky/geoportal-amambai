-- Migration 0008
-- Cria apenas tabelas estruturais de perfis, permissoes e vinculos do schema mod_auth.
--
-- Requer que a migration 0006 ja tenha criado o schema mod_auth.
-- Requer que a migration 0007 ja tenha criado a tabela mod_auth.usuarios.
-- Esta migration nao cria seed, perfis reais, permissoes reais ou vinculos de usuarios.
-- Esta migration nao cria usuario, senha, hash real, token, credencial, GRANT, endpoint, trigger ou funcao.
-- Esta migration nao altera mod_iluminacao, plano, web_map ou a API publica.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

CREATE TABLE IF NOT EXISTS mod_auth.perfis (
  id bigserial PRIMARY KEY,
  chave varchar(80) NOT NULL,
  nome varchar(120) NOT NULL,
  descricao varchar(500) NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_mod_auth_perfis_chave_not_blank
    CHECK (btrim(chave) <> ''),
  CONSTRAINT ck_mod_auth_perfis_nome_not_blank
    CHECK (btrim(nome) <> ''),
  CONSTRAINT ck_mod_auth_perfis_descricao_not_blank
    CHECK (descricao IS NULL OR btrim(descricao) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_perfis_chave_lower
  ON mod_auth.perfis (lower(chave));

CREATE INDEX IF NOT EXISTS ix_mod_auth_perfis_ativo
  ON mod_auth.perfis (ativo);

COMMENT ON TABLE mod_auth.perfis IS 'Perfis internos reutilizaveis para autorizacao transversal do Geoportal.';
COMMENT ON COLUMN mod_auth.perfis.id IS 'Identificador interno do perfil.';
COMMENT ON COLUMN mod_auth.perfis.chave IS 'Chave tecnica unica do perfil, comparada de forma normalizada.';
COMMENT ON COLUMN mod_auth.perfis.nome IS 'Nome de exibicao do perfil.';
COMMENT ON COLUMN mod_auth.perfis.descricao IS 'Descricao opcional do perfil.';
COMMENT ON COLUMN mod_auth.perfis.ativo IS 'Indica se o perfil esta ativo para atribuicao e autorizacao.';
COMMENT ON COLUMN mod_auth.perfis.criado_em IS 'Data/hora de criacao do registro.';

CREATE TABLE IF NOT EXISTS mod_auth.permissoes (
  id bigserial PRIMARY KEY,
  modulo varchar(80) NOT NULL,
  chave varchar(120) NOT NULL,
  descricao varchar(500) NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_mod_auth_permissoes_modulo_not_blank
    CHECK (btrim(modulo) <> ''),
  CONSTRAINT ck_mod_auth_permissoes_chave_not_blank
    CHECK (btrim(chave) <> ''),
  CONSTRAINT ck_mod_auth_permissoes_descricao_not_blank
    CHECK (descricao IS NULL OR btrim(descricao) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_permissoes_modulo_chave_lower
  ON mod_auth.permissoes (lower(modulo), lower(chave));

CREATE INDEX IF NOT EXISTS ix_mod_auth_permissoes_modulo
  ON mod_auth.permissoes (modulo);

CREATE INDEX IF NOT EXISTS ix_mod_auth_permissoes_ativo
  ON mod_auth.permissoes (ativo);

COMMENT ON TABLE mod_auth.permissoes IS 'Permissoes internas granulares por modulo e acao.';
COMMENT ON COLUMN mod_auth.permissoes.id IS 'Identificador interno da permissao.';
COMMENT ON COLUMN mod_auth.permissoes.modulo IS 'Modulo interno ao qual a permissao pertence.';
COMMENT ON COLUMN mod_auth.permissoes.chave IS 'Chave tecnica da permissao dentro do modulo.';
COMMENT ON COLUMN mod_auth.permissoes.descricao IS 'Descricao opcional da permissao.';
COMMENT ON COLUMN mod_auth.permissoes.ativo IS 'Indica se a permissao esta ativa para autorizacao.';
COMMENT ON COLUMN mod_auth.permissoes.criado_em IS 'Data/hora de criacao do registro.';

CREATE TABLE IF NOT EXISTS mod_auth.usuario_perfis (
  usuario_id bigint NOT NULL,
  perfil_id bigint NOT NULL,
  modulo varchar(80) NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_mod_auth_usuario_perfis_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES mod_auth.usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_mod_auth_usuario_perfis_perfil
    FOREIGN KEY (perfil_id)
    REFERENCES mod_auth.perfis (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_mod_auth_usuario_perfis_modulo_not_blank
    CHECK (modulo IS NULL OR btrim(modulo) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_usuario_perfis_global
  ON mod_auth.usuario_perfis (usuario_id, perfil_id)
  WHERE modulo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_usuario_perfis_modulo_lower
  ON mod_auth.usuario_perfis (usuario_id, perfil_id, lower(modulo))
  WHERE modulo IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuario_perfis_usuario_id
  ON mod_auth.usuario_perfis (usuario_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuario_perfis_perfil_id
  ON mod_auth.usuario_perfis (perfil_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuario_perfis_modulo
  ON mod_auth.usuario_perfis (modulo);

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuario_perfis_ativo
  ON mod_auth.usuario_perfis (ativo);

COMMENT ON TABLE mod_auth.usuario_perfis IS 'Vinculos entre usuarios internos e perfis, com escopo global ou por modulo.';
COMMENT ON COLUMN mod_auth.usuario_perfis.usuario_id IS 'Usuario interno vinculado ao perfil.';
COMMENT ON COLUMN mod_auth.usuario_perfis.perfil_id IS 'Perfil atribuido ao usuario.';
COMMENT ON COLUMN mod_auth.usuario_perfis.modulo IS 'Modulo ao qual o vinculo se aplica; nulo indica vinculo global.';
COMMENT ON COLUMN mod_auth.usuario_perfis.ativo IS 'Indica se o vinculo esta ativo para autorizacao.';
COMMENT ON COLUMN mod_auth.usuario_perfis.criado_em IS 'Data/hora de criacao do registro.';

CREATE TABLE IF NOT EXISTS mod_auth.perfil_permissoes (
  perfil_id bigint NOT NULL,
  permissao_id bigint NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_mod_auth_perfil_permissoes
    PRIMARY KEY (perfil_id, permissao_id),
  CONSTRAINT fk_mod_auth_perfil_permissoes_perfil
    FOREIGN KEY (perfil_id)
    REFERENCES mod_auth.perfis (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_mod_auth_perfil_permissoes_permissao
    FOREIGN KEY (permissao_id)
    REFERENCES mod_auth.permissoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_mod_auth_perfil_permissoes_perfil_id
  ON mod_auth.perfil_permissoes (perfil_id);

CREATE INDEX IF NOT EXISTS ix_mod_auth_perfil_permissoes_permissao_id
  ON mod_auth.perfil_permissoes (permissao_id);

COMMENT ON TABLE mod_auth.perfil_permissoes IS 'Vinculos entre perfis internos e permissoes.';
COMMENT ON COLUMN mod_auth.perfil_permissoes.perfil_id IS 'Perfil vinculado a permissao.';
COMMENT ON COLUMN mod_auth.perfil_permissoes.permissao_id IS 'Permissao atribuida ao perfil.';
COMMENT ON COLUMN mod_auth.perfil_permissoes.criado_em IS 'Data/hora de criacao do registro.';
