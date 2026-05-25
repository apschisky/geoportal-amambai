-- Migration 0007
-- Cria apenas a tabela mod_auth.usuarios para autenticacao/autorizacao interna futura.
--
-- Requer que a migration 0006 ja tenha criado o schema mod_auth.
-- Esta migration nao cria usuarios reais, nao insere dados e nao cria seed.
-- Esta migration nao cria senha, hash real, token, credencial, GRANT, endpoint, trigger ou funcao.
-- Esta migration nao altera mod_iluminacao, plano ou web_map.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

CREATE TABLE IF NOT EXISTS mod_auth.usuarios (
  id bigserial PRIMARY KEY,
  nome varchar(180) NOT NULL,
  email varchar(180) NOT NULL,
  login varchar(80) NOT NULL,
  senha_hash varchar(255) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  bloqueado_ate timestamptz NULL,
  ultimo_login_em timestamptz NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NULL,
  desativado_em timestamptz NULL,
  CONSTRAINT ck_mod_auth_usuarios_nome_not_blank
    CHECK (btrim(nome) <> ''),
  CONSTRAINT ck_mod_auth_usuarios_email_not_blank
    CHECK (btrim(email) <> ''),
  CONSTRAINT ck_mod_auth_usuarios_login_not_blank
    CHECK (btrim(login) <> ''),
  CONSTRAINT ck_mod_auth_usuarios_senha_hash_not_blank
    CHECK (btrim(senha_hash) <> ''),
  CONSTRAINT ck_mod_auth_usuarios_email_formato_minimo
    CHECK (
      position('@' in email) > 1
      AND position('.' in split_part(email, '@', 2)) > 1
    ),
  CONSTRAINT ck_mod_auth_usuarios_atualizado_em
    CHECK (atualizado_em IS NULL OR atualizado_em >= criado_em),
  CONSTRAINT ck_mod_auth_usuarios_desativado_em
    CHECK (desativado_em IS NULL OR desativado_em >= criado_em),
  CONSTRAINT ck_mod_auth_usuarios_ultimo_login_em
    CHECK (ultimo_login_em IS NULL OR ultimo_login_em >= criado_em)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_usuarios_email_lower
  ON mod_auth.usuarios (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_usuarios_login_lower
  ON mod_auth.usuarios (lower(login));

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuarios_ativo
  ON mod_auth.usuarios (ativo);

CREATE INDEX IF NOT EXISTS ix_mod_auth_usuarios_bloqueado_ate
  ON mod_auth.usuarios (bloqueado_ate);

COMMENT ON TABLE mod_auth.usuarios IS 'Usuarios internos do Geoportal para autenticacao e autorizacao transversal.';

COMMENT ON COLUMN mod_auth.usuarios.id IS 'Identificador interno do usuario.';
COMMENT ON COLUMN mod_auth.usuarios.nome IS 'Nome de exibicao do usuario interno.';
COMMENT ON COLUMN mod_auth.usuarios.email IS 'Email do usuario interno, unico por comparacao normalizada.';
COMMENT ON COLUMN mod_auth.usuarios.login IS 'Login do usuario interno, unico por comparacao normalizada.';
COMMENT ON COLUMN mod_auth.usuarios.senha_hash IS 'Hash da senha do usuario; nunca deve armazenar senha em texto puro.';
COMMENT ON COLUMN mod_auth.usuarios.ativo IS 'Indica se o usuario esta ativo para acesso interno.';
COMMENT ON COLUMN mod_auth.usuarios.bloqueado_ate IS 'Data/hora ate quando o usuario fica temporariamente bloqueado, quando aplicavel.';
COMMENT ON COLUMN mod_auth.usuarios.ultimo_login_em IS 'Data/hora do ultimo login bem-sucedido.';
COMMENT ON COLUMN mod_auth.usuarios.criado_em IS 'Data/hora de criacao do registro.';
COMMENT ON COLUMN mod_auth.usuarios.atualizado_em IS 'Data/hora da ultima atualizacao do registro.';
COMMENT ON COLUMN mod_auth.usuarios.desativado_em IS 'Data/hora de desativacao do usuario, quando aplicavel.';
