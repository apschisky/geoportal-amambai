-- Rollback da migration 0002
-- Remove a tabela mod_iluminacao.solicitacoes.
-- Deve ser usado apenas em homologacao ou ambiente controlado.
-- Em producao, DROP TABLE pode causar perda de dados e exige backup/revisao.
-- Nao usa CASCADE.

DROP TABLE IF EXISTS mod_iluminacao.solicitacoes;
