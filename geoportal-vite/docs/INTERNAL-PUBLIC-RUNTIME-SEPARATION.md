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

Para producao interna/piloto, a decisao complementar e criar runtime proprio `GeoportalAPIInternaProducao` em porta separada (`127.0.0.1:8003`) e banco `amambaiGis`, sem reutilizar `GeoportalAPIInternaHomologacao` (`127.0.0.1:8002`). A troca do Apache `/api/internal/` de `8002` para `8003` deve ocorrer somente em janela controlada, depois de backup, inventario, GRANTs minimos, validacao local do servico novo e rollback documentado.

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
- O endpoint de detalhe `GET /api/internal/iluminacao/solicitacoes/{solicitacao_id}` foi implementado (commit `d198710`) e validado em homologacao; por exemplo, `GET http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18` retornou `200 OK` com campos esperados (dado de homologacao/teste).
- A listagem interna foi aprimorada com filtros operacionais e `total` para paginacao (commit `4731edc`) e validada no runtime interno com dados de homologacao/teste, mantendo leitura protegida por `iluminacao.solicitacoes.ler`.
- Foi observado que a sessao interna expira em aproximadamente 1 hora.

Historico da etapa: naquele momento, producao nao havia sido alterada, o Apache/proxy publico ainda nao havia sido alterado, o runtime interno estava validado apenas em homologacao local e a shell frontend interna ainda nao possuia proxy publico.

