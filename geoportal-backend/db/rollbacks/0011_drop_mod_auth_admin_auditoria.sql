-- Rollback 0011
-- Remove somente a estrutura de auditoria administrativa criada pela migration 0011.
-- Nao executar se houver eventos reais sem backup e autorizacao operacional explicita.

DROP TABLE IF EXISTS mod_auth.admin_auditoria;
