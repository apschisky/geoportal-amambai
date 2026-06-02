# Modelo de Dados Interno de Iluminacao Publica

Este documento detalha o modelo conceitual para historico/auditoria e observacoes internas do modulo interno de Iluminacao Publica. Ele nao aplica migrations, nao altera codigo e nao altera banco nesta etapa.

## 1. Objetivo

Registrar o desenho das tabelas internas:

- `mod_iluminacao.solicitacoes_historico`;
- `mod_iluminacao.solicitacoes_observacoes`.

Essas tabelas devem apoiar triagem, acompanhamento, execucao, encerramento, auditoria e rastreabilidade operacional das solicitacoes registradas pelo Geoportal.

## 2. Separacao de responsabilidades

- `mod_iluminacao.solicitacoes`: tabela principal, guarda o estado atual da solicitacao.
- `mod_iluminacao.solicitacoes_historico`: trilha de auditoria de mudancas relevantes.
- `mod_iluminacao.solicitacoes_observacoes`: comentarios internos operacionais.

A tabela principal continua sendo a fonte do estado atual. O historico registra eventos append-only. As observacoes registram contexto operacional interno sem expor esse conteudo ao cidadao.

## 3. Tabela `solicitacoes_historico`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `acao`;
- `status_anterior`;
- `status_novo`;
- `prioridade_anterior`;
- `prioridade_nova`;
- `usuario_id`;
- `usuario_nome`;
- `origem_acao`;
- `observacao_resumida`;
- `criado_em`.

### Acoes esperadas

- `criacao`;
- `alteracao_status`;
- `alteracao_prioridade`;
- `observacao_interna`;
- `encerramento`;
- `cancelamento`;
- `reabertura`, se vier a existir futuramente.

### Origem da acao

- `sistema`;
- `usuario_interno`;
- `importacao_controlada`;
- `ajuste_administrativo`.

## 4. Tabela `solicitacoes_observacoes`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `observacao`;
- `visibilidade`;
- `usuario_id`;
- `usuario_nome`;
- `criado_em`;
- `editado_em`, se necessario futuramente;
- `deleted_at`, se necessario futuramente.

### Visibilidade

- `interna`;
- `publica_futura`.

Na primeira fase, somente `interna` deve ser usada. A visibilidade `publica_futura` fica apenas como possibilidade conceitual e nao autoriza exposicao automatica ao cidadao.

## 5. Regras de auditoria e privacidade

- Consulta publica nunca deve retornar observacoes internas.
- Consulta publica nunca deve retornar historico administrativo completo.
- Alteracao de status deve sempre gerar registro em `solicitacoes_historico`.
- Alteracao de prioridade deve sempre gerar registro em `solicitacoes_historico`.
- Criacao de observacao interna deve gerar registro em `solicitacoes_observacoes` e evento resumido em `solicitacoes_historico`.
- Nao deve existir alteracao de status sem registro correspondente em `solicitacoes_historico`.
- Acoes internas devem registrar `usuario_id`, `usuario_nome` e `origem_acao = 'usuario_interno'` quando aplicavel.
- Acoes automaticas devem registrar `origem_acao = 'sistema'`.
- Ajustes administrativos devem registrar `origem_acao = 'ajuste_administrativo'`.
- Historico deve ser append-only.
- Exclusao fisica deve ser evitada.
- Soft delete, se usado em observacoes, deve ser auditado.
- Dados pessoais devem ser minimizados.
- Listagens internas devem minimizar dados pessoais e evitar contato/telefone quando nao houver necessidade operacional.
- Usuario e data/hora devem ser registrados nas acoes internas.
- Logs nao devem conter senha, token, `DATABASE_URL`, telefone completo ou dados sensiveis desnecessarios.

## 6. Referencia para outros modulos

Este desenho deve servir como referencia para modulos futuros do Geoportal, como:

- Meio Ambiente;
- Defesa Civil;
- Obras;
- Fiscalizacao;
- outros servicos urbanos.

Cada modulo pode adaptar nomes e campos, mas deve preservar os principios de estado atual, historico append-only, observacoes internas, auditoria e separacao entre dados publicos e internos.

## 7. Migrations internas 0004 e 0005

