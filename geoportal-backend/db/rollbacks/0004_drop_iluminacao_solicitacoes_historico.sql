-- Rollback 0004
-- Remove a tabela interna de historico/auditoria de solicitacoes de Iluminacao Publica.
-- Executar apenas em ambiente controlado, com backup e autorizacao.
-- Nao remove o schema mod_iluminacao.
-- Nao remove a tabela mod_iluminacao.solicitacoes.
-- Nao remove sequences.

DROP TABLE IF EXISTS mod_iluminacao.solicitacoes_historico;
