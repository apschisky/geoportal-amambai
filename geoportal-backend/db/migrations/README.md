# Migrations

Migrations futuras entram nesta pasta.

Convencao sugerida:

- `0001_create_mod_iluminacao_schema.sql`
- `0002_create_iluminacao_solicitacoes.sql`
- `0003_create_iluminacao_protocolo_sequence.sql`

A migration `0001_create_mod_iluminacao_schema.sql` cria apenas o schema `mod_iluminacao`.

A migration `0002_create_iluminacao_solicitacoes.sql` cria a tabela operacional inicial `mod_iluminacao.solicitacoes`.

A migration `0003_create_iluminacao_protocolo_sequence.sql` cria sequence dedicada para protocolos de solicitacoes de iluminacao.

Cada migration deve ser pequena, revisavel e testada em homologacao.

Nao criar migration grande com muitas responsabilidades.
