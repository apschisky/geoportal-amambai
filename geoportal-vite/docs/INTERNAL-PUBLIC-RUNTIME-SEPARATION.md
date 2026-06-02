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

- Servico futuro: `GeoportalAPIInternaHomologacao`.
- Porta: `8002`.
- Script operacional criado no servidor: `run-homologacao-interna-service.ps1`.
- Loader operacional criado no servidor: `load-homologacao-interna-env.ps1`.
- Env real do servidor: `homologacao-interna.env`, fora do Git.
- Role de banco: `geoportal_api_homolog`.
- Finalidade: `/api/internal/*`.
- `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true` no runtime interno.
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

Produção nao foi alterada. O servico NSSM interno ainda nao foi criado. Apache/proxy publico ainda nao foi alterado. Frontend/tela interna ainda nao foi criado.

## Proximos Passos

1. Criar o servico NSSM `GeoportalAPIInternaHomologacao`.
2. Validar `/api/health`, `/api/version` e `/api/internal/auth/me` na porta `8002` via servico.
3. Validar `GET /api/internal/iluminacao/solicitacoes` via servico.
4. Documentar a validacao operacional.
5. Somente depois planejar proxy/Apache e tela interna.
6. Manter producao fail-closed ate etapa formal de ativacao controlada.

## Confirmacoes de Escopo

Esta documentacao nao altera codigo Python, testes, migrations, schema, scripts operacionais, `.env`, NSSM, frontend ou producao.

Esta documentacao nao cria endpoint, usuario, perfil, permissao, role ou GRANT.

Esta documentacao nao inclui senha, token, cookie real, hash, `session_secret` real ou `DATABASE_URL` real.
