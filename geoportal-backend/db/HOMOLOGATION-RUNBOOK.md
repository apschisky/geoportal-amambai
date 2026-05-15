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
