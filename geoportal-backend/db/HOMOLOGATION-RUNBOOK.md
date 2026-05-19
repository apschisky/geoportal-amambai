# Runbook de Homologacao - Banco de Dados

## Aviso inicial

Este documento e publico/versionado.

Nao deve conter host real, porta real, nome real de banco, usuario real, senha, IP interno ou caminho local.

Dados reais de execucao devem ficar fora do Git.

Este documento nao executa nada; e apenas roteiro.

## Objetivo

Orientar a futura aplicacao controlada das migrations do modulo de Iluminacao Publica em homologacao.

## Pre-requisitos

- Acesso administrativo ao PostgreSQL de homologacao.
- Backup/snapshot antes da execucao.
- PostGIS habilitado.
- Confirmacao do banco correto.
- Confirmacao de que a execucao NAO e em producao.
- Migrations revisadas no Git.

## Placeholders

- `<PSQL_PATH>`
- `<DB_HOST_HOMOLOGACAO>`
- `<DB_PORT_HOMOLOGACAO>`
- `<DB_NAME_HOMOLOGACAO>`
- `<DB_ADMIN_USER>`

## Verificacoes antes da execucao

Verificar versao do PostgreSQL:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT version();"
```

Verificar banco atual:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT current_database();"
```

Verificar PostGIS:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT postgis_full_version();"
```

Verificar se o schema `mod_iluminacao` ainda nao existe:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'mod_iluminacao';"
```

Verificar se a tabela `mod_iluminacao.solicitacoes` ainda nao existe:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT to_regclass('mod_iluminacao.solicitacoes');"
```

## Ordem de execucao futura

1. `0001_create_mod_iluminacao_schema.sql`
2. `0002_create_iluminacao_solicitacoes.sql`

Executar migration 0001:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -f "geoportal-backend/db/migrations/0001_create_mod_iluminacao_schema.sql"
```

Executar migration 0002:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -f "geoportal-backend/db/migrations/0002_create_iluminacao_solicitacoes.sql"
```

## Validacoes pos-execucao

Listar schema `mod_iluminacao`:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'mod_iluminacao';"
```

Listar tabela `solicitacoes`:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'mod_iluminacao' AND table_name = 'solicitacoes';"
```

Listar colunas:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'mod_iluminacao' AND table_name = 'solicitacoes' ORDER BY ordinal_position;"
```

Listar constraints:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'mod_iluminacao.solicitacoes'::regclass ORDER BY conname;"
```

Listar indices:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'mod_iluminacao' AND tablename = 'solicitacoes' ORDER BY indexname;"
```

Confirmar `geometry_columns`:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT f_table_schema, f_table_name, f_geometry_column, type, srid FROM geometry_columns WHERE f_table_schema = 'mod_iluminacao' AND f_table_name = 'solicitacoes';"
```

Confirmar SRID 32721:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -c "SELECT srid FROM geometry_columns WHERE f_table_schema = 'mod_iluminacao' AND f_table_name = 'solicitacoes' AND f_geometry_column = 'geom';"
```

## Rollback em homologacao

Rollback e apenas para ambiente controlado.

Ordem:

1. `0002_drop_iluminacao_solicitacoes.sql`
2. `0001_drop_mod_iluminacao_schema.sql`

Executar rollback 0002:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -f "geoportal-backend/db/rollbacks/0002_drop_iluminacao_solicitacoes.sql"
```

Executar rollback 0001:

```powershell
& "<PSQL_PATH>" `
  -h <DB_HOST_HOMOLOGACAO> `
  -p <DB_PORT_HOMOLOGACAO> `
  -U <DB_ADMIN_USER> `
  -d <DB_NAME_HOMOLOGACAO> `
  -f "geoportal-backend/db/rollbacks/0001_drop_mod_iluminacao_schema.sql"
```

Nao usar em producao sem backup, autorizacao formal e revisao.

`DROP TABLE` e `DROP SCHEMA` podem causar perda de dados.

## Usuario restrito da API

A API nao deve usar `postgres`, usuario admin ou superuser.

Criar usuario proprio e restrito para a API, com permissoes minimas por modulo e ambiente.

Permissoes previstas para a etapa publica inicial:

- `CONNECT` no banco de homologacao.
- `USAGE` no schema `mod_iluminacao`.
- `INSERT` e `SELECT` na tabela `mod_iluminacao.solicitacoes`.
- `USAGE` e `SELECT` na sequence `mod_iluminacao.solicitacoes_id_seq`.

`UPDATE` fica para etapa futura do painel interno.

Usar o template `db/security/create_api_user_template.sql` apenas como modelo. Substituir placeholders localmente fora do repositorio. Dados reais devem ficar fora do Git.

## O que nao fazer

- Nao executar em producao.
- Nao usar superuser da producao sem necessidade.
- Nao commitar senhas.
- Nao commitar logs com IP/usuario/senha.
- Nao colar dados pessoais no Git.
- Nao executar rollback em producao sem autorizacao.

## Checklist de evidencias