Estado atual: a area interna ja esta publicada/testada em `https://geoserver.amambai.ms.gov.br/interno/`, servida pelo Apache do dominio `geoserver` por `Alias`, e a API interna ja esta atras de `https://geoserver.amambai.ms.gov.br/api/internal/`, proxy para `127.0.0.1:8002`. Essa exposicao controlada mantem a porta `8002` sem acesso direto externo e preserva a separacao entre runtime publico, runtime interno e Geoportal publico.

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
- `GET /api/internal/iluminacao/solicitacoes?limit=5&offset=0` retornou `total=2` e paginacao esperada.
- Filtros por protocolo, poste, status/tipo de problema e periodo invalido foram validados com dados de homologacao/teste; periodo invalido retornou 422.
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico` foi implementado no commit `b68bc32` e validado no runtime interno com sessao real e permissao `iluminacao.solicitacoes.ver_historico`.
- Para essa validacao, foi aplicado somente `SELECT` em `mod_iluminacao.solicitacoes_historico` para `geoportal_api_homolog`; `INSERT`, `UPDATE` e `DELETE` permaneceram falsos nessa tabela.
- A chamada com dado de homologacao/teste `GET /api/internal/iluminacao/solicitacoes/18/historico?limit=10&offset=0` retornou 200 OK com `total=0`, comportamento esperado porque ainda nao havia eventos historicos gravados para a solicitacao.
- `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` foi implementado no commit `da236c4` e validado no runtime interno com sessao real e permissao `iluminacao.solicitacoes.ver_observacoes`.
- Para essa validacao, foi aplicado somente `SELECT` em `mod_iluminacao.solicitacoes_observacoes` para `geoportal_api_homolog`; `INSERT`, `UPDATE` e `DELETE` permaneceram falsos nessa tabela.
- A chamada com dado de homologacao/teste `GET /api/internal/iluminacao/solicitacoes/18/observacoes?limit=10&offset=0` retornou 200 OK com `total=0`, comportamento esperado porque ainda nao havia observacoes internas gravadas para a solicitacao.
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` foi implementado no commit `2b05e4a` e validado no runtime interno com sessao real, permissao `iluminacao.solicitacoes.comentar` e header `X-Geoportal-Internal-Request: 1`.
- Para essa validacao, os GRANTs aplicados foram minimos: `INSERT` em `mod_iluminacao.solicitacoes_observacoes`, `INSERT` em `mod_iluminacao.solicitacoes_historico` e `USAGE` nas duas sequences correspondentes; `UPDATE` e `DELETE` permaneceram falsos nas tabelas.
- A chamada com dado de homologacao/teste `POST http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18/observacoes` retornou 201 Created. Depois, `GET observacoes` retornou `total=1` e `GET historico` retornou `total=1`, confirmando a observacao e o evento `observacao_interna` criados na mesma operacao.
- O endpoint de observacao nao alterou status, prioridade ou `finalizado_em` e nao criou `PATCH status`.
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` foi implementado no commit `28f00dc` e validado no runtime interno com sessao real, permissao `iluminacao.solicitacoes.atualizar_status` e header `X-Geoportal-Internal-Request: 1`.
- Para essa validacao, o GRANT foi por coluna: `UPDATE` somente em `status`, `atualizado_em` e `finalizado_em` de `mod_iluminacao.solicitacoes` para `geoportal_api_homolog`. A verificacao confirmou `UPDATE=false` em prioridade, protocolo, geometria, soft delete e dados do solicitante.
- Com dado de homologacao/teste, foram confirmados: transicao valida com historico `alteracao_status`, idempotencia sem novo historico, transicao invalida com 409 sem historico indevido, preenchimento de `finalizado_em` em status terminal e bloqueio de saida de terminal pelo PATCH normal.
- Correcao/reversao de status nao deve usar o PATCH normal; deve ser fluxo futuro separado, com justificativa obrigatoria, permissao especifica restrita e auditoria propria.
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` foi implementado como mutacao interna separada do status. Ele exige sessao real, permissao `iluminacao.solicitacoes.atualizar_prioridade` e header `X-Geoportal-Internal-Request: 1`, aceita somente `prioridade` e `observacao`, registra `alteracao_prioridade` no historico e nao altera status, `finalizado_em`, observacoes internas, protocolo, geometria ou dados pessoais. A shell interna consome esse PATCH apenas por acao explicita no detalhe e o Geoportal publico permanece sem chamada a endpoints internos.
- A integracao inicial da shell `/interno/` com `GET /api/internal/auth/me` foi implementada no commit `a6849dd`. Em validacao frontend local, a shell chamou a rota correta e recebeu `404` no Vite sem proxy/backend interno, comportamento esperado para esse ambiente; no DevTools/Network nao houve chamada para `/api/internal/auth/login`, endpoints de Iluminacao, `POST` ou `PATCH`.
- No servidor de homologacao interna, o codigo foi atualizado no caminho `C:\apps\geoportal-api\backend\geoportal-amambai`, a branch `main` ficou alinhada com `origin/main`, o working tree estava limpo e o commit atual era `a6849dd`. O servico `GeoportalAPIInternaHomologacao` foi reiniciado e validado na porta `8002`; `/api/health` retornou OK, `/api/version` retornou `environment=homologacao` e `/api/internal/auth/me` sem sessao retornou `401 Unauthorized` com corpo vazio.
- Essa validacao confirma que o backend interno esta saudavel, que `/api/internal/auth/me` existe e permanece protegido, e que ainda falta uma validacao ponta a ponta da shell em ambiente que consiga alcancar o backend interno real. Nao alterar Apache/proxy publico nem avancar para listagem interna antes dessa validacao controlada.
- A validacao de bind no servidor confirmou `TCP 127.0.0.1:8002 ... LISTENING`, ou seja, o runtime interno esta ativo apenas em loopback no servidor e nao esta exposto diretamente na interface de rede `10.0.0.109`.
- A partir do PC de desenvolvimento `10.0.0.215`, `Test-NetConnection 10.0.0.109 -Port 8002` confirmou alcance de rede ao servidor (`PingSucceeded=True`), mas falha de conexao TCP na porta (`TcpTestSucceeded=False`). Chamadas diretas para `http://10.0.0.109:8002/api/health`, `/api/version` e `/api/internal/auth/me` nao obtiveram resposta HTTP.
- Essa restricao e positiva do ponto de vista de seguranca: a porta `8002` nao deve ser aberta diretamente na rede sem planejamento, justificativa, escopo de homologacao e rollback.