As migrations internas foram mantidas pequenas, revisaveis e reversiveis:

- uma migration para `solicitacoes_historico`;
- uma migration para `solicitacoes_observacoes`;
- rollbacks correspondentes;
- foreign key para `mod_iluminacao.solicitacoes(id)`;
- indices por `solicitacao_id`;
- indices por `criado_em`;
- indices por `acao`;
- indices por `usuario_id`;
- constraints para `acao`;
- constraints para `origem_acao`;
- constraints para `visibilidade`.

As migrations devem manter o schema `mod_iluminacao` como area operacional da API e do modulo interno. Nao devem gravar em `plano` nem em `web_map`.

Migrations futuras do modulo interno, como usuarios, perfis ou sessoes, tambem devem continuar pequenas, revisaveis e reversiveis.

Registro documental: a migration `0004_create_iluminacao_solicitacoes_historico.sql` e o rollback correspondente foram criados para a tabela `mod_iluminacao.solicitacoes_historico`. A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` e o rollback correspondente foram criados para a tabela `mod_iluminacao.solicitacoes_observacoes`.

A visibilidade `publica_futura` em `solicitacoes_observacoes` e apenas reserva conceitual. Ela nao autoriza exposicao automatica ao cidadao; observacoes internas nao devem aparecer na consulta publica.

Validacao em homologacao: as migrations `0004` e `0005` foram aplicadas em homologacao apos backup manual validado como legivel. As tabelas internas foram criadas, FKs restritivas foram testadas, inserts controlados funcionaram e a exclusao da solicitacao principal foi bloqueada quando havia historico vinculado. Os registros internos de teste foram removidos e as tabelas ficaram vazias apos a limpeza.

Registro de aplicacao no banco ativo: as migrations `0004` e `0005` foram aplicadas em producao apos backup manual validado como legivel. Antes da aplicacao, o banco ativo possuia apenas `mod_iluminacao.solicitacoes` entre as tabelas internas. Apos a aplicacao, as tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas, seus indices foram validados e as FKs restritivas para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. A API publica continuou saudavel, `/api/version` continuou retornando ambiente `producao` e as tabelas internas permaneceram vazias apos a criacao.

Ainda nao ha endpoints internos nem tela interna usando `solicitacoes_historico` ou `solicitacoes_observacoes`. A proxima etapa e desenhar endpoints internos protegidos para alteracao de status, consulta de historico e registro de observacoes.

## 7.1 Diagnostico do Schema para Proximos Endpoints

Diagnostico tecnico realizado apos a validacao da listagem interna com filtros e antes de qualquer endpoint mutavel ou tela interna.

### `mod_iluminacao.solicitacoes_historico`

Tabela criada pela migration `0004_create_iluminacao_solicitacoes_historico.sql`.

Colunas existentes:

- `id bigserial PRIMARY KEY`;
- `solicitacao_id bigint NOT NULL`;
- `acao varchar(40) NOT NULL`;
- `status_anterior varchar(40) NULL`;
- `status_novo varchar(40) NULL`;
- `prioridade_anterior varchar(20) NULL`;
- `prioridade_nova varchar(20) NULL`;
- `usuario_id varchar(120) NULL`;
- `usuario_nome varchar(180) NULL`;
- `origem_acao varchar(40) NOT NULL DEFAULT 'sistema'`;
- `observacao_resumida varchar(1000) NULL`;
- `criado_em timestamptz NOT NULL DEFAULT now()`.

Garantias existentes:

- FK para `mod_iluminacao.solicitacoes(id)` com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`.
- Checks para `acao`, `origem_acao`, status, prioridade e strings nao vazias.
- Indices em `solicitacao_id`, `criado_em`, `acao`, `usuario_id` e `origem_acao`.
- Nao possui `deleted_at`, coerente com historico append-only.

### `mod_iluminacao.solicitacoes_observacoes`

Tabela criada pela migration `0005_create_iluminacao_solicitacoes_observacoes.sql`.

Colunas existentes:

