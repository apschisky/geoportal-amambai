# Separacao entre Runtime Publico e Runtime Interno

Este documento registra a decisao arquitetural e operacional de separar o runtime publico da API do runtime interno do Geoportal de Amambai. A decisao foi tomada durante a validacao em homologacao do primeiro endpoint interno de negocio do Modulo Iluminacao Publica.

## Contexto

A API publica de Iluminacao ja esta funcional e roda com uma role PostgreSQL publica de menor privilegio. Em homologacao, essa role e `api_iluminacao_homolog` e sua finalidade e atender endpoints publicos `/api/public/*`, com acesso minimo a `mod_iluminacao.solicitacoes` para registrar e consultar solicitacoes publicas.

Essa role publica nao deve acessar `mod_auth`, nao deve executar fluxo de autenticacao/autorizacao interna e nao deve receber privilegios internos. O erro de permissao observado ao tentar executar fluxo interno no runtime publico confirmou uma propriedade desejavel: a role publica esta isolada da autenticacao interna.

O primeiro endpoint interno de negocio implementado foi:

- `GET /api/internal/iluminacao/solicitacoes`

Commit associado:

- `be0e0f1` Adiciona listagem interna de solicitacoes de iluminacao.

O endpoint e somente leitura, exige sessao interna, exige `require_permission("iluminacao.solicitacoes.ler")`, filtra `deleted_at IS NULL`, usa bind parameters, nao usa `SELECT *` e retorna `latitude`/`longitude` em WGS84 a partir de `geom` com `ST_Transform(geom, 4326)`.

## Problema Identificado

Durante a validacao em homologacao, o servico publico de homologacao estava rodando com a role `api_iluminacao_homolog`. Ao tentar usar o login interno nesse runtime publico, ocorreu erro de permissao em `mod_auth.login_auditoria`.

Esse comportamento nao deve ser corrigido concedendo `mod_auth` para `api_iluminacao_homolog`. Pelo contrario: ele confirma que a role publica nao consegue acessar dados e tabelas da autenticacao interna, mantendo a API publica isolada.

## Decisao Arquitetural

A decisao e separar runtime publico e runtime interno.

Nao conceder `mod_auth` para `api_iluminacao_homolog`.

Usar `geoportal_api_homolog` no runtime interno, com matriz minima ja validada para autenticacao, sessao, autorizacao e leitura interna de Iluminacao.

Essa separacao e uma decisao de seguranca e escalabilidade, nao um contorno temporario.

## Arquitetura em Homologacao

### Runtime publico

- Servico atual: `GeoportalAPIHomologacao`.
- Porta: `8000`.
- Script operacional: `run-homologacao-service.ps1`.
- Env real do servidor: `homologacao.env`, fora do Git.
- Role de banco: `api_iluminacao_homolog`.
- Finalidade: `/api/public/*`.
- Nao acessa `mod_auth`.
- Mantem menor privilegio para o servico publico.

### Runtime interno

- Servico NSSM criado: `GeoportalAPIInternaHomologacao`.
- Porta: `8002`.
- Script operacional criado no servidor: `run-homologacao-interna-service.ps1`.
- Loader operacional criado no servidor: `load-homologacao-interna-env.ps1`.
- Env real do servidor: `homologacao-interna.env`, fora do Git.
- Role de banco: `geoportal_api_homolog`.
- Finalidade: `/api/internal/*`.
- `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true` no runtime interno.
- `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` em homologacao local HTTP.
- NSSM configurado com `Start = SERVICE_AUTO_START`.
- Acesso a `mod_auth` conforme matriz ja validada.
- Acesso adicional minimo a `mod_iluminacao.solicitacoes` somente para leitura do primeiro endpoint interno.

Os arquivos `.env` reais continuam fora do Git. O arquivo `.env.example` pode existir no repositorio apenas com placeholders e sem valores reais.

## Justificativa

Esta arquitetura preserva menor privilegio: a role publica acessa apenas o necessario para a API publica, enquanto a role interna acessa apenas os recursos internos necessarios.

Ela tambem separa responsabilidades. O runtime publico atende cidadaos e fluxos publicos; o runtime interno atende usuarios autenticados e autorizados do Geoportal Interno.

A separacao reduz a superficie de ataque: uma falha ou abuso em endpoint publico nao amplia automaticamente acesso a `mod_auth`.

O desenho escala melhor para multiplos modulos municipais. Cada modulo publico pode manter role tecnica propria, enquanto o runtime interno pode receber permissao minima e revisada para cada novo endpoint interno.