## Planejamento para Proxy Interno Controlado

Nota de estado: esta secao registra o planejamento que levou ao proxy interno controlado. O proxy `/api/internal/` ja foi implementado no dominio `geoserver.amambai.ms.gov.br` e deve continuar antes do proxy generico `/api/`. Hoje ele aponta para `127.0.0.1:8002`, runtime interno de homologacao. Para levar o MVP interno a producao/piloto controlado, seguir o runbook em `docs/API-SERVER-DEPLOYMENT-PLAN.md`, criando antes `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, com backup, inventario de `amambaiGis`, comparacao com `amambaiGis_homologacao`, GRANTs minimos e rollback antes de qualquer alteracao.

A validacao ponta a ponta da shell `/interno/` contra o backend interno real deve preservar a decisao de manter `GeoportalAPIInternaHomologacao` restrito a `127.0.0.1:8002`. A porta `8002` nao deve ser aberta diretamente na rede interna como primeira escolha; o caminho preferencial e um proxy interno controlado, planejado antes de qualquer alteracao operacional.

Inventario Apache confirmado no servidor:

- existem dois servicos Apache em execucao: `Apache2.4` e `PEMHTTPD-x64`;
- o PID que escuta nas portas publicas `80` e `443` e `10772`;
- o PID `10772` corresponde ao servico `Apache2.4`;
- executavel do Apache publico ativo: `C:\Users\Anderson\OneDrive\Documentos\bd_web_gis\apache\httpd-2.4.63-250207-win64-VS17\Apache24\bin\httpd.exe`;
- `PEMHTTPD-x64` tambem esta em execucao, mas nao escuta `80` ou `443`;
- `httpd -S` do Apache ativo mostrou `ServerRoot: "C:/Apache24"`, `Main DocumentRoot: "C:/Apache24/htdocs"` e `VirtualHost *:443 geoserver.amambai.ms.gov.br`;
- arquivo critico do VirtualHost ativo: `C:\Apache24\conf\extra\httpd-ssl.conf`;
- modulos necessarios ja carregados no Apache ativo: `headers_module`, `proxy_module`, `proxy_http_module` e `ssl_module`;
- sintaxe atual do Apache ativo retornou `Syntax OK`.

O arquivo `C:\Apache24\conf\extra\httpd-ssl.conf` ja contem proxies relevantes:

```apache
ProxyPass /geoserver http://localhost:5436/geoserver
ProxyPassReverse /geoserver http://localhost:5436/geoserver
ProxyPass /api/ http://127.0.0.1:8001/api/
ProxyPassReverse /api/ http://127.0.0.1:8001/api/
```

A futura regra para `/api/internal/` deve ficar antes da regra generica `/api/`, porque `/api/` pode capturar `/api/internal/...` e encaminhar a requisicao para o backend publico/producao em `127.0.0.1:8001`.

O proxy interno deve permitir validar somente:

- `/interno/`;
- `GET /api/internal/auth/me`;
- resposta `401` sem sessao;
- resposta `200` com sessao valida em etapa posterior;
- menu derivado das permissoes retornadas.

Nesta primeira validacao da shell, o proxy interno nao deve liberar `POST`, `PATCH`, listagem de solicitacoes, dashboard, mapa, endpoint de login novo, botao publico de login ou publicacao da area interna para o publico. API publica, Geoportal publico e producao interna permanecem fora do escopo.

### Opcao A - proxy interno de homologacao no Apache com rota controlada

Exemplo conceitual:

- `/interno/` servido pelo build frontend interno;
- `/api/internal/` encaminhado para `http://127.0.0.1:8002/api/internal/`;
- `/api/health` e `/api/version`, se necessarios para validacao, encaminhados de forma controlada;
- nenhuma exposicao direta de `8002` na rede.