- Print ou log da versao do banco.
- Confirmacao do PostGIS.
- Confirmacao do schema criado.
- Confirmacao da tabela criada.
- Confirmacao das constraints.
- Confirmacao dos indices.
- Commit/hash da migration executada.
- Data/hora da execucao.
- Responsavel tecnico.

## Registro de homologacao inicial

As migrations `0001_create_mod_iluminacao_schema.sql` e `0002_create_iluminacao_solicitacoes.sql` foram aplicadas com sucesso em banco de homologacao, em ambiente separado e restaurado a partir de backup recente.

Registro seguro, sem dados sensiveis:

- PostGIS estava habilitado.
- O schema `mod_iluminacao` foi criado.
- A tabela `mod_iluminacao.solicitacoes` foi criada.
- `geometry_columns` confirmou `geom` como `POINT` com SRID `32721`.
- Constraints e indices foram conferidos.
- Um teste de insert valido foi feito em transacao com `ROLLBACK`.
- Testes invalidos confirmaram bloqueio por `CHECK` constraints.
- `COUNT(*)` confirmou ausencia de dados de teste persistidos.
- A validacao visual foi feita em ferramenta administrativa.
- O banco ativo nao foi alterado.
- Nao houve persistencia de dados de teste.

## Registro de validacao do usuario restrito da API

O usuario restrito da API foi criado e validado em homologacao, sem registro de credenciais reais no Git.

Registro seguro, sem dados sensiveis:

- Permissoes administrativas foram negadas.
- O usuario nao possui `SUPERUSER`.
- O usuario nao possui `CREATEDB`.
- O usuario nao possui `CREATEROLE`.
- O usuario nao possui `REPLICATION`.
- O usuario nao possui `BYPASSRLS`.
- Permissoes minimas foram concedidas somente para `mod_iluminacao`.
- `CONNECT` no banco de homologacao foi confirmado.
- `USAGE` no schema `mod_iluminacao` foi confirmado.
- `INSERT` e `SELECT` na tabela `mod_iluminacao.solicitacoes` foram confirmados.
- `USAGE` e `SELECT` na sequence `mod_iluminacao.solicitacoes_id_seq` foram confirmados.
- `UPDATE` e `DELETE` foram negados.
- Acesso a schemas nao necessarios foi negado.
- Um teste de `INSERT` com `ROLLBACK` confirmou funcionamento.
- `COUNT(*)` confirmou ausencia de dados de teste persistidos.
- Credenciais reais permaneceram fora do Git.

## Registro de validacao da sequence de protocolo

A migration `0003_create_iluminacao_protocolo_sequence.sql` foi aplicada com sucesso em banco de homologacao, em ambiente separado.

Registro seguro, sem dados sensiveis:

- A sequence dedicada `mod_iluminacao.solicitacoes_protocolo_seq` foi criada.
- `nextval` foi validado.
- A montagem de protocolo no formato `IP-YYYY-NNNNNN` foi validada.
- O usuario restrito da API recebeu permissao minima na sequence.
- O usuario restrito da API conseguiu consumir a sequence.
- O banco ativo nao foi alterado.
- Nao houve dados sensiveis no registro.

## Registro de validacao do endpoint persistente

O endpoint publico `POST /api/public/iluminacao/solicitacoes` foi validado em homologacao com persistencia ativa.

Registro seguro, sem dados sensiveis:

- O fluxo endpoint -> service -> protocol_service -> repository -> banco foi validado.
- O endpoint retornou `201 Created`.
- O protocolo real foi gerado pela sequence no formato `IP-YYYY-NNNNNN`.
- O protocolo retornado foi sequencial, nao fixo/simulado.
- O registro foi gravado em `mod_iluminacao.solicitacoes`.
- O status retornou `aberta`.
- Os defaults `prioridade = normal`, `origem = geoportal_publico` e `duplicidade_suspeita = false` foram confirmados.
- A geometria foi gravada com SRID `32721`.
- O registro de teste foi limpo apos a validacao.
- O banco ativo nao foi alterado.
- Credenciais reais permaneceram fora do Git.

## Registro de validacao do erro seguro 503

O endpoint publico `POST /api/public/iluminacao/solicitacoes` foi testado com banco indisponivel em ambiente controlado.

Registro seguro, sem dados sensiveis:

- A persistencia estava ativa para o teste controlado.
- A resposta HTTP `503` foi retornada.
- A resposta trouxe apenas mensagem generica e segura.
- Detalhes internos nao foram expostos.
- A configuracao local deve ser restaurada apos esse tipo de teste.
- `PERSIST_SOLICITACOES` deve permanecer `false` por padrao.

## Registro de validacao da duplicidade suspeita

O endpoint persistente foi usado em homologacao para validar a marcacao leve de duplicidade suspeita.

Registro seguro, sem dados sensiveis:

- Duas solicitacoes semelhantes foram enviadas para o mesmo poste e tipo de problema.
- A primeira solicitacao foi gravada sem marca de duplicidade.
- A segunda solicitacao foi marcada como `duplicidade_suspeita`.
- Nenhuma solicitacao foi bloqueada.
- Os registros de teste foram limpos ou devem ser limpos apos a validacao.
- O banco ativo nao foi alterado.
- Credenciais reais permaneceram fora do Git.
