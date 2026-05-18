-- Template para criar usuario restrito da API em homologacao.
-- Nao incluir senha real no Git.
-- Substituir placeholders localmente fora do repositorio.
-- Executar apenas no banco de homologacao.
-- Nao usar em producao sem revisao/autorizacao.
-- Nao conceder UPDATE nesta etapa.
-- Nao conceder DELETE.
-- Nao conceder TRUNCATE.
-- Nao conceder CREATE no schema.
-- Nao conceder acesso a plano.
-- Nao conceder acesso a web_map.
-- Nao conceder superuser.

CREATE ROLE <API_DB_USER>
  LOGIN
  PASSWORD '<API_DB_PASSWORD>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

GRANT CONNECT ON DATABASE <DB_NAME_HOMOLOGACAO> TO <API_DB_USER>;

GRANT USAGE ON SCHEMA mod_iluminacao TO <API_DB_USER>;

GRANT INSERT, SELECT
ON TABLE mod_iluminacao.solicitacoes
TO <API_DB_USER>;

GRANT USAGE, SELECT
ON SEQUENCE mod_iluminacao.solicitacoes_id_seq
TO <API_DB_USER>;
