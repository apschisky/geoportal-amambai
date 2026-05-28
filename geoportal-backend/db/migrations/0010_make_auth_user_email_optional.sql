-- Migration 0010
-- Torna o email de mod_auth.usuarios opcional, mantendo login obrigatorio e unico.
--
-- Requer que a migration 0007 ja tenha criado a tabela mod_auth.usuarios.
-- Esta migration nao cria usuarios reais, nao insere dados e nao cria seed.
-- Esta migration nao cria senha, hash real, token, credencial, GRANT, endpoint, trigger ou funcao.
-- Esta migration nao altera mod_iluminacao, plano, web_map ou a API publica.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

ALTER TABLE mod_auth.usuarios
  ALTER COLUMN email DROP NOT NULL;

DROP INDEX IF EXISTS mod_auth.ux_mod_auth_usuarios_email_lower;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_auth_usuarios_email_lower
  ON mod_auth.usuarios (lower(email))
  WHERE email IS NOT NULL;

COMMENT ON COLUMN mod_auth.usuarios.email IS 'Email opcional do usuario interno, unico por comparacao normalizada quando informado.';
COMMENT ON COLUMN mod_auth.usuarios.login IS 'Login obrigatorio do usuario interno, unico por comparacao normalizada e usado como identificador principal de autenticacao.';
