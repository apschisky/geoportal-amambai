# Rollbacks

Rollbacks correspondentes as migrations entram nesta pasta.

Convencao sugerida:

- `0001_drop_mod_iluminacao_schema.sql`
- `0002_drop_iluminacao_solicitacoes.sql`

O rollback `0001_drop_mod_iluminacao_schema.sql` remove apenas o schema vazio `mod_iluminacao` e nao usa `CASCADE`.

Rollback deve ser testado em homologacao.

Nem toda operacao destrutiva sera aceitavel em producao sem backup.