Bloco conceitual futuro, ainda nao aplicado:

```apache
ProxyPass        /api/internal/ http://127.0.0.1:8002/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8002/api/internal/
```

Esse bloco deve ficar antes de:

```apache
ProxyPass        /api/ http://127.0.0.1:8001/api/
ProxyPassReverse /api/ http://127.0.0.1:8001/api/
```

Pros:

- aproxima a arquitetura real futura;
- mantem o backend interno restrito ao localhost;
- permite testar a shell com rota relativa `/api/internal/auth/me`;
- evita expor a porta interna.

Contras:

- exige alteracao em Apache/proxy;
- exige backup da configuracao;
- exige plano de rollback;
- exige cuidado para nao afetar o Geoportal publico.

Esta e a opcao recomendada para a proxima etapa de homologacao, desde que seja executada em tarefa operacional propria, com validacao e rollback documentados.

### Opcao B - VirtualHost ou subdominio interno futuro

Exemplo conceitual:

- `interno.geoportal.amambai.ms.gov.br`, ou rota equivalente restrita a rede interna;
- proxy para frontend interno e API interna.

Pros:

- separacao clara entre publico e interno;
- boa base para evolucao futura multi-modulo;
- facilita politicas de seguranca, logs e segmentacao.

Contras:

- exige DNS, certificado e configuracao adicional;
- pode ser cedo para a validacao minima da shell.

Esta opcao deve permanecer como evolucao futura se a validacao minima indicar necessidade de separacao operacional maior.

### Opcao C - rota `/interno/` no mesmo dominio do Geoportal, ainda em homologacao controlada

Pros:

- simples para usuarios internos no futuro;
- aproveita host existente;
- reduz complexidade inicial.

Contras:

- exige muito cuidado para nao expor prematuramente a area interna;
- pode tornar a area interna mais visivel;
- requer autenticacao, autorizacao, logs e rollback validados antes de qualquer producao.

Esta opcao pode ser util para uma fase futura, mas nao deve publicar a area interna no Geoportal publico sem decisao posterior.

### Itens obrigatorios para futura implementacao operacional

Antes de qualquer alteracao em Apache/proxy, a tarefa operacional deve registrar:

- working tree limpo;
- backend interno validado com `.\scripts\deploy\backend-restart-validate-service.ps1 -Environment InternaHomologacao -Restart -Validate`;
- backup obrigatorio do arquivo de configuracao do Apache;
- arquivo envolvido atualmente identificado como `C:\Apache24\conf\extra\httpd-ssl.conf`;
- hash, tamanho e data do arquivo antes da alteracao;
- insercao do bloco `/api/internal/` antes do bloco `/api/`;
- validacao de sintaxe com o executavel do servico ativo: `C:\Users\Anderson\OneDrive\Documentos\bd_web_gis\apache\httpd-2.4.63-250207-win64-VS17\Apache24\bin\httpd.exe -t`;
- se a sintaxe falhar, restaurar backup e nao reiniciar Apache;
- plano de rollback com restauracao do arquivo anterior, reinicio/reload do Apache e validacao do Geoportal publico;
- validacao de que o Geoportal publico abre, camadas publicas continuam funcionando e busca publica permanece operacional;
- validacao de que GeoServer continua respondendo;
- validacao de que a API publica continua respondendo;
- validacao de que `/interno/` abre apenas no ambiente planejado;
- validacao de que `/api/internal/auth/me` retorna `401` sem sessao;
- verificacao de que nao ha chamada para `/api/internal/auth/login`;
- verificacao de que nao ha `POST` nem `PATCH`;
- logs limitados a status e eventos necessarios, sem token, cookie, senha, hash, `session_secret` ou `DATABASE_URL`;
- confirmacao de que o backend interno permanece em `127.0.0.1`;
- confirmacao de que `8002` nao foi liberada no firewall;
- confirmacao de que nao ha exposicao de dados pessoais indevidos;
- confirmacao de que nenhuma acao mutavel foi habilitada.

