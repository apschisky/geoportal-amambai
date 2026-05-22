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

## Registro de validacao do rate limit 429

O endpoint publico `POST /api/public/iluminacao/solicitacoes` foi testado com rate limit ativo em ambiente controlado.

Registro seguro, sem dados sensiveis:

- A primeira chamada foi permitida.
- A segunda chamada foi bloqueada pelo limite configurado para o teste.
- A resposta HTTP `429` foi retornada.
- A resposta trouxe mensagem publica segura.
- O service nao foi chamado quando o rate limit bloqueou a requisicao.
- O banco nao foi acionado quando a requisicao foi bloqueada.
- A configuracao local deve voltar aos valores padrao apos esse tipo de teste.
- `PERSIST_SOLICITACOES` deve permanecer `false` por padrao.

## Registro de validacao do envio real controlado pelo front-end

O envio real controlado pelo front-end do Geoportal para `POST /api/public/iluminacao/solicitacoes` foi validado em homologacao.

Registro seguro, sem dados sensiveis:

- O botao experimental da API foi ativado temporariamente por configuracao do front-end.
- O envio real foi ativado temporariamente por `submitEnabled`.
- A persistencia foi ativada temporariamente por `PERSIST_SOLICITACOES=true`.
- A API retornou `201 Created`.
- O front-end exibiu modal de sucesso com protocolo e status.
- O protocolo real sequencial foi gerado por sequence.
- A gravacao foi confirmada em `mod_iluminacao.solicitacoes`.
- Foram confirmados `localizacao_tipo`, `poste_id`, `tipo_problema`, `status = aberta`, `prioridade = normal`, `origem = geoportal_publico`, `duplicidade_suspeita`, contato normalizado e geometria com SRID `32721`.
- O Google Forms permaneceu disponivel como fallback.
- Registros de teste devem ser limpos apos a validacao.
- As flags `enabled` e `submitEnabled` devem voltar para `false` apos o teste.
- `PERSIST_SOLICITACOES` deve permanecer `false` por padrao.
- Nenhum protocolo real, contato, credencial, host, porta, IP interno, caminho local, log completo ou `DATABASE_URL` real deve ser registrado no Git.

## Registro de validacao da consulta publica por protocolo

O endpoint publico `POST /api/public/iluminacao/consulta` foi validado manualmente em ambiente controlado.

Registro seguro, sem dados sensiveis:

- Uma solicitacao temporaria foi criada apenas para teste.
- Consulta com protocolo correto e confirmacao correta retornou dados publicos.
- Consulta com protocolo correto e confirmacao incorreta retornou `404` generico.
- Consulta com protocolo inexistente retornou o mesmo `404` generico.
- Consulta com formato invalido de protocolo retornou `422`.
- A resposta publica retornou apenas `protocolo`, `status`, `status_publico`, `data_abertura`, `ultima_atualizacao` e `mensagem`.
- A resposta nao expos id interno, nome, telefone completo, `contato_solicitante`, descricao, observacoes, ponto de referencia, geometria, origem, prioridade, `duplicidade_suspeita` ou dados tecnicos.
- O registro de teste foi limpo apos a validacao.
- A consulta foi preparada no front-end por feature flag e permanece desligada por padrao com `consultaEnabled=false`.
- Nenhum protocolo real, contato, nome, credencial, host, porta, IP interno, caminho local, log completo ou `DATABASE_URL` real deve ser registrado no Git.

## Registro de validacao do bloqueio 409 por poste ativo

O bloqueio de nova solicitacao para poste com solicitacao ativa foi validado manualmente em ambiente controlado.

Registro seguro, sem dados sensiveis:

- A primeira solicitacao para um poste em teste retornou `201 Created` e criou registro.
- Nova solicitacao para o mesmo `poste_id` com solicitacao ativa retornou `409 Conflict`.
- O front-end exibiu a mensagem amigavel: "Ja existe uma solicitacao aberta para este poste. A equipe responsavel ja foi notificada."
- A resposta nao expos protocolo de outra pessoa, nome, contato, descricao ou detalhes administrativos.
- O Google Forms permaneceu disponivel como fallback.
- Registros de teste devem ser limpos apos a validacao.
- Nenhum protocolo real, telefone, nome, credencial, host, porta, IP interno, caminho local, log completo ou `DATABASE_URL` real deve ser registrado no Git.

## Checklist de ativacao controlada

Antes de qualquer ativacao publica, seguir `geoportal-vite/docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`.

O deploy da API no servidor PostgreSQL/PostGIS deve seguir `geoportal-vite/docs/API-SERVER-DEPLOYMENT-PLAN.md`.

Pontos obrigatorios:

- manter `enabled=false`, `submitEnabled=false`, `consultaEnabled=false` e `PERSIST_SOLICITACOES=false` como padrao seguro;
- implantar a API como servico controlado no servidor, nao no computador de desenvolvimento;
- usar `mod_iluminacao` para dados operacionais, sem gravar em `plano` ou `web_map`;
- ativar fases apenas em ambiente controlado;
- manter Google Forms como fallback;
- validar backup, rollback, CORS restrito, rate limit e logs seguros;
- nao registrar credenciais, host real, porta real, IP interno, caminho local ou `DATABASE_URL` real.