- `id bigserial PRIMARY KEY`;
- `solicitacao_id bigint NOT NULL`;
- `observacao varchar(2000) NOT NULL`;
- `visibilidade varchar(30) NOT NULL DEFAULT 'interna'`;
- `usuario_id varchar(120) NULL`;
- `usuario_nome varchar(180) NULL`;
- `criado_em timestamptz NOT NULL DEFAULT now()`;
- `editado_em timestamptz NULL`;
- `deleted_at timestamptz NULL`.

Garantias existentes:

- FK para `mod_iluminacao.solicitacoes(id)` com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`.
- Check de `visibilidade` em `interna` e `publica_futura`.
- Check minimo de observacao com `length(btrim(observacao)) >= 3`.
- Checks de datas para `editado_em` e `deleted_at`.
- Indices em `solicitacao_id`, `criado_em`, `usuario_id`, `visibilidade` e `deleted_at`.

### Vinculo com Autenticacao

Nao ha FK para `mod_auth.usuarios`. O schema usa `usuario_id` e `usuario_nome` como campos livres. Essa decisao preserva rastreabilidade operacional flexivel e evita acoplamento forte entre schemas, mas nao garante integridade referencial no banco.

A aplicacao deve preencher `usuario_id` e, quando disponivel de forma segura, `usuario_nome` a partir da sessao interna autenticada. Se `usuario_nome` nao estiver disponivel no fluxo atual, a primeira implementacao deve registrar apenas `usuario_id` ou buscar nome/login por caminho controlado, sem hardcode de usuario.

### Suficiencia do Schema Atual

O schema atual e suficiente para os proximos endpoints basicos:

- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`;
- `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`, desde que a aplicacao grave historico obrigatorio na mesma transacao.

Nao e recomendada migration para esses endpoints basicos. Migration futura deve ser considerada apenas se houver decisao explicita por FK real com `mod_auth.usuarios`, campos extras de IP/origem, equipe/setor, anexos ou auditoria obrigatoria via trigger.

### Riscos e Controles

- Nao existe trigger obrigando historico; a aplicacao deve garantir que acoes mutaveis gravem historico na mesma transacao.
- Antes de `PATCH status`, ainda e necessario definir transicoes permitidas, regra de finalizacao e `finalizado_em`, observacao/motivo obrigatorio ou opcional, auditoria obrigatoria e dados de usuario a gravar.
- Observacoes internas devem filtrar `deleted_at IS NULL` e usar `visibilidade = 'interna'` na primeira fase.
- A visibilidade `publica_futura` continua reserva conceitual e nao autoriza exposicao automatica ao cidadao.
- A API publica nao deve ser afetada se os proximos endpoints permanecerem em `/api/internal/*`, protegidos por feature flag, sessao interna e `require_permission`.

### Permissoes e Ordem Recomendada

Permissoes futuras recomendadas:

- `iluminacao.solicitacoes.ver_historico`;
- `iluminacao.solicitacoes.comentar`;
- `iluminacao.solicitacoes.atualizar_status`.

Ordem recomendada de implementacao:

1. `GET /api/internal/iluminacao/solicitacoes/{id}/historico` - implementado e validado em homologacao interna no commit `b68bc32`.
2. `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` - implementado e validado em homologacao interna no commit `da236c4`.
3. `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`.
4. Somente depois, `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`.

O GRANT operacional aplicado para o historico foi somente `SELECT` em `mod_iluminacao.solicitacoes_historico` para `geoportal_api_homolog`, mantendo `INSERT=false`, `UPDATE=false` e `DELETE=false`. GRANTs futuros devem continuar minimos e por etapa: `SELECT` para leitura de observacoes; `INSERT` e uso das sequences correspondentes para criacao de observacao e evento de historico; `UPDATE` em `mod_iluminacao.solicitacoes` apenas quando o endpoint de status for implementado.

### Validacao do Endpoint de Historico

O endpoint `GET /api/internal/iluminacao/solicitacoes/{id}/historico` foi publicado e validado em homologacao interna. Ele exige `iluminacao.solicitacoes.ver_historico`, valida a existencia da solicitacao com `deleted_at IS NULL`, consulta `mod_iluminacao.solicitacoes_historico` com colunas explicitas, bind parameters e ordenacao `criado_em ASC, id ASC`, e retorna envelope com `items`, `limit`, `offset` e `total`.

