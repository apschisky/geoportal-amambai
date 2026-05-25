-- Migration 0006
-- Cria apenas o schema transversal de autenticacao/autorizacao interna do Geoportal.
--
-- Esta migration nao cria tabelas, usuarios, GRANTs ou dados iniciais.
-- Esta migration nao altera mod_iluminacao, plano, web_map ou a API publica.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

CREATE SCHEMA IF NOT EXISTS mod_auth;

COMMENT ON SCHEMA mod_auth IS 'Schema transversal de autenticacao e autorizacao interna do Geoportal.';
