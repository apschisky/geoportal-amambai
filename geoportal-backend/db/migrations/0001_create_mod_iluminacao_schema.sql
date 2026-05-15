-- Migration 0001
-- Cria apenas o schema operacional mod_iluminacao.
-- Destinada primeiro a homologacao.
-- Nao cria tabelas.
-- Nao cria usuarios.
-- Nao cria permissoes.
-- Nao deve ser executada em producao sem backup, revisao e autorizacao.

CREATE SCHEMA IF NOT EXISTS mod_iluminacao;

COMMENT ON SCHEMA mod_iluminacao IS 'Schema operacional do modulo de Iluminacao Publica do Geoportal de Amambai.';