A arquitetura reduz risco de quebrar a API publica, porque a evolucao do Geoportal Interno nao exige mudar a role publica nem ampliar o runtime publico.

## Validacao Realizada em Homologacao

Validacoes operacionais ja realizadas:

- Backend interno subiu manualmente em `127.0.0.1:8002`.
- `/api/health` retornou OK.
- `/api/version` retornou `environment=homologacao`.
- `/api/internal/auth/me` sem sessao retornou 401 `Not authenticated`.
- Login interno com usuario administrativo de homologacao funcionou na porta `8002`.
- `/api/internal/auth/me` retornou sessao autenticada.
- A permissao `iluminacao.solicitacoes.ler` foi criada em homologacao e vinculada ao perfil administrativo interno.
- Foi aplicado em homologacao o acesso minimo de leitura para `geoportal_api_homolog` em `mod_iluminacao.solicitacoes`.
- Nao foi concedido `INSERT`, `UPDATE` ou `DELETE` em `mod_iluminacao` para `geoportal_api_homolog` nesta etapa.
- Nao foi concedido `mod_auth` para `api_iluminacao_homolog`.
- `GET /api/internal/iluminacao/solicitacoes?limit=10&offset=0` funcionou na porta `8002`.
- Foi observado que a sessao interna expira em aproximadamente 1 hora.

Producao nao foi alterada. Apache/proxy publico ainda nao foi alterado. Frontend/tela interna ainda nao foi criado. O runtime interno foi validado em homologacao local, mas ainda nao esta exposto publicamente.

## Validacao Operacional do Runtime Interno de Homologacao

O servico NSSM `GeoportalAPIInternaHomologacao` foi criado e configurado para o runtime interno de homologacao. A configuracao operacional usa `AppDirectory` apontando para o backend implantado no servidor, logs separados de stdout/stderr para o servico interno, rotacao de logs habilitada e `Start = SERVICE_AUTO_START`.

O harness versionado `scripts/deploy/backend-restart-validate-service.ps1` reconhece o environment `InternaHomologacao`, com servico `GeoportalAPIInternaHomologacao`, porta `8002`, `ExpectedEnvironment=homologacao` e validacao de runtime interno. A validacao do harness para esse environment cobre `/api/health`, `/api/version` e `/api/internal/auth/me` sem sessao retornando 401; ela nao executa login para nao exigir senha, token ou cookie.

Resultado operacional validado pelo harness em homologacao:

- Porta `8002` encontrada no `netstat`.
- `/api/health` retornou OK.
- `/api/version` retornou `environment=homologacao`.
- `/api/internal/auth/me` sem sessao retornou 401.
- Resumo final do harness concluido com sucesso.

Validacao autenticada manual pelo servico NSSM:

- Login interno na porta `8002` funcionou com usuario administrativo de homologacao, sem registrar token na documentacao.
- `/api/internal/auth/me` confirmou sessao autenticada.
- A permissao `iluminacao.solicitacoes.ler` foi confirmada para o usuario administrativo.
- `GET /api/internal/iluminacao/solicitacoes?limit=10&offset=0` retornou itens reais.

Estado de seguranca apos a validacao:

- `api_iluminacao_homolog` continua sem acesso a `mod_auth`.
- `geoportal_api_homolog` possui acesso minimo adicional a `mod_iluminacao`: `USAGE` no schema `mod_iluminacao` e `SELECT` em `mod_iluminacao.solicitacoes`.
- Nao foi concedido `INSERT`, `UPDATE` ou `DELETE` em `mod_iluminacao` para `geoportal_api_homolog` nesta etapa.
- Producao, Apache/proxy, frontend, migrations, schema e arquivos `.env` versionados nao foram alterados.
- Nenhum segredo, senha, token, cookie real, hash, `session_secret` real ou `DATABASE_URL` real foi documentado.

## Proximos Passos

1. Planejar proxy/Apache para o runtime interno somente em etapa separada e controlada.
2. Planejar tela interna somente depois da exposicao controlada e revisada.
3. Manter producao fail-closed ate etapa formal de ativacao controlada.
4. Para futura producao interna, avaliar uma porta candidata conceitual como `8003`; essa porta ainda nao foi criada, configurada ou ativada.

## Confirmacoes de Escopo

Esta documentacao nao altera codigo Python, testes, migrations, schema, scripts operacionais, `.env`, NSSM, frontend ou producao.

Esta documentacao nao cria endpoint, usuario, perfil, permissao, role ou GRANT.

Esta documentacao nao inclui senha, token, cookie real, hash, `session_secret` real ou `DATABASE_URL` real.
