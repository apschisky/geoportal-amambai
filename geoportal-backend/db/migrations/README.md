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
- `0008_create_mod_auth_perfis_permissoes.sql`
- `0009_create_mod_auth_sessoes_login_auditoria.sql`

A migration `0001_create_mod_iluminacao_schema.sql` cria apenas o schema `mod_iluminacao`.

A migration `0002_create_iluminacao_solicitacoes.sql` cria a tabela operacional inicial `mod_iluminacao.solicitacoes`.

A migration `0003_create_iluminacao_protocolo_sequence.sql` cria sequence dedicada para protocolos de solicitacoes de iluminacao.

A migration `0004_create_iluminacao_solicitacoes_historico.sql` cria a tabela interna de historico/auditoria `mod_iluminacao.solicitacoes_historico`. Ela nao altera a tabela principal.

A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` cria a tabela interna de observacoes operacionais `mod_iluminacao.solicitacoes_observacoes`. Ela nao altera a tabela principal nem o historico.

A migration `0006_create_mod_auth_schema.sql` cria apenas o schema transversal `mod_auth` para autenticacao/autorizacao interna futura. Ela nao cria tabelas, usuarios, GRANTs ou dados iniciais.

A migration `0006` foi aplicada e validada em homologacao e no banco ativo de producao, sempre apos backup manual validado como legivel. O schema `mod_auth` foi criado, o comentario do schema foi validado e foi confirmado que nenhuma tabela foi criada nesta etapa.

A migration `0007_create_mod_auth_usuarios.sql` cria apenas a tabela `mod_auth.usuarios`, com constraints, indices e comentarios. Ela nao cria usuarios reais, seeds, GRANTs, triggers, funcoes ou endpoints.

A migration `0007` foi aplicada e validada em homologacao apos backup manual validado como legivel. A tabela `mod_auth.usuarios` foi criada, os indices foram validados, constraints foram testadas com dados ficticios, o registro ficticio foi removido e a tabela ficou vazia apos a limpeza.

A migration `0007` tambem foi aplicada no banco ativo de producao apos backup manual validado como legivel. A tabela `mod_auth.usuarios` foi criada, os indices foram validados, a tabela permaneceu vazia apos a criacao, a API publica continuou saudavel e `/api/public/iluminacao/health` continuou OK. Nenhum usuario real, seed, endpoint ou login funcional foi criado.

A migration `0008_create_mod_auth_perfis_permissoes.sql` cria apenas as tabelas `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`. Ela nao cria seeds, perfis reais, permissoes reais, vinculos reais, usuarios, GRANTs, triggers, funcoes ou endpoints.

A migration `0008` foi aplicada e validada em homologacao apos backup manual validado como legivel. As quatro tabelas estruturais foram criadas, indices e FKs restritivas foram validados, constraints e vinculos foram testados com dados ficticios, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza.

A migration `0008` tambem foi aplicada no banco ativo de producao apos backup manual validado como legivel. As tabelas `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes` foram criadas, indices e FKs restritivas foram validados, todas as tabelas `mod_auth` permaneceram vazias apos a criacao, a API publica continuou saudavel, `/api/health` e `/api/public/iluminacao/health` continuaram OK, e `/api/version` continuou retornando ambiente `producao`. Nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado.

A migration `0009_create_mod_auth_sessoes_login_auditoria.sql` cria apenas as tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria`, com constraints, indices, FKs restritivas para `mod_auth.usuarios(id)` e comentarios. Ela nao cria login funcional, endpoints, usuarios, tokens reais, sessoes reais, auditorias reais, seeds, GRANTs, triggers ou funcoes.

Status da `0009`: aplicada e validada em homologacao; producao ainda nao recebeu esta migration.

A migration `0009` foi aplicada e validada em homologacao apos backup manual validado como legivel. As tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas, indices e FKs restritivas foram validados, constraints foram testadas com dados ficticios, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza.

Proxima etapa: avaliar aplicacao da migration `0009` em producao com backup e validacao.

As migrations `0004` e `0005` foram aplicadas e validadas em homologacao com backup previo, inserts controlados, validacao de FKs restritivas e limpeza dos registros de teste.

As migrations `0004` e `0005` tambem foram aplicadas no banco ativo de producao apos backup manual validado como legivel. As tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas, os indices foram validados e as FKs para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. A API publica permaneceu saudavel, `/api/version` continuou retornando ambiente `producao` e as tabelas internas permaneceram vazias apos a criacao. Ainda nao existem endpoints internos nem tela interna usando essas tabelas.

Proxima etapa: desenhar endpoints internos protegidos para status, historico e observacoes.

Cada migration deve ser pequena, revisavel e testada em homologacao.

Nao criar migration grande com muitas responsabilidades.
