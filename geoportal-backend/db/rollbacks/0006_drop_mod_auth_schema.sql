-- Rollback 0006
-- Remove apenas o schema transversal mod_auth, se ele estiver vazio.
--
-- Executar somente em ambiente controlado, com backup e confirmacao de que o schema nao possui objetos.
-- Este rollback nao usa CASCADE de proposito: se houver tabelas ou outros objetos futuros, deve falhar.
-- Este rollback nao remove mod_iluminacao, plano, web_map ou qualquer outro schema.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

DROP SCHEMA IF EXISTS mod_auth;
