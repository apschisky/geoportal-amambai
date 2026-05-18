-- Migration 0003
-- Cria sequence dedicada para geracao de protocolo do modulo de Iluminacao Publica.
-- Depende da migration 0001, que cria schema mod_iluminacao.
-- Deve ser executada primeiro em homologacao.
-- Nao cria tabela.
-- Nao cria usuario.
-- Nao cria GRANT.
-- Nao altera dados existentes.
-- Nao deve ser executada em producao sem backup, revisao e autorizacao.

CREATE SEQUENCE IF NOT EXISTS mod_iluminacao.solicitacoes_protocolo_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

COMMENT ON SEQUENCE mod_iluminacao.solicitacoes_protocolo_seq
IS 'Sequence para numeracao de protocolos do modulo de Iluminacao Publica.';
