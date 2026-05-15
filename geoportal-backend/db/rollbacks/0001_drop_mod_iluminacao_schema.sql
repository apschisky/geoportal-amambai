-- Rollback da migration 0001
-- Remove o schema mod_iluminacao.
-- Deve ser usado apenas em homologacao inicial ou ambiente controlado.
-- Em producao, DROP SCHEMA pode causar perda de dados e exige backup/revisao.

DROP SCHEMA IF EXISTS mod_iluminacao;
