# Migrations

Migrations futuras entram nesta pasta.

Convencao sugerida:

- `0001_create_mod_iluminacao_schema.sql`
- `0002_create_iluminacao_solicitacoes.sql`
- `0003_create_iluminacao_protocolo_sequence.sql`
- `0004_create_iluminacao_solicitacoes_historico.sql`
- `0005_create_iluminacao_solicitacoes_observacoes.sql`
- `0006_create_mod_auth_schema.sql`
- `0007_create_mod_auth_usuarios.sql`

A migration `0001_create_mod_iluminacao_schema.sql` cria apenas o schema `mod_iluminacao`.

A migration `0002_create_iluminacao_solicitacoes.sql` cria a tabela operacional inicial `mod_iluminacao.solicitacoes`.

A migration `0003_create_iluminacao_protocolo_sequence.sql` cria sequence dedicada para protocolos de solicitacoes de iluminacao.

A migration `0004_create_iluminacao_solicitacoes_historico.sql` cria a tabela interna de historico/auditoria `mod_iluminacao.solicitacoes_historico`. Ela nao altera a tabela principal.

A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` cria a tabela interna de observacoes operacionais `mod_iluminacao.solicitacoes_observacoes`. Ela nao altera a tabela principal nem o historico.

A migration `0006_create_mod_auth_schema.sql` cria apenas o schema transversal `mod_auth` para autenticacao/autorizacao interna futura. Ela nao cria tabelas, usuarios, GRANTs ou dados iniciais.

A migration `0006` foi aplicada e validada em homologacao e no banco ativo de producao, sempre apos backup manual validado como legivel. O schema `mod_auth` foi criado, o comentario do schema foi validado e foi confirmado que nenhuma tabela foi criada nesta etapa.

A migration `0007_create_mod_auth_usuarios.sql` cria apenas a tabela `mod_auth.usuarios`, com constraints, indices e comentarios. Ela nao cria usuarios reais, seeds, GRANTs, triggers, funcoes ou endpoints e ainda nao foi aplicada no banco.

Proxima etapa: revisar e aplicar a migration `0007` em homologacao com backup e validacao.

As migrations `0004` e `0005` foram aplicadas e validadas em homologacao com backup previo, inserts controlados, validacao de FKs restritivas e limpeza dos registros de teste.

As migrations `0004` e `0005` tambem foram aplicadas no banco ativo de producao apos backup manual validado como legivel. As tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas, os indices foram validados e as FKs para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. A API publica permaneceu saudavel, `/api/version` continuou retornando ambiente `producao` e as tabelas internas permaneceram vazias apos a criacao. Ainda nao existem endpoints internos nem tela interna usando essas tabelas.

Proxima etapa: desenhar endpoints internos protegidos para status, historico e observacoes.

Cada migration deve ser pequena, revisavel e testada em homologacao.

Nao criar migration grande com muitas responsabilidades.
