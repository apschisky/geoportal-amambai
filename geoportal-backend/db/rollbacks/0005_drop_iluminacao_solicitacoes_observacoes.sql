-- Rollback 0005
-- Remove a tabela interna de observacoes operacionais de solicitacoes de Iluminacao Publica.
-- Executar apenas em ambiente controlado, com backup e autorizacao.
-- Nao remove o schema mod_iluminacao.
-- Nao remove a tabela mod_iluminacao.solicitacoes.
-- Nao remove a tabela mod_iluminacao.solicitacoes_historico.
-- Nao remove sequences.

DROP TABLE IF EXISTS mod_iluminacao.solicitacoes_observacoes;
