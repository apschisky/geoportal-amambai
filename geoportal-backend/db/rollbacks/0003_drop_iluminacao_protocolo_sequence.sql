-- Rollback da migration 0003
-- Remove a sequence de protocolo.
-- Usar apenas em homologacao inicial ou ambiente controlado.
-- Em producao pode causar perda da continuidade da numeracao.
-- Nao usa CASCADE.

DROP SEQUENCE IF EXISTS mod_iluminacao.solicitacoes_protocolo_seq;