## Registro de implantacao da API como servico Windows de homologacao

A API de Iluminacao Publica foi implantada no servidor PostgreSQL/PostGIS em ambiente de homologacao. Inicialmente ficou sem exposicao externa e, em etapa posterior, passou a ser exposta de forma controlada via Apache HTTPS em `/api/`.

Registro seguro, sem dados sensiveis:

- Repositorio clonado no servidor.
- Ambiente virtual Python criado.
- Dependencias instaladas.
- Testes automatizados passaram no servidor.
- Arquivo de ambiente real de homologacao criado fora do Git.
- API conectou ao banco de homologacao com usuario restrito.
- Servico Windows de homologacao criado com NSSM.
- Servico iniciado com sucesso.
- API escutando apenas em `127.0.0.1:8000`.
- `APP_ENV=homologacao`.
- `PERSIST_SOLICITACOES=false`.
- `/api/health` retornou `200 OK`.
- `/api/public/iluminacao/health` retornou `200 OK`.
- `/api/version` retornou ambiente de homologacao.
- Script de solicitacao simulada passou.
- Script de consulta inexistente retornou `404` seguro.
- Backup do arquivo SSL ativo do Apache foi feito antes da alteracao.
- Apache validou sintaxe com `Syntax OK`.
- Proxy reverso `/api/` foi configurado para encaminhar ao servico local da API.
- Apache foi reiniciado com sucesso.
- Servico Apache permaneceu em execucao.
- Servico da API de homologacao permaneceu em execucao.
- `GET /api/health` via HTTPS retornou status ok.
- `GET /api/public/iluminacao/health` via HTTPS retornou status ok.
- `GET /api/version` via HTTPS retornou ambiente de homologacao.
- `POST /api/public/iluminacao/solicitacoes` via HTTPS funcionou com `PERSIST_SOLICITACOES=false`.
- `POST /api/public/iluminacao/consulta` via HTTPS retornou `404` seguro para protocolo inexistente.
- GeoServer continuou acessivel.
- Geoportal publico continuou abrindo e consumindo camadas do GeoServer.
- A API continua rodando internamente em `127.0.0.1:8000`; a exposicao publica ocorre via Apache HTTPS.
- CORS foi validado para a origem oficial do Geoportal.
- Antes do ajuste, origem nao permitida retornava `400 Disallowed CORS origin`.
- O arquivo real de ambiente de homologacao foi ajustado fora do Git para incluir a origem oficial em `ALLOWED_ORIGINS`.
- O servico de homologacao foi reiniciado.
- Apos o ajuste, a origem oficial passou a ser permitida.
- Foi investigada a alternativa de expor a API tambem em `https://geoportal.amambai.ms.gov.br/api/`.
- A investigacao indicou infraestruturas distintas entre Geoportal e GeoServer, sem registrar IPs reais.
- Decisao temporaria: manter a API experimental em `https://geoserver.amambai.ms.gov.br/api/`.
- A rota `https://geoportal.amambai.ms.gov.br/api/` fica como evolucao futura, dependente de proxy no servidor do front-end ou revisao de DNS/VirtualHost.
- O front-end publicado do Geoportal foi testado em build controlado com o botao experimental da API habilitado temporariamente.
- A API foi chamada via HTTPS no dominio tecnico do GeoServer.
- CORS funcionou para a origem oficial do Geoportal.
- O envio simulado retornou sucesso no modal do Geoportal.
- Com `PERSIST_SOLICITACOES=false`, nao houve gravacao real.
- A conferencia posterior no banco confirmou ausencia de novo registro real.
- As flags temporarias foram restauradas para `false` apos o teste e nao devem ser commitadas como `true`.
- Atencao operacional: a chave correta de configuracao do endpoint e `apiUrl`; grafia incorreta pode gerar chamada para `/undefined`.
- `PERSIST_SOLICITACOES` foi ativado temporariamente em homologacao fora do Git para validacao completa.
- O servico de homologacao foi reiniciado e o healthcheck permaneceu ok.
- O front-end publicado enviou solicitacao real para a API via HTTPS.
- A API gravou registros no banco de homologacao.
- A consulta publica por protocolo funcionou.
- O bloqueio de duplicidade ativa por poste retornou mensagem amigavel `409`.
- O rate limit foi acionado durante testes intensivos.
- A conferencia no banco confirmou os registros criados em homologacao.
- O usuario restrito da API nao conseguiu executar `DELETE`, confirmando permissao minima.
- A limpeza dos registros de teste foi feita com usuario administrativo do banco.
- `PERSIST_SOLICITACOES` foi restaurado para `false`.
- Origens devem permanecer restritas, sem wildcard.
- `PERSIST_SOLICITACOES=false` permanece como padrao seguro nesta fase.
- A ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual.
- Google Forms permanece como fallback.
- Proxima fase: ativacao controlada do front-end experimental publicado.
- Nenhum usuario real, senha, host real, IP interno, caminho local real, log completo ou `DATABASE_URL` real deve ser registrado no Git.
