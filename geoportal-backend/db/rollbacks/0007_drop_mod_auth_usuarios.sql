-- Rollback 0007
-- Remove apenas a tabela mod_auth.usuarios.
--
-- Executar somente em ambiente controlado, com backup e confirmacao operacional.
-- Este rollback nao usa CASCADE de proposito: se houver tabelas futuras dependentes de usuarios, deve falhar.
-- Este rollback nao remove o schema mod_auth.
-- Este rollback nao remove mod_iluminacao, plano, web_map ou qualquer outro schema.
-- Nao incluir dados sensiveis, credenciais, tokens, DATABASE_URL, IP interno ou caminhos locais.

DROP TABLE IF EXISTS mod_auth.usuarios;