A validacao operacional usou dado de homologacao/teste (`solicitacao_id=18`) e retornou 200 OK com `total=0`, comportamento esperado porque ainda nao havia eventos historicos gravados para essa solicitacao. Essa validacao nao criou migration, nao alterou schema, nao criou endpoint mutavel, nao alterou producao, proxy, frontend ou `.env` versionado e nao registrou token, senha, cookie real, hash, `session_secret` real ou `DATABASE_URL` real.

### Validacao do Endpoint de Observacoes Internas

O endpoint `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` foi publicado e validado em homologacao interna. Ele exige `iluminacao.solicitacoes.ver_observacoes`, nao reutiliza `iluminacao.solicitacoes.comentar`, valida a existencia da solicitacao com `deleted_at IS NULL`, consulta `mod_iluminacao.solicitacoes_observacoes` com colunas explicitas, bind parameters, filtro `deleted_at IS NULL`, filtro `visibilidade = 'interna'` e ordenacao `criado_em ASC, id ASC`, e retorna envelope com `items`, `limit`, `offset` e `total`.

A permissao real `iluminacao.solicitacoes.ver_observacoes` foi criada em homologacao e vinculada ao perfil `administrador-interno-geoportal`. A permissao `iluminacao.solicitacoes.comentar` permaneceu reservada para o futuro endpoint mutavel de criacao de observacao.

O unico GRANT aplicado nesta etapa foi `SELECT` minimo em `mod_iluminacao.solicitacoes_observacoes` para `geoportal_api_homolog`; a matriz final manteve `INSERT=false`, `UPDATE=false` e `DELETE=false`.

A validacao operacional usou dado de homologacao/teste (`solicitacao_id=18`) e retornou 200 OK com `total=0`, comportamento esperado porque ainda nao havia observacoes internas gravadas para essa solicitacao. Essa validacao nao criou migration, nao alterou schema, nao criou endpoint mutavel, nao alterou producao, proxy, frontend ou `.env` versionado e nao registrou token, senha, cookie real, hash, `session_secret` real ou `DATABASE_URL` real.

## 8. Uso pelos endpoints internos

Endpoints internos futuros devem usar essas tabelas da seguinte forma:

- `GET /api/internal/iluminacao/solicitacoes` lista solicitacoes com dados pessoais minimizados e filtros operacionais.
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` altera o estado atual e grava historico.
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` grava observacao e evento resumido no historico.
- `GET /api/internal/iluminacao/solicitacoes/{id}` pode retornar detalhe interno com historico e observacoes, respeitando permissao.
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico` retorna historico administrativo conforme perfil e ja foi validado com permissao propria em homologacao interna.
- `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` retorna observacoes internas com `visibilidade = 'interna'` conforme perfil e ja foi validado com permissao propria em homologacao interna.
- `GET /api/internal/iluminacao/estatisticas` retorna indicadores internos sem expor dados pessoais desnecessarios.
- `GET /api/public/iluminacao/consulta` nao retorna historico interno nem observacoes internas.

Todos os endpoints em `/api/internal/...` devem exigir autenticacao, autorizacao por perfil e validacao no backend. O desenho de perfis e permissoes esta em `docs/INTERNAL-AUTHORIZATION-PLAN.md`.

## 9. Riscos prevenidos

Este desenho reduz os seguintes riscos:

- perda de rastreabilidade;
- alteracao manual sem auditoria;
- exposicao indevida de dados internos;
- dificuldade de apurar quem alterou um chamado;
- inconsistencia entre status atual e historico;
- dificuldade de replicar o padrao para outros modulos;
- acesso interno sem autorizacao;
- endpoint administrativo publicado por engano;
- vazamento de senha, token ou dados pessoais em logs.

## 10. Criterios de aceite desta etapa documental

- Nenhum codigo funcional alterado.
- Migrations internas `0004` e `0005` aplicadas em homologacao e no banco ativo com backup e validacao.
- Modelo conceitual claro.
- Regras de auditoria explicitas.
- Separacao publico/interno preservada.
- Documento pronto para orientar endpoints internos protegidos e futuras migrations de autenticacao/autorizacao.