Criterios de aceite da etapa operacional futura:

- API publica preservada;
- shell interna valida `401` sem sessao;
- tela nao quebra em erro;
- nenhum endpoint mutavel chamado;
- sem alteracao de banco, migration, schema ou `.env`;
- sem abertura direta da porta `8002` na rede.

Recomendacao atual: manter `GeoportalAPIInternaHomologacao` em `127.0.0.1:8002` para homologacao interna e planejar `GeoportalAPIInternaProducao` em `127.0.0.1:8003` para producao interna. Nao abrir `8002` ou `8003` diretamente na rede e nao trocar `/api/internal/` para `8003` antes de validar o novo servico, backup do Apache, `httpd.exe -t` e rollback para `8002`.

## Planejamento para Higienizacao de Apaches Duplicados

O servico `PEMHTTPD-x64` tambem esta em execucao, mas o inventario atual indica que ele nao atende as portas publicas `80` e `443`. Isso representa risco operacional de confusao durante manutencao, validacao de sintaxe, leitura de logs ou reinicio de servico.

Recomendacao: nao parar, desabilitar ou alterar `PEMHTTPD-x64` antes de inventario adicional. A higienizacao de servicos Apache duplicados deve ser etapa futura separada.

Roteiro manual futuro:

1. Inventariar portas do `PEMHTTPD-x64`.
2. Verificar se o PID correspondente escuta alguma porta.
3. Verificar logs do `PEMHTTPD-x64`.
4. Verificar se algum servico PostgreSQL/PEM depende dele.
5. Confirmar se existe acesso local a painel ou servico em `postgres_pref`.
6. Se nao houver dependencia, planejar mudanca controlada de `StartMode` para manual ou desabilitado, apenas apos backup, janela de manutencao e rollback.
7. Nunca parar ou desabilitar o servico duplicado sem evidencia de que nao e usado.
8. Nao confundir o Apache publico ativo `Apache2.4` com `PEMHTTPD-x64`.

Estado de seguranca apos a validacao:

- `api_iluminacao_homolog` continua sem acesso a `mod_auth`.
- `geoportal_api_homolog` possui acesso minimo adicional a `mod_iluminacao`: `USAGE` no schema `mod_iluminacao` e `SELECT` em `mod_iluminacao.solicitacoes`.
- Para leitura de solicitacoes, nao foi concedido `INSERT` ou `DELETE` em `mod_iluminacao.solicitacoes` para `geoportal_api_homolog`; para alteracao de status, foi concedido apenas `UPDATE` por coluna em `status`, `atualizado_em` e `finalizado_em`.
- Para criacao de observacao interna, foram concedidos apenas `INSERT` nas tabelas de observacoes/historico e `USAGE` nas sequences correspondentes, sem `UPDATE` ou `DELETE`.
- Producao, Apache/proxy, frontend, migrations, schema e arquivos `.env` versionados nao foram alterados.
- Nenhum segredo, senha, token, cookie real, hash, `session_secret` real ou `DATABASE_URL` real foi documentado.

## Proximos Passos

1. Inventariar `amambaiGis` e preparar pre-condicoes de producao interna sem alterar Apache.
2. Criar e validar futuramente `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, com `IsInternalRuntime=true`.
3. Trocar `/api/internal/` de `8002` para `8003` somente em janela controlada, com backup e rollback.
4. Manter producao fail-closed ate etapa formal de ativacao controlada.

## Confirmacoes de Escopo

Esta documentacao nao altera codigo Python, testes, migrations, schema, scripts operacionais, `.env`, NSSM, frontend ou producao.

Esta documentacao nao cria endpoint, usuario, perfil, permissao, role ou GRANT.

Esta documentacao nao inclui senha, token, cookie real, hash, `session_secret` real ou `DATABASE_URL` real.
