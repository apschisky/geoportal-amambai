# Migrations

Migrations futuras entram nesta pasta.

Convencao sugerida:

- `0001_create_mod_iluminacao_schema.sql`
- `0002_create_iluminacao_solicitacoes.sql`
- `0003_create_iluminacao_protocolo_sequence.sql`
- `0004_create_iluminacao_solicitacoes_historico.sql`

A migration `0001_create_mod_iluminacao_schema.sql` cria apenas o schema `mod_iluminacao`.

A migration `0002_create_iluminacao_solicitacoes.sql` cria a tabela operacional inicial `mod_iluminacao.solicitacoes`.

A migration `0003_create_iluminacao_protocolo_sequence.sql` cria sequence dedicada para protocolos de solicitacoes de iluminacao.

A migration `0004_create_iluminacao_solicitacoes_historico.sql` cria a tabela interna de historico/auditoria `mod_iluminacao.solicitacoes_historico`. Ela nao altera a tabela principal e ainda deve ser aplicada somente com backup, validacao e autorizacao.

Cada migration deve ser pequena, revisavel e testada em homologacao.

Nao criar migration grande com muitas responsabilidades.
