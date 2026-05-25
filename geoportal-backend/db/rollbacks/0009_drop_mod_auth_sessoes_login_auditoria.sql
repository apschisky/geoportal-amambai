-- Rollback 0009
-- Remove apenas tabelas estruturais de sessoes e auditoria de login do schema mod_auth.
--
-- Executar somente em ambiente controlado, com backup e confirmacao operacional.
-- Este rollback nao usa CASCADE de proposito: se houver dependencias futuras nao previstas, deve falhar.
-- Este rollback nao remove a tabela mod_auth.usuarios.
-- Este rollback nao remove perfis, permissoes ou vinculos.
-- Este rollback nao remove o schema mod_auth.
-- Este rollback nao remove mod_iluminacao, plano, web_map ou qualquer outro schema.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

DROP TABLE IF EXISTS mod_auth.sessoes;
DROP TABLE IF EXISTS mod_auth.login_auditoria;
