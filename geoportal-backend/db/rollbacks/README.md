# Rollbacks

Rollbacks correspondentes as migrations entram nesta pasta.

Convencao sugerida:

- `0001_drop_mod_iluminacao_schema.sql`
- `0002_drop_iluminacao_solicitacoes.sql`
- `0003_drop_iluminacao_protocolo_sequence.sql`
- `0004_drop_iluminacao_solicitacoes_historico.sql`
- `0005_drop_iluminacao_solicitacoes_observacoes.sql`

O rollback `0001_drop_mod_iluminacao_schema.sql` remove apenas o schema vazio `mod_iluminacao` e nao usa `CASCADE`.

O rollback `0002_drop_iluminacao_solicitacoes.sql` remove a tabela `mod_iluminacao.solicitacoes` e nao usa `CASCADE`.

O rollback `0003_drop_iluminacao_protocolo_sequence.sql` remove a sequence de protocolo em ambiente controlado.

O rollback `0004_drop_iluminacao_solicitacoes_historico.sql` remove apenas a tabela interna de historico/auditoria em ambiente controlado. Ele nao remove o schema, a tabela principal nem sequences.

O rollback `0005_drop_iluminacao_solicitacoes_observacoes.sql` remove apenas a tabela interna de observacoes operacionais em ambiente controlado. Ele nao remove o schema, a tabela principal, o historico nem sequences.

Rollback deve ser testado em homologacao.

Nem toda operacao destrutiva sera aceitavel em producao sem backup.
