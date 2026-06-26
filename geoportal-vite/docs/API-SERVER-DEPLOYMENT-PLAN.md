# Plano de implantacao da API no servidor PostgreSQL/PostGIS

Este documento registra o plano tecnico conceitual para implantar a API FastAPI de Iluminacao Publica no mesmo servidor onde roda o PostgreSQL/PostGIS. Ele nao executa deploy, nao altera codigo e nao registra host real, IP real, porta interna real, usuario real, senha, caminho local real ou `DATABASE_URL` real.

## 1. Decisao arquitetural

- A API nao deve rodar em computador de desenvolvimento.
- A API deve ser implantada no servidor PostgreSQL/PostGIS como servico controlado.
- A API deve usar variaveis reais fora do Git.
- A API deve ser exposta de forma controlada por Apache/proxy reverso/HTTPS.
- O CORS deve ser restrito a origem oficial do Geoportal, sem wildcard.
- A exposição pública de documentação deve permanecer fechada; `/docs`, `/redoc` e `/openapi.json` devem retornar `404` quando não forem publicados.
- O proxy Apache deve endurecer headers e avaliar ocultar `Server: uvicorn`.
 - O proxy Apache recebeu primeira etapa de hardening de headers (parcialmente aplicada e validada):
	 - `X-Content-Type-Options: nosniff`
	 - `Referrer-Policy: strict-origin-when-cross-origin`
	 - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
	 - Validação: `httpd.exe -t` -> `Syntax OK`, Apache reiniciado, `GET /api/health` e outros endpoints retornaram `200` com os headers presentes. CORS e serviços permaneceram funcionais.
	 - Pendências de hardening (aplicar com cautela): `Content-Security-Policy`, `Strict-Transport-Security` e `X-Frame-Options`.
	 - Alinhar qualquer implementacao de autenticação interna com `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md` antes de criar endpoints protegidos.
- Nesta fase experimental, a API publica fica exposta pelo dominio tecnico do GeoServer em `https://geoserver.amambai.ms.gov.br/api/`.
- O front-end oficial em `https://geoportal.amambai.ms.gov.br` acessa a API por CORS restrito e validado.
- Expor a API tambem em `https://geoportal.amambai.ms.gov.br/api/` fica como evolucao futura de infraestrutura.
- A mensagem pública de sucesso em produção deve ser ajustada para não referir `ambiente de teste`.

## 2. Separacao de schemas

- `plano`: dados tecnicos/editaveis do SIG.
- `web_map`: dados publicados para GeoServer/Geoportal.
- `mod_iluminacao`: dados operacionais da API de Iluminacao Publica e futuro modulo interno.

A API de Iluminacao deve gravar e consultar dados operacionais apenas em `mod_iluminacao`.

A API nao deve gravar em:

- `plano`;
- `web_map`.

## 3. Ambientes

### 3.1 Reforço da Etapa 0 no login interno

O primeiro reforço da Etapa 0 do login interno foi implementado, enviado ao GitHub e validado funcionalmente em produção interna. O reforço inclui:
- resolução segura de IP real com fallback conservador para `request.client.host`;
- aceitação restrita de `X-Forwarded-For` e `X-Real-IP` apenas de peer confiável e com valor único válido;
- rate limit do login interno por IP, por login/origem e por IP+login;
- resposta `429` sanitizada e auditoria preservada com motivos específicos de rate limit;
- uso do mesmo schema de auditoria já existente, sem nova migration.

Validação operacional registrada:
- servidor atualizado por `git pull --ff-only` até `bf7b4df`, em `main`, com `origin/main` alinhado e working tree limpo;
- suíte backend completa: `695 passed`, `3 warnings` conhecidos;
- loader `C:\apps\geoportal-api\scripts\load-producao-interna-env.ps1` confirmou, de forma sanitizada, ambiente de produção, debug desligado, persistência e rate limit ativos, rotas internas ativas, cookie Secure ativo e conexão de banco definida sem exposição do valor;
- `TRUSTED_PROXY_HOSTS` não definida, mantendo o default seguro `127.0.0.1,::1`;
- harness executado primeiro com `-Environment InternaProducao -Validate` e depois com `-Restart -Validate`; serviço `GeoportalAPIInternaProducao`, porta `8003`, health e version OK, `/auth/me` com `401` sem sessão;
- login normal de `admin.producao`, `/auth/me` autenticado e logout confirmados;
- login fictício de probe retornou `401,401,401,401,401,429`, confirmando o contrato sanitizado.

Inventário somente leitura do proxy ativo: `Apache2.4`, `PEMHTTPD-x64` e `Tomcat9` estavam em execução. Embora o serviço `Apache2.4` aponte para um binário em diretório próprio, `httpd -S` confirmou `ServerRoot C:/Apache24` e o vhost em `C:/Apache24/conf/extra/httpd-ssl.conf:121`. O proxy interno ativo foi confirmado nas linhas 162-163 como `ProxyPass /api/internal/ http://127.0.0.1:8003/api/internal/` e respectivo `ProxyPassReverse`. Foram encontrados `X-Forwarded-Proto`, `X-Forwarded-Port` e `RequestHeader unset Proxy early`, mas não foram encontrados `X-Forwarded-For`, `X-Real-IP`, `ProxyAddHeaders`, `RemoteIPHeader` ou `RemoteIPTrustedProxy`. Portanto, o rate limit está publicado e funcional, porém a identificação de IP real individual por cliente não está validada e depende de hardening futuro do Apache/proxy.

### Homologacao

- Usar banco de homologacao.
- Usar schema `mod_iluminacao`.
- Validar deploy da API no servidor.
- Validar persistencia, consulta publica por protocolo, bloqueio `409 Conflict`, rate limit e rollback.

Registro de implantacao: a API foi implantada no servidor PostgreSQL/PostGIS em homologacao como servico Windows controlado. O servico de homologacao foi iniciado com sucesso e escuta internamente em `127.0.0.1:8000`. A exposicao controlada de `/api/` ocorre via Apache HTTPS. A configuracao permanece com `APP_ENV=homologacao` e `PERSIST_SOLICITACOES=false`.

Validacoes realizadas no servidor de homologacao:

- testes automatizados executados com sucesso;
- `/api/health` retornou `200 OK`;
- `/api/public/iluminacao/health` retornou `200 OK`;
- `/api/version` retornou ambiente de homologacao;
- script de solicitacao simulada passou;
- script de consulta inexistente retornou `404` seguro;
- API conectou ao banco de homologacao com usuario restrito;
- backup do arquivo SSL ativo do Apache foi feito antes da alteracao;
- Apache validou sintaxe com `Syntax OK`;
- proxy reverso `/api/` foi configurado para encaminhar ao servico local da API;
- Apache foi reiniciado com sucesso;
- servicos Apache e API permaneceram em execucao;
- `GET /api/health` via HTTPS retornou status ok;
- `GET /api/public/iluminacao/health` via HTTPS retornou status ok;
- `GET /api/version` via HTTPS retornou ambiente de homologacao;
- `POST /api/public/iluminacao/solicitacoes` via HTTPS funcionou com `PERSIST_SOLICITACOES=false`;
- `POST /api/public/iluminacao/consulta` via HTTPS retornou `404` seguro para protocolo inexistente;
- GeoServer continuou acessivel;
- Geoportal publico continuou abrindo e consumindo camadas do GeoServer;
- CORS foi validado para a origem oficial do Geoportal;
- antes do ajuste, origem nao permitida retornava `400 Disallowed CORS origin`;
- `ALLOWED_ORIGINS` real foi ajustado fora do Git e o servico de homologacao foi reiniciado;
- apos o ajuste, a origem oficial passou a ser permitida;
- a investigacao mostrou que os dominios do Geoportal e do GeoServer usam infraestruturas distintas, sem registrar IPs reais;
- a API experimental seguira temporariamente em `https://geoserver.amambai.ms.gov.br/api/`;
- `https://geoportal.amambai.ms.gov.br/api/` fica como opcao futura, dependente de proxy no servidor do front-end ou revisao de DNS/VirtualHost;
- o front-end publicado do Geoportal foi testado com o botao experimental da API habilitado apenas em build controlado;
- a chamada HTTPS para a API no dominio tecnico do GeoServer funcionou com CORS restrito para a origem oficial;
- o envio simulado retornou sucesso no modal do Geoportal;
- com `PERSIST_SOLICITACOES=false`, a API nao gravou novo registro real;
- a conferencia posterior no banco confirmou ausencia de novo registro real;
- `PERSIST_SOLICITACOES` foi ativado temporariamente em homologacao fora do Git para validacao completa;
- o servico de homologacao foi reiniciado e o healthcheck permaneceu ok;
- o front-end publicado enviou solicitacao real via HTTPS para a API;
- a API gravou registros no banco de homologacao;
- a consulta publica por protocolo funcionou sobre os registros de homologacao;
- o bloqueio `409 Conflict` para duplicidade ativa por poste foi validado com mensagem amigavel;
- o rate limit foi acionado durante testes intensivos, validando protecao contra excesso de requisicoes;
- a conferencia no banco confirmou os registros criados em homologacao;
- o usuario restrito da API nao conseguiu executar `DELETE`, confirmando permissao minima;
- a limpeza dos registros de teste exigiu usuario administrativo do banco;
- `PERSIST_SOLICITACOES` foi restaurado para `false` apos a validacao;
- as flags usadas no build de teste foram restauradas para `false` apos a validacao e nao devem ser commitadas como `true`;
- atencao operacional: a chave correta de configuracao do endpoint e `apiUrl`; grafia incorreta pode gerar chamada para `/undefined`;
- origens devem permanecer restritas, sem wildcard;
- `PERSIST_SOLICITACOES=false` permanece como padrao seguro nesta fase;
- a ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual.

### Producao

- Usar banco ativo somente apos validacao controlada.
- Usar schema `mod_iluminacao`.
- Ativar somente apos backup, migrations, usuario restrito e validacao controlada.
- Manter Google Forms como fallback ate estabilidade comprovada.

Registro de preparacao da producao local:

- backup manual do banco ativo foi feito antes da criacao do schema `mod_iluminacao`;
- backup foi validado como legivel;
- banco ativo recebeu o schema `mod_iluminacao`;
- tabela `mod_iluminacao.solicitacoes` foi criada;
- sequences `mod_iluminacao.solicitacoes_id_seq` e `mod_iluminacao.solicitacoes_protocolo_seq` foram criadas;
- usuario restrito de producao foi criado e teve login validado, sem registrar senha ou string de conexao;
- permissoes minimas foram validadas: `CONNECT`, `USAGE` no schema, `SELECT`/`INSERT` na tabela e `USAGE`/`SELECT` nas sequences;
- permissoes de `UPDATE` e `DELETE` foram negadas ao usuario restrito;
- arquivo real de ambiente de producao foi criado fora do Git;
- producao permanece com `PERSIST_SOLICITACOES=false`;
- script de execucao de producao foi criado sem registrar caminhos sensiveis;
- servico Windows `GeoportalAPIProducao` foi criado e iniciado;
- homologacao permanece em `127.0.0.1:8000`;
- producao local roda em `127.0.0.1:8001`;
- healthcheck de producao passou;
- `POST` simulado em producao retornou sucesso e nao gravou no banco;
- banco ativo permaneceu sem solicitacoes reais criadas pela API;
- em validacao de pre-producao, backup do arquivo ativo do Apache foi feito antes da alteracao;
- Apache validou sintaxe com `Syntax OK` e foi reiniciado com sucesso;
- Apache publico `/api/` passou a apontar para o servico de producao local `GeoportalAPIProducao` em `127.0.0.1:8001`;
- `GeoportalAPIProducao` permaneceu em execucao;
- `/api/version` via HTTPS retornou ambiente `producao`;
- `/api/public/iluminacao/health` via HTTPS retornou ok;
- `POST` via HTTPS e pelo front-end publicado retornou protocolo simulado com sucesso;
- com `PERSIST_SOLICITACOES=false`, o banco ativo continuou sem solicitacoes reais criadas pela API;
- CORS restrito foi revalidado: origem oficial permitida e origem invalida bloqueada com `400`;
- Geoportal publico abriu normalmente;
- camadas do GeoServer continuaram funcionando;
- ativacao real controlada em producao foi realizada com `PERSIST_SOLICITACOES=true` ativado fora do Git;
- `GeoportalAPIProducao` foi reiniciado apos a alteracao;
- front-end publicado enviou solicitacao real por poste;
- front-end publicado enviou solicitacao real por ponto manual;
- consulta publica dos protocolos gerados funcionou;
- bloqueio de duplicidade ativa por poste funcionou com mensagem amigavel;
- botao Tracar rota continuou funcionando;
- botao de solicitacao via Google Forms continuou funcionando;
- Geoportal publico, GeoServer e camadas continuaram funcionando apos a ativacao real;
- antes da aplicacao das migrations internas, o banco ativo possuia apenas `mod_iluminacao.solicitacoes` entre as tabelas internas;
- backup manual do banco ativo foi criado e validado como legivel antes da aplicacao das migrations internas `0004` e `0005`;
- migrations internas `0004` e `0005` foram aplicadas no banco ativo;
- tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas;
- indices das duas tabelas internas foram validados;
- FKs restritivas para `mod_iluminacao.solicitacoes(id)` foram validadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`;
- API publica permaneceu saudavel apos a aplicacao das migrations internas;
- `/api/version` continuou retornando ambiente `producao`;
- tabelas internas permaneceram vazias apos a criacao;
- nenhum endpoint interno e nenhuma tela interna foram criados nesta etapa;
- migration `0006_create_mod_auth_schema.sql` aplicada em homologacao e producao apos backup manual validado;
- schema transversal `mod_auth` criado com comentario validado;
- nenhuma tabela foi criada em `mod_auth` nesta etapa;
- migration `0007_create_mod_auth_usuarios.sql` aplicada em homologacao e producao apos backup manual validado;
- tabela `mod_auth.usuarios` criada com indices validados e vazia apos a criacao em producao;
- nenhum usuario real, seed, endpoint ou login funcional foi criado;
- migration `0008_create_mod_auth_perfis_permissoes.sql` aplicada em homologacao e producao apos backup manual validado;
- tabelas `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes` criadas com indices e FKs restritivas validadas;
- todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao;
- nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado;
- migration `0009_create_mod_auth_sessoes_login_auditoria.sql` aplicada em homologacao e producao apos backup manual validado;
- tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` criadas com indices e FKs restritivas validadas;
- todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao;
- nenhum usuario, sessao, token, auditoria, seed, endpoint ou login funcional foi criado;
- base estrutural inicial do schema `mod_auth` concluida;
- revisao defensiva da API publica atual documentada em `docs/PUBLIC-API-SECURITY-REVIEW.md`;
- proxima etapa: seguir `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md` para planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao;
- proxima evolucao recomendada: modulo interno para triagem, acompanhamento e encerramento das solicitacoes;
- Google Forms permanece como fallback.

## 4. Usuarios e permissoes de banco

A API nunca deve usar superuser.

A API deve usar usuario restrito, com permissoes minimas:

- `CONNECT` no banco;
- `USAGE` no schema `mod_iluminacao`;
- `INSERT` em `mod_iluminacao.solicitacoes`;
- `SELECT` minimo para consulta publica por protocolo e verificacao de duplicidade ativa;
- `USAGE`/`SELECT` na sequence de protocolo;
- sem `DELETE`;
- sem `CREATE`;
- sem acesso amplo a `plano`;
- sem acesso amplo a `web_map`.

## 5. Etapas futuras de deploy

1. Preparar pasta do backend no servidor.
2. Criar ambiente Python e ambiente virtual.
3. Instalar dependencias.
4. Configurar `.env` real fora do Git.
5. Testar a API localmente no servidor.
6. Transformar a API em servico Windows controlado.
7. Testar healthcheck.
8. Testar endpoints com persistencia desligada.
9. Testar homologacao com persistencia ligada.
10. Manter CORS restrito a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git.
11. Manter a API experimental em `https://geoserver.amambai.ms.gov.br/api/` ate decisao de infraestrutura.
12. Testar front-end experimental em build controlado, com flags temporarias e restauradas para `false` apos o teste.
13. Preparar producao local com `PERSIST_SOLICITACOES=false` e servico separado.
14. Validar pre-producao com Apache publico `/api/` apontando para `GeoportalAPIProducao`, ainda sem gravacao real.
15. Registrar ativacao real controlada com `PERSIST_SOLICITACOES=true` fora do Git, mantendo Google Forms como fallback.
16. Aplicar e validar migrations internas de historico e observacoes no banco ativo apos backup. Status: concluido para `0004` e `0005`.
17. Aplicar e validar a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` em homologacao e producao apos backup. Status: concluido.
18. Revisar defensivamente a API publica atual antes dos endpoints internos, conforme `docs/PUBLIC-API-SECURITY-REVIEW.md`.
19. Planejar e implementar autenticacao backend com testes seguindo `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`, sem criar acesso interno publico sem autenticacao.
20. Desenhar endpoints internos protegidos para status, historico e observacoes. Validar primeiro a leitura de historico e observacoes internas apenas como consultas GET no frontend interno, sem exigir `X-Geoportal-Internal-Request` para essas chamadas de leitura, e deixar mutacoes como `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` para fase separada com permissao `iluminacao.solicitacoes.comentar`, header `X-Geoportal-Internal-Request: 1`, payload `observacao` validado e auditoria/historico na mesma transacao. A proxima evolucao recomendada e inventariar o contrato da alteracao normal de status antes de qualquer `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`.
21. Evoluir para modulo interno de triagem, acompanhamento e encerramento das solicitacoes, seguindo `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

## 6. Evolucao futura de dominio

A opcao `https://geoportal.amambai.ms.gov.br/api/` reduziria a dependencia de CORS por manter front-end e API sob o mesmo dominio publico. Essa opcao nao sera adotada nesta fase porque depende de ajuste de infraestrutura fora da API, como proxy no servidor do front-end ou revisao de DNS/VirtualHost.

Enquanto essa evolucao nao for planejada e validada, o arranjo aceito e:

- front-end oficial: `https://geoportal.amambai.ms.gov.br`;
- API publica experimental: `https://geoserver.amambai.ms.gov.br/api/`;
- CORS restrito permitindo apenas origens oficiais necessarias;
- sem wildcard;
- Google Forms mantido como fallback.

## 6.1. Inventario Apache para proxy interno futuro

Inventario operacional registrado para planejamento futuro, sem alteracao aplicada nesta etapa:

- servico que atende `80` e `443`: `Apache2.4`;
- PID observado nas portas publicas: `10772`;
- executavel do Apache publico ativo: `C:\Users\Anderson\OneDrive\Documentos\bd_web_gis\apache\httpd-2.4.63-250207-win64-VS17\Apache24\bin\httpd.exe`;
- `httpd -S` do Apache ativo indicou `ServerRoot: "C:/Apache24"` e `VirtualHost *:443 geoserver.amambai.ms.gov.br`;
- arquivo critico do VirtualHost ativo: `C:\Apache24\conf\extra\httpd-ssl.conf`;
- modulos necessarios carregados: `headers_module`, `proxy_module`, `proxy_http_module` e `ssl_module`;
- sintaxe atual retornou `Syntax OK`;
- servico adicional `PEMHTTPD-x64` tambem esta rodando, mas nao escuta `80` ou `443`.

O arquivo `C:\Apache24\conf\extra\httpd-ssl.conf` ja possui:

```apache
ProxyPass /geoserver http://localhost:5436/geoserver
ProxyPassReverse /geoserver http://localhost:5436/geoserver
ProxyPass /api/ http://127.0.0.1:8001/api/
ProxyPassReverse /api/ http://127.0.0.1:8001/api/
```

Para uma futura validacao da shell interna, a regra conceitual abaixo deve ser posicionada antes da regra generica `/api/`:

```apache
ProxyPass        /api/internal/ http://127.0.0.1:8002/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8002/api/internal/
```

Motivo: `/api/` e mais generico e pode capturar `/api/internal/...` se vier antes, encaminhando a requisicao ao backend errado em `127.0.0.1:8001`.

Roteiro manual futuro para proxy interno controlado:

1. Confirmar working tree limpo.
2. Validar `GeoportalAPIInternaHomologacao` com `.\scripts\deploy\backend-restart-validate-service.ps1 -Environment InternaHomologacao -Restart -Validate`.
3. Fazer backup de `C:\Apache24\conf\extra\httpd-ssl.conf`.
4. Registrar hash, tamanho e data do arquivo antes da alteracao.
5. Inserir bloco `/api/internal/` antes de `/api/`.
6. Rodar sintaxe com `C:\Users\Anderson\OneDrive\Documentos\bd_web_gis\apache\httpd-2.4.63-250207-win64-VS17\Apache24\bin\httpd.exe -t`.
7. Se a sintaxe falhar, restaurar backup e nao reiniciar Apache.
8. Se a sintaxe passar, planejar reload/restart controlado do servico `Apache2.4`.
9. Validar Geoportal publico, mapa, camadas, busca, GeoServer e API publica.
10. Validar que `GET /api/internal/auth/me` retorna `401` sem sessao.
11. Confirmar que `8002` continua sem exposicao direta na rede.
12. Confirmar que nao ha login, `POST`, `PATCH` ou listagem nessa validacao.
13. Documentar resultado.
14. Manter rollback pronto: restaurar backup, validar sintaxe, reiniciar/recarregar Apache e validar publico.

O servico `PEMHTTPD-x64` deve ser tratado como duplicidade operacional a investigar. Nao parar nem desabilitar antes de inventariar portas, logs, dependencias e finalidade. Se nao houver dependencia, qualquer mudanca de `StartMode` deve ocorrer somente em etapa propria, com backup, janela de manutencao e rollback.

## 6.2. Inventário de Serviços Apache Auxiliares

Descoberta em validação operacional: servidor de homologação executa um segundo serviço Apache denominado `PEMHTTPD-x64`, que não atende as portas públicas (`80` / `443`) e portanto não interfere com o Geoportal público. Este serviço foi inventariado para registro e futura avaliação de segurança operacional.

**Nenhuma alteração operacional foi realizada nesta etapa. O serviço permanece no seu estado atual (Running, Auto) e não deve ser parado, desabilitado ou modificado sem planejamento e validação separada.**

Inventário operacional do serviço `PEMHTTPD-x64`:

**Serviço:**
- Nome: `PEMHTTPD-x64`
- Estado: `Running`
- StartMode: `Auto`
- PID: `3772`
- Executável: `C:\Users\Anderson\OneDrive\Documentos\postgres_pref\apache\bin\httpd.exe`

**Porta e Conectividade:**
- Escuta: `TCP 0.0.0.0:5435` (todas as interfaces, porta `5435`)
- Acessível via localhost: `http://127.0.0.1:5435/` retorna `HTTP 200 OK`
- Acessível via rede interna: `http://10.0.0.109:5435/` (confirmado do PC `10.0.0.215`) retorna `HTTP 200 OK`
- Conteúdo HTTP: página padrão da EnterpriseDB com texto "Server is up and running."

**Configuração:**
- `ServerRoot`: `C:/Users/Anderson/OneDrive/Documentos/postgres_pref/apache`
- `DocumentRoot`: `C:/Users/Anderson/OneDrive/Documentos/postgres_pref/apache/www`
- `ServerName`: `localhost:5435`
- `Listen 0.0.0.0:5435` (vinculado a todas as interfaces)
- Sintaxe: `httpd -t` retornou `Syntax OK`

**Logs:**
- Diretório: `C:\Users\Anderson\OneDrive\Documentos\postgres_pref\apache\logs`
- Arquivos observados: `access.log`, `error.log`, `httpd.pid`, `install.log`

**Análise e Contexto:**

1. O `PEMHTTPD-x64` não é parte do Geoportal público (que usa `Apache2.4` nas portas `80`/`443`).
2. O executável e `DocumentRoot` residem em `postgres_pref`, sugerindo origem em ambiente EnterpriseDB/PostgreSQL local.
3. Servidor está saudável (responde HTTP 200, sintaxe válida, logs presentes).
4. A porta `5435` está exposta para toda a rede interna (`0.0.0.0:5435`), permitindo acesso remoto.

**Recomendações Futuras (não aplicadas nesta etapa):**

Estas ações devem ser executadas somente em planejamento operacional separado, com backup, rollback e validação:

1. **Investigação de dependências:** Confirmar se o `PEMHTTPD-x64` é necessário para EnterpriseDB, PEM (PostgreSQL Enterprise Manager) ou outras ferramentas críticas do servidor.
   - Consultores: verificar logs em `C:\Users\Anderson\OneDrive\Documentos\postgres_pref\apache\logs\` para padrões de uso.
   - Comunicar com administrador PostgreSQL/EnterpriseDB antes de qualquer mudança.

2. **Avaliação de acesso remoto:** Se ninguém acessa `http://10.0.0.109:5435/` pela rede interna, considerar restrição futura.
   - Opção 1: Modificar `Listen 0.0.0.0:5435` para `Listen 127.0.0.1:5435` (apenas localhost).
   - Opção 2: Implementar firewall (Windows Firewall ou rede) bloqueando porta `5435` de acesso remoto.
   - Qualquer alteração exige validação posterior do PostgreSQL/EnterpriseDB.

3. **Revisão de StartMode:** Se comprovadamente não utilizado, considerar alterar de `Auto` para `Manual` em etapa futura (jamais `Disabled` sem confirmação).
   - Janela de manutenção deve incluir reboot de validação e verificação de logs.

4. **Documentação contínua:** Registrar qualquer achado de acesso remoto a `5435` em logs operacionais para decisão futura.

**Conclusão para esta etapa:** Serviço inventariado e registrado. Geoportal público permanece isolado e não é impactado pelo `PEMHTTPD-x64`. Nenhuma decisão operacional foi tomada.

## 6.3. Execução: Proxy Interno Controlado `/api/internal/` – Etapa Concluída

Nota de estado: esta secao registra a primeira etapa historica do proxy interno, quando `/api/internal/` apontava para a homologacao interna em `127.0.0.1:8002`. O estado operacional atual, validado em 2026-06-12, esta registrado na secao "Marco operacional da producao interna de Iluminacao - 2026-06-12": o Apache HTTPS `/api/internal/` aponta para `127.0.0.1:8003`, e `8002` permanece como homologacao interna/rollback temporario.

O roteiro manual para proxy interno controlado foi executado com sucesso. Este documento registra a implementação operacional no Apache público ativo, com backup, validação e testes de conformidade.

**Objetivo realizado naquela etapa:**
Tornar o endpoint interno `GET /api/internal/auth/me` acessível via proxy HTTPS controlado (`https://geoserver.amambai.ms.gov.br/api/internal/`), sem expor diretamente a porta `8002` na rede, mantendo a API interna de homologacao restrita a `127.0.0.1:8002` no servidor.

**Arquivo alterado:**
- `C:\Apache24\conf\extra\httpd-ssl.conf` (servidor de homologação)

**Backup criado:**
- Caminho: `C:\apps\geoportal-api\backups\apache-proxy-interno-20260608_080438\httpd-ssl.conf.bak`
- Hash verificado: backup idêntico ao original antes da alteração
- Disponível para rollback caso necessário

**Bloco aplicado:**
```apache
# Proxy para Geoportal API interna - Homologacao controlada
ProxyPass        /api/internal/ http://127.0.0.1:8002/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8002/api/internal/
```

**Posicionamento no arquivo:**
O bloco foi inserido **antes** da regra genérica existente `/api/`, garantindo que `/api/internal/` seja capturado corretamente:
```apache
# [Novo bloco acima]
ProxyPass        /api/internal/ http://127.0.0.1:8002/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8002/api/internal/

# [Regra genérica abaixo - já existente]
# Proxy para Geoportal API - Pre-producao
ProxyPass        /api/ http://127.0.0.1:8001/api/
ProxyPassReverse /api/ http://127.0.0.1:8001/api/
```

**Validações Pré-Alteração:**

1. ✅ Backend interno `GeoportalAPIInternaHomologacao` (porta 8002) validado e respondendo
2. ✅ Porta `8002` confirmada restrita a `127.0.0.1` (sem exposição de rede)
3. ✅ Backup do arquivo crítico criado e verificado
4. ✅ Sintaxe Apache: `Syntax OK`
5. ✅ Serviço `Apache2.4` ativo (PID `10772`) atendendo portas `80` e `443`
6. ✅ GeoServer público: `HTTP 200`
7. ✅ API pública: `HTTP 200 OK`
8. ✅ Arquivo `httpd-ssl.conf` antes: hash e linhas de proxy conferidos

**Validações Pós-Alteração:**

1. ✅ Arquivo proposto criado e conferido (ordem `/api/internal/` antes de `/api/`)
2. ✅ Bloco proxy aplicado em `C:\Apache24\conf\extra\httpd-ssl.conf`
3. ✅ Sintaxe Apache: `Syntax OK` (sem erros ou avisos)
4. ✅ Serviço `Apache2.4` reiniciado controladamente
5. ✅ Após restart: `Apache2.4` voltou como `Running`
6. ✅ Novo PID observado: `25588` (diferentes do PID anterior)
7. ✅ Portas públicas ainda ativas: `80 LISTENING`, `443 LISTENING`
8. ✅ GeoServer público: `HTTP 200` (sem impacto)
9. ✅ API pública: `HTTP 200 OK` com resposta esperada:
   ```json
   {
     "service": "geoportal-api",
     "version": "0.1.0",
     "environment": "producao"
   }
   ```
10. ✅ Proxy interno via HTTPS:
    - URL testada: `https://geoserver.amambai.ms.gov.br/api/internal/auth/me`
    - Resultado: `HTTP 401 Unauthorized` (comportamento correto sem sessão)
    - Body: vazio (esperado para 401)
11. ✅ Porta `8002` ainda restrita a localhost:
    - `127.0.0.1:8002 LISTENING` ✅
    - Não apareceu `0.0.0.0:8002` ❌
    - Não apareceu `10.0.0.109:8002` ❌

**Interpretação do Resultado `401 Unauthorized`:**

O retorno `401` ao tentar acessar `/api/internal/auth/me` sem sessão é o comportamento esperado e correto:
- Confirma que a rota interna está acessível via proxy HTTPS
- Confirma que o backend interno está aplicando autenticação (exigindo sessão)
- Confirma que nenhuma sessão falsa ou abertura de acesso foi concedida
- Indica que o backend está seguro e operacional

**Conformidade Arquitetural:**

✅ A decisão de não expor `8002` diretamente foi preservada:
- A API interna só é acessível via proxy HTTPS controlado no Apache
- Acesso direto a `127.0.0.1:8002` continua restrito ao servidor local
- Usuários remotos não podem contornar o proxy HTTPS

✅ Separação funcional mantida:
- API pública `/api/` continua apontando para `127.0.0.1:8001`
- API interna `/api/internal/` naquela etapa passou a apontar para `127.0.0.1:8002` via proxy; desde 2026-06-12, o estado atual de producao interna aponta para `127.0.0.1:8003`
- Ambas protegidas por HTTPS e com Geoportal público saudável

**Escopo Completado:**

- ✅ Proxy interno configurado
- ✅ Sintaxe validada
- ✅ Serviço reiniciado controladamente
- ✅ Público + GeoServer testados (sem regressão)
- ✅ Endpoint interno acessível (401 esperado)
- ✅ Porta 8002 continua não-exposta

**Estado da etapa de Dashboard geral interno (commit `e5a488e`):**

- ✅ O frontend interno `/interno/` passou a exibir um Dashboard geral implementado para usuarios com `iluminacao.dashboard.ler`.
- ✅ A tela consome os endpoints de modulo `GET /api/internal/iluminacao/dashboard/resumo`, `GET /api/internal/iluminacao/dashboard/ranking` e `GET /api/internal/iluminacao/dashboard/series?granularidade=semana`.
- ✅ O mapa gerencial v1 usa a listagem operacional autorizada ja carregada em memoria, com pontos/heatmap e limites de v1.
- ✅ A publicação manual foi feita por build Vite, empacotamento em `.rar` e extracao em `C:\apps\geoportal_interno`.
- ✅ Nao houve alteracao de backend funcional, banco, SQL, migration, Apache, NSSM, `.env`, dependencias, restart de backend ou deploy automatizado nesta etapa documental.

**Próximos Passos Recomendados:**

1. **Validar shell interna contra proxy real:**
   - Frontend (shell `/interno/`) deve chamar `GET /api/internal/auth/me`
   - Deve obter `401 Unauthorized` sem cookies/sessão
   - Redirecionar para tela de login (etapa futura)

2. **Documentar validação visual:**
   - Network tab do DevTools deve mostrar HTTPS para `/api/internal/auth/me`
   - Status `401` será confirmado na aba Network

3. **Planejar login real (etapa separada):**
   - Criar endpoint `POST /api/internal/auth/login`
   - Validar com credenciais administrativas em homologação
   - Testar cookie `HttpOnly` e revogação

4. **Somente após login autenticado:**
   - Testar `GET /api/internal/auth/me` retornando `200` com usuário e permissões
   - Validar listagem `GET /api/internal/iluminacao/solicitacoes`
   - Manter POST/PATCH para etapa específica de mutações

5. **Registrar em `/docs/` as URLs finais dos endpoints internos:**
   - `https://geoserver.amambai.ms.gov.br/api/internal/auth/me`
   - `https://geoserver.amambai.ms.gov.br/api/internal/auth/login`
   - `https://geoserver.amambai.ms.gov.br/api/internal/iluminacao/solicitacoes`

**Conclusão para esta etapa:** Proxy interno controlado implementado com sucesso. Geoportal público, GeoServer e API pública continuam operacionais. Acesso interno protegido por HTTPS sem exposição de porta 8002. Rollback disponível se necessário. Pronto para integração com shell interna de homologação.

## 6.4. Proxy Vite Somente para Desenvolvimento Local

Para validar a shell local `/interno/` com `npm run dev`, o Vite pode encaminhar a rota relativa `/api/internal/` para `https://geoserver.amambai.ms.gov.br/api/internal/`. Essa configuracao e exclusiva do servidor de desenvolvimento do Vite e nao altera o build final, Apache real, NSSM, firewall, bind ou producao.

Contrato esperado da validacao local:

- `/interno/` chama somente `GET /api/internal/auth/me`;
- Vite encaminha a requisicao para `https://geoserver.amambai.ms.gov.br/api/internal/auth/me`;
- sem sessao, o retorno esperado e `401 Unauthorized`;
- nao deve haver chamada para `/api/internal/auth/login`;
- nao deve haver chamada para `/api/internal/iluminacao/solicitacoes`;
- nao deve haver `POST` ou `PATCH`;
- a shell deve continuar sem armazenar token em `localStorage` ou `sessionStorage`.

## 6.5. Validacao Manual Autenticada via Proxy HTTPS

Foi realizada validacao manual de login/sessao interna contra o proxy HTTPS real, sem expor a porta `8002` diretamente:

- `POST https://geoserver.amambai.ms.gov.br/api/internal/auth/login` retornou `LOGIN_STATUS=200`;
- na mesma sessao PowerShell, `GET https://geoserver.amambai.ms.gov.br/api/internal/auth/me` retornou `ME_STATUS=200`;
- resultado sanitizado do `/me`: `AUTHENTICATED=True`, `USUARIO_ID=7`, `PERMISSOES_COUNT=15`, `TEM_ILUMINACAO_LER=True`;
- a validacao confirma que o proxy HTTPS encaminha corretamente o login interno e o `/me`, que a sessao/cookie foi aceito entre chamadas e que o usuario validado possui a permissao base para o modulo Iluminacao Publica;
- a porta `8002` permanece restrita ao loopback do servidor e nao deve ser aberta diretamente na rede;
- a documentacao nao registra senha, token, cookie real, hash, `session_secret` ou `DATABASE_URL`;
- essa validacao nao implementa login visual, nao chama listagem de solicitacoes e nao executa `POST`/`PATCH` pela shell.

Proxima sequencia recomendada: implementar login visual minimo dentro de `/interno/`, validar que a shell ignora o token retornado no corpo do login e depende apenas do cookie HttpOnly, confirmar `/me` retornando `200` na shell e somente depois integrar a listagem somente leitura de Iluminacao. `POST` observacao e `PATCH` status continuam para etapa posterior separada.

## 6.6. Publicacao estatica da area interna no dominio `geoserver`

Esta secao registra a forma operacional adotada para servir a shell interna `/interno/` no mesmo dominio onde ja existe o proxy HTTPS da API interna. O registro e documental; nenhuma alteracao em Apache, producao, backend, banco, NSSM, firewall ou `.env` e executada por este documento.

### Separacao de dominios

- Geoportal publico principal: `https://geoportal.amambai.ms.gov.br/`.
- Area interna e API interna: `https://geoserver.amambai.ms.gov.br/`.
- Shell interna: `https://geoserver.amambai.ms.gov.br/interno/`.
- Proxy interno de producao: `/api/internal/` -> `http://127.0.0.1:8003/api/internal/`.
- Runtime interno de homologacao preservado: `http://127.0.0.1:8002/api/internal/`.
- Proxy GeoServer existente: `/geoserver` continua encaminhando ao Tomcat/GeoServer.

A area interna deve ser servida pelo Apache do dominio `geoserver.amambai.ms.gov.br`, e nao apenas pela hospedagem/FTP do dominio `geoportal.amambai.ms.gov.br`. O motivo e manter frontend interno e API interna no mesmo dominio, reduzindo complexidade de CORS e evitando fluxo de cookie cross-site para a sessao interna.

O link publico `Area interna` pode apontar para `https://geoserver.amambai.ms.gov.br/interno/`, mas a publicacao do front-end publico no dominio `geoportal` nao e suficiente para disponibilizar a shell interna se os arquivos estaticos de `/interno/` nao estiverem publicados no servidor `geoserver`.

### Estrutura do build Vite

O build Vite gera a estrutura:

```text
dist/
  assets/
  interno/
  index.html
```

Para o servidor `geoserver`, a estrutura operacional registrada e:

```text
C:/apps/geoportal_interno/
  assets/
  interno/
```

Arquivo principal da shell interna:

```text
C:/apps/geoportal_interno/interno/index.html
```

Assets usados pelo build Vite:

```text
C:/apps/geoportal_interno/assets/
```

Publicacao manual esperada no servidor `geoserver`:

- copiar o conteudo de `dist/interno/` para `C:/apps/geoportal_interno/interno/`;
- copiar o conteudo de `dist/assets/` para `C:/apps/geoportal_interno/assets/`;
- manter `/api/internal/` como proxy de backend, nao como arquivos estaticos.

### Bloco Apache registrado

Bloco aplicado no `<VirtualHost *:443>` de `geoserver.amambai.ms.gov.br` para servir o frontend interno estatico:

```apache
# Geoportal Interno - frontend estatico
RedirectMatch 301 ^/interno$ /interno/

Alias /interno/ "C:/apps/geoportal_interno/interno/"

<Directory "C:/apps/geoportal_interno/interno/">
    Options -Indexes
    AllowOverride None
    Require all granted
    DirectoryIndex index.html
</Directory>

# Assets do build Vite usados pela shell interna
Alias /assets/ "C:/apps/geoportal_interno/assets/"

<Directory "C:/apps/geoportal_interno/assets/">
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>
```

Por clareza operacional, manter esse bloco antes das regras de proxy no VirtualHost:

- `/interno/` e `/assets/` sao arquivos estaticos;
- `/api/internal/` continua proxy para a API interna de producao em `127.0.0.1:8003`;
- `/api/` continua proxy da API publica/producao em `127.0.0.1:8001`;
- `/geoserver` continua proxy do GeoServer/Tomcat.

### Alerta sobre `Alias /assets/`

O `Alias /assets/` e global no dominio `geoserver.amambai.ms.gov.br`. Ele funciona no arranjo atual porque o build Vite referencia assets como `/assets/...` e nao ha conflito conhecido nesse dominio.

Se futuramente houver conflito com outros assets servidos pelo `geoserver`, a evolucao recomendada e ajustar o build/publicacao para uma base propria da area interna, por exemplo `/interno/assets/`, em etapa separada. Essa mudanca exigiria revisao do build Vite, publicacao estatica e validacao controlada, sem alterar o proxy `/api/internal/`.

### Seguranca e validacoes

O frontend interno e estatico. A seguranca real nao esta no HTML/JS, e sim no backend protegido por `/api/internal/`.

Validacoes esperadas:

- `https://geoserver.amambai.ms.gov.br/interno/` abre a shell interna;
- sem sessao, `GET /api/internal/auth/me` retorna `401`;
- com sessao valida, `GET /api/internal/auth/me` retorna `200`;
- login interno funciona usando o mesmo dominio do proxy `/api/internal/`;
- listagem de solicitacoes carrega apenas apos sessao e permissao;
- a pagina `/interno/` abrir publicamente nao expoe dados internos enquanto a API permanecer protegida;
- nenhum segredo, senha, token, cookie real, hash, `session_secret` ou `DATABASE_URL` deve ser registrado na documentacao.

Marco atual do MVP interno: a shell interna ja possui logout visual. O botao `Sair` chama `POST /api/internal/auth/logout` no mesmo dominio, com `credentials: "include"` e header mutavel `X-Geoportal-Internal-Request: 1`. Em sucesso, a sessao e encerrada no backend, o cookie HttpOnly e limpo pela resposta do backend e o estado em memoria da shell e descartado. A shell nao manipula cookie diretamente, nao armazena token em `localStorage` ou `sessionStorage` e nao registra cookie/token/senha em console.

Para testar estado sem sessao, usar preferencialmente uma das alternativas abaixo:

- botao `Sair` da shell interna;
- aba anonima;
- outro navegador;
- remocao dos cookies do dominio `geoserver.amambai.ms.gov.br`;
- aguardar expiracao da sessao.

### Marco MVP interno de Iluminacao

O MVP interno/piloto do modulo Iluminacao Publica esta publicado/testado em `https://geoserver.amambai.ms.gov.br/interno/`, usando a API interna no mesmo dominio em `https://geoserver.amambai.ms.gov.br/api/internal/`.

Funcionalidades atuais do MVP:

- login interno;
- verificacao de sessao por `GET /api/internal/auth/me`;
- menu por permissoes retornadas pelo backend;
- listagem de solicitacoes de Iluminacao;
- detalhe da solicitacao;
- coordenadas exibidas no detalhe quando validas;
- botao `Abrir rota no Google Maps`, usando somente latitude/longitude;
- mapa operacional simples no detalhe, com base publica OSM/OpenLayers e marcador do chamado;
- historico sob demanda;
- observacoes internas sob demanda;
- criacao de observacao interna por `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- alteracao normal de status por `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`;
- alteracao de prioridade operacional por `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade`;
- logout por `POST /api/internal/auth/logout`.

Regras de seguranca mantidas:

- a shell interna usa cookie HttpOnly;
- a shell ignora token eventualmente retornado no corpo do login;
- a shell nao armazena token em `localStorage` ou `sessionStorage`;
- sem sessao, `/api/internal/auth/me` deve retornar `401`;
- com sessao valida, `/api/internal/auth/me` deve retornar `200`;
- o backend continua sendo a autoridade real de autorizacao;
- menu e permissoes da interface sao apenas orientacao visual;
- listagem evita dados pessoais e usa campos minimos;
- dados pessoais aparecem somente no detalhe autenticado;
- coordenadas aparecem apenas no detalhe autenticado e sao usadas para rota/mapa sem incluir nome, contato, descricao ou observacao na URL externa;
- o mapa simples nao carrega camadas internas, dados pessoais ou observacoes;
- observacoes sao texto livre operacional e devem ser usadas com cuidado;
- `POST` observacao exige permissao e `X-Geoportal-Internal-Request: 1`;
- `PATCH` status exige permissao e `X-Geoportal-Internal-Request: 1`;
- `PATCH` prioridade exige permissao e `X-Geoportal-Internal-Request: 1`;
- alteracao de status nao altera prioridade e nao cria observacao separada;
- alteracao de prioridade nao altera status, nao altera `finalizado_em` e nao cria observacao separada;
- historico registra eventos das mutacoes;
- logout encerra a sessao e limpa o estado da shell.

### Marco frontend interno com mapa, rota e manutencao - 2026-06-12

O frontend interno foi buildado no PC de desenvolvimento, transferido manualmente para o servidor por pacote `.rar` e extraido na pasta de publicacao interna. Nao registrar caminhos temporarios do pacote; o estado operacional relevante e:

```text
C:\apps\geoportal_interno\interno
C:\apps\geoportal_interno\assets
```

Validacoes no servidor:

- `C:\apps\geoportal_interno\interno\index.html` existe;
- assets `interno-*` foram publicados;
- `https://geoserver.amambai.ms.gov.br/interno/` retornou HTTP 200.

Commits recentes relacionados ao marco:

- `5252e05` Adiciona mapa e rota no modulo interno de iluminacao;
- `0458734` Adiciona perfil de manutencao da iluminacao;
- `35d63f0` Documenta publicacao da API interna de producao;
- `5f92fdd` Implementa filtro ativos na listagem de iluminacao;
- `fcaa782` Ajusta relatorio administrativo de iluminacao;
- `762e911` aJUSTA RELATORIO ADMINISTRATIVO.

Funcionalidades validadas no frontend interno:

- exibicao de coordenadas no detalhe;
- botao `Abrir rota no Google Maps`;
- link seguro baseado apenas em latitude/longitude;
- mapa simples com OSM/OpenLayers e marcador do ponto do chamado;
- modo visual manutencao validado em desktop e mobile;
- listagem de manutencao consumindo `ativos=true` no backend;
- alteracao normal de status disponivel ao usuario de manutencao;
- alteracao de prioridade restrita quando o perfil nao possui `iluminacao.solicitacoes.atualizar_prioridade`;
- historico indisponivel quando o perfil nao possui permissao correspondente;
- observacoes internas sob demanda conforme permissao;
- relatorio administrativo sanitizado com CSV e resumo JSON apenas para perfil administrativo/autorizado.

Usuario/perfil operacional validado:

- perfil: `manutencao-iluminacao`;
- nome: `Manutencao - Iluminacao Publica`;
- usuarios validados: `manutencao.homologacao` e `manutencao.producao`;
- permissoes de `manutencao.producao`: `internal.auth.me`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar` e `iluminacao.solicitacoes.atualizar_status`;
- ausentes: `admin.*` e `iluminacao.solicitacoes.atualizar_prioridade`.

A validacao visual publicada foi feita em `https://geoserver.amambai.ms.gov.br/interno/`, que usa `/api/internal/` apontando para `127.0.0.1:8003`. Portanto, o teste real da URL publicada usou `manutencao.producao`, nao `manutencao.homologacao`.

Validacao sanitizada do usuario operacional de producao:

- login autenticado para `manutencao.producao`;
- `/api/internal/auth/me` retorna `authenticated`, `usuario_id`, `login`, `nome`, `perfis` e `permissoes`;
- permissoes retornadas: `iluminacao.solicitacoes.atualizar_status`, `iluminacao.solicitacoes.comentar`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_observacoes` e `internal.auth.me`;
- logout validado.

O contrato atual de `/api/internal/auth/me` retorna `login`, `nome` e `perfis` sanitizados alem de `authenticated`, `usuario_id` e `permissoes`. A shell interna usa esses campos quando disponiveis e preserva compatibilidade visual com fallback antigo, como `Usuario interno #2`, se uma resposta legada ou parcial nao trouxer identificacao completa.

Seguranca operacional apos bootstrap do perfil: os privilegios temporarios de `INSERT` e `UPDATE` em `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes` foram revogados para `geoportal_api_interna_prod`. Permanecem apenas os privilegios necessarios para login, sessao, auditoria de login, `/me` e autorizacao. Nao registrar senha, hash, token, token_hash, cookie, `session_secret` ou `DATABASE_URL`.

Testes/build validados no ciclo:

- `npm.cmd test -- --run src/internal-iluminacao-shell.test.js`: 31 passed;
- `npm.cmd test -- --run`: 116 passed;
- `npm.cmd run build`: sucesso, 233 modules transformed;
- testes cobriram coordenadas validas/invalidas, link Google Maps seguro, modo manutencao, `ativos=true`, permissao de relatorio, filtros administrativos seguros, tratamento amigavel de 403/404/422/503 e renderizacao dos formularios operacionais.

### Checklist pos-deploy do MVP interno

1. Abrir `https://geoportal.amambai.ms.gov.br/`.
2. Confirmar que o Geoportal publico abre normalmente.
3. Confirmar que o link `Area interna` aponta para `https://geoserver.amambai.ms.gov.br/interno/`.
4. Abrir `https://geoserver.amambai.ms.gov.br/interno/` em aba anonima.
5. Confirmar tela de login.
6. Confirmar no Network: `GET /api/internal/auth/me -> 401`.
7. Fazer login com usuario de homologacao/piloto.
8. Confirmar: `GET /api/internal/auth/me -> 200`.
9. Confirmar listagem: `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0 -> 200`.
10. Abrir detalhe de uma solicitacao.
11. Confirmar coordenadas quando disponiveis.
12. Confirmar botao de rota Google Maps sem dados pessoais na URL.
13. Confirmar mapa simples no detalhe quando houver coordenada valida.
14. Carregar historico sob demanda quando houver permissao.
15. Carregar observacoes sob demanda.
16. Criar observacao com texto sintetico, sem dados reais.
17. Alterar status em solicitacao de teste, se permitido e apropriado.
18. Alterar prioridade em solicitacao de teste, se permitido e apropriado.
19. Se o usuario autenticado for administrativo, validar `GET /api/internal/iluminacao/relatorios/solicitacoes/resumo` com e sem datas.
20. Se o usuario autenticado for administrativo, validar `GET /api/internal/iluminacao/relatorios/solicitacoes.csv` com e sem datas e confirmar ausencia de dados pessoais no arquivo.
21. Se a shell administrativa receber `404` nos endpoints de relatorio, tratar como indicio de API interna ainda nao atualizada ou restart pendente no servidor, e repetir a validacao somente apos `pull` e reinicio controlado do runtime correto.
22. Clicar em `Sair`.
23. Confirmar `POST /api/internal/auth/logout`.
24. Confirmar retorno para a tela de login.
25. Confirmar `GET /api/internal/auth/me -> 401`.
26. Confirmar ausencia de token em `localStorage` e `sessionStorage`.
27. Confirmar que console e documentacao nao exibem cookie, token, senha, observacoes reais ou dados pessoais reais.

### Validacao local e operacional do MVP interno - 2026-06-10

**Objetivo.** Registrar a validacao local e operacional do MVP interno/piloto de Iluminacao Publica, sem mudanca funcional nesta etapa.

**Escopo.** A validacao cobriu testes automatizados de backend e frontend, build Vite e fluxo operacional no navegador contra o ambiente publicado.

**Resultados backend.**

- Suite completa acionada pelo script local: 601 passed, 1 warning.
- Router interno de solicitacoes: 57 passed, 1 warning.
- Repository de Iluminacao: 32 passed.
- Service de Iluminacao: 46 passed.
- Warning conhecido e nao bloqueante: `DeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.`

**Resultados frontend e build.**

- Testes frontend: 85 tests passed em 5 test files.
- Build Vite: concluido com sucesso, 233 modules transformed.
- Build gerou `dist/interno/index.html`, `dist/index.html`, assets CSS/JS de `interno` e assets CSS/JS de `main`.

**Validacao operacional em navegador.**

- Sem sessao, `GET /api/internal/auth/me` retornou 401.
- Apos login, `GET /api/internal/auth/me` retornou 200.
- `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0` retornou 200.
- Detalhe de solicitacao retornou 200.
- Observacoes retornaram 200.
- Logout retornou 200.
- Apos atualizar a pagina depois do logout, `/api/internal/auth/me` voltou a retornar 401.
- `localStorage` foi confirmado vazio; nao houve registro de token no navegador via `localStorage`.

**Interpretacao.**

O fluxo basico do MVP interno esta validado: sem sessao -> login -> sessao valida -> permissoes/listagem -> detalhe/observacoes -> logout -> sessao encerrada. A shell interna continua sem persistir token em `localStorage`, e o backend permanece como autoridade real de autenticacao e autorizacao.

**Pendencias e riscos.**

- Confirmar tambem `sessionStorage` em validacao manual posterior.
- Confirmar e registrar atributos do cookie no navegador real, especialmente `HttpOnly`, `Secure` e `SameSite`, sem copiar o valor do cookie.
- Tratar o warning de depreciacao HTTP 422 futuramente como ajuste tecnico de baixa prioridade.
- Manter cuidado com observacoes internas, pois sao texto livre operacional.
- Nao avancar para anexos, reabertura/correcao administrativa ou mapa operacional sem etapa propria de planejamento, permissoes, auditoria e rollback.
- `Alias /assets/` no dominio `geoserver` continua sendo ponto de atencao futuro se houver conflito com outros assets.

**Proximos passos recomendados.**

- Registrar validacao complementar de `sessionStorage` e atributos do cookie sem copiar valores sensiveis.
- Manter o piloto controlado com usuarios/perfis definidos e orientacao de uso para observacoes internas.
- Planejar anexos, reabertura/correcao administrativa e mapa operacional somente em etapas separadas, com contrato, permissao, auditoria, testes e rollback.

### Checklist de deploy e rollback estatico

Antes de atualizar a area interna, fazer backup de:

```text
C:/apps/geoportal_interno/
```

Publicar:

- conteudo de `dist/interno/` em `C:/apps/geoportal_interno/interno/`;
- conteudo de `dist/assets/` em `C:/apps/geoportal_interno/assets/`.

Normalmente nao e necessario reiniciar Apache para troca de arquivos estaticos.

Reiniciar ou recarregar Apache somente se alterar:

- `Alias`;
- `ProxyPass`;
- headers;
- `VirtualHost`;
- certificado;
- regras CORS.

Reiniciar backend somente se alterar:

- codigo da API;
- `.env`;
- servico;
- dependencias;
- migrations ou schema.

Rollback estatico:

- restaurar o backup de `C:/apps/geoportal_interno/`;
- validar `https://geoserver.amambai.ms.gov.br/interno/`;
- validar `GET /api/internal/auth/me` sem sessao retornando `401`.

Rollback Apache:

- restaurar backup do arquivo de configuracao;
- rodar `httpd.exe -t`;
- reiniciar Apache controladamente;
- validar Geoportal publico, GeoServer, API publica e API interna.

### Marco operacional da producao interna de Iluminacao - 2026-06-12

Objetivo: registrar o marco operacional em que a API Interna de Producao foi criada, validada, instalada como servico Windows/NSSM e publicada via Apache HTTPS em `/api/internal/`, preservando o Geoportal publico, a API publica, o GeoServer e a homologacao interna. Esta secao e registro documental: nao executa banco, Apache, NSSM, `.env`, migrations ou producao.

Decisao de runtime aplicada:

- nao reutilizar `GeoportalAPIInternaHomologacao` para producao real;
- nao misturar homologacao interna com producao interna;
- manter isolamento entre `8000` homologacao publica, `8001` producao publica, `8002` homologacao interna e `8003` producao interna;
- usar `GeoportalAPIInternaProducao` em `http://127.0.0.1:8003`, com `ExpectedEnvironment=producao`, `IsInternalRuntime=true`, `PublicBaseUrl=https://geoserver.amambai.ms.gov.br` e banco `amambaiGis`;
- manter `GeoportalAPIInternaHomologacao` ativo em `http://127.0.0.1:8002` para homologacao interna;
- publicar `/api/internal/` no Apache HTTPS apontando para `http://127.0.0.1:8003/api/internal/`.

Mapa de ambientes validado:

| Ambiente | Servico | Base local | Porta | Banco | Finalidade |
|---|---|---|---|---|---|
| Homologacao | `GeoportalAPIHomologacao` | `http://127.0.0.1:8000` | `8000` | homologacao | API publica de homologacao |
| InternaHomologacao | `GeoportalAPIInternaHomologacao` | `http://127.0.0.1:8002` | `8002` | homologacao | API interna de homologacao |
| Producao | `GeoportalAPIProducao` | `http://127.0.0.1:8001` | `8001` | `amambaiGis` | API publica de producao |
| InternaProducao | `GeoportalAPIInternaProducao` | `http://127.0.0.1:8003` | `8003` | `amambaiGis` | API interna de producao/piloto |

Servicos confirmados em execucao no servidor:

- `Apache2.4`;
- `GeoportalAPIProducao`;
- `GeoportalAPIInternaHomologacao`;
- `GeoportalAPIInternaProducao`.

Portas internas confirmadas:

- `127.0.0.1:8002` -> homologacao interna;
- `127.0.0.1:8003` -> producao interna.

Apache HTTPS ativo para producao interna:

```apache
ProxyPass        /api/internal/ http://127.0.0.1:8003/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8003/api/internal/
```

Configuracao logica final:

- `/api/` -> producao publica em `127.0.0.1:8001`;
- `/api/internal/` -> producao interna em `127.0.0.1:8003`;
- `/interno/` -> frontend interno estatico no dominio `geoserver`;
- `/geoserver` -> Tomcat/GeoServer.

Servico Windows/NSSM da producao interna:

- servico: `GeoportalAPIInternaProducao`;
- script operacional no servidor: `C:\apps\geoportal-api\scripts\run-producao-interna-service.ps1`;
- arquivo operacional de ambiente no servidor: `C:\apps\geoportal-api\env\producao-interna.env`.
- harness versionado para restart/validacao: `.\scripts\deploy\backend-restart-validate-service.ps1 -Environment InternaProducao -Restart -Validate`.

Uso operacional minimo do harness:

- `InternaProducao` -> `GeoportalAPIInternaProducao` em `127.0.0.1:8003`;
- `Producao` continua reservado a API publica em `127.0.0.1:8001`;
- preferir o harness versionado para restart/validacao, em vez de `Restart-Service` manual;
- o proxy HTTPS publicado de `/api/internal/` continua responsabilidade do Apache e nao e alterado por esse harness.

O conteudo do arquivo de ambiente e qualquer segredo associado nao devem ser registrados em documentacao.

Banco e role operacional:

- banco: `amambaiGis`;
- PostgreSQL: `127.0.0.1:5434`;
- role runtime interna de producao: `geoportal_api_interna_prod`.

Durante a validacao do login em producao interna, foi identificado que o backend consulta `mod_auth.login_auditoria` para contar tentativas recentes falhas antes de autenticar. A role `geoportal_api_interna_prod` precisou de `SELECT` alem de `INSERT` nessa tabela. Estado final validado:

- `mod_auth.login_auditoria`: `SELECT`, `INSERT`;
- sequence `mod_auth.login_auditoria_id_seq`: `USAGE`/`SELECT` conforme necessidade operacional.

Usuario administrativo inicial de producao interna:

- usuario administrativo inicial: `admin.producao`;
- perfil: `administrador-interno-geoportal`;
- permissoes validadas: 16.

A senha foi definida interativamente por script administrativo seguro, sem senha em argumento de linha de comando.

Permissoes validadas:

- `admin.perfis.gerenciar`
- `admin.perfis.ler`
- `admin.permissoes.gerenciar`
- `admin.permissoes.ler`
- `admin.usuarios.atribuir_perfis`
- `admin.usuarios.bloquear`
- `admin.usuarios.criar`
- `admin.usuarios.ler`
- `admin.usuarios.redefinir_senha`
- `internal.auth.me`
- `iluminacao.solicitacoes.ler`
- `iluminacao.solicitacoes.ver_historico`
- `iluminacao.solicitacoes.ver_observacoes`
- `iluminacao.solicitacoes.comentar`
- `iluminacao.solicitacoes.atualizar_status`
- `iluminacao.solicitacoes.atualizar_prioridade`

Validacoes HTTPS reais concluidas:

- `https://geoserver.amambai.ms.gov.br/api/health` -> `200 OK`;
- `https://geoserver.amambai.ms.gov.br/api/version` -> `environment=producao`;
- `GET /api/internal/auth/me` sem sessao -> `401 Unauthorized`;
- `POST /api/internal/auth/login` via HTTPS -> `200 OK`;
- `GET /api/internal/auth/me` autenticado -> `200 OK`;
- `GET /api/internal/iluminacao/solicitacoes` autenticado -> `200 OK`;
- `POST /api/internal/auth/logout` com `X-Geoportal-Internal-Request: 1` -> OK;
- `https://geoserver.amambai.ms.gov.br/interno/` validado no navegador.

Contrato atual de `/api/internal/auth/me`: retorna `authenticated`, `usuario_id`, `login`, `nome`, `perfis` e `permissoes`. O endpoint nao retorna token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. A shell interna usa `nome`, `login` e `perfis` quando disponiveis e mantem fallback visual antigo para compatibilidade com respostas legadas/parciais.

Pendencia nao bloqueadora de encoding: em terminal PowerShell, nome com acento pode aparecer com mojibake, por exemplo `Administrador ProduÃ§Ã£o`. Revisar encoding/exibicao de nomes com acento nos scripts/terminal ou padronizar nomes administrativos sem acento quando necessario.

Principios obrigatorios:

- nao quebrar servico online;
- fazer backup antes de qualquer alteracao em `amambaiGis`, Apache, backend ou arquivos estaticos internos;
- inventariar antes de criar migration;
- definir rollback antes de executar;
- aplicar menor privilegio para roles runtime;
- manter mutacoes internas protegidas por sessao, permissao e `X-Geoportal-Internal-Request: 1`;
- lembrar que o frontend orienta, mas o backend decide;
- nao copiar banco inteiro de homologacao para producao;
- nao migrar dados por suposicao;
- nao registrar senha, token, cookie, hash, `session_secret`, `DATABASE_URL`, dados pessoais reais ou observacoes reais.

Escopo do plano:

- inventario de producao;
- backup e validacao do backup;
- comparacao `amambaiGis_homologacao` x `amambaiGis`;
- migrations somente se houver lacuna real;
- GRANTs minimos para a role runtime interna;
- validacao da API interna;
- validacao de Apache/NSSM;
- publicacao do front interno estatico;
- usuarios, perfis e permissoes reais do piloto;
- checklist operacional e rollback.

Fora do escopo desta ativacao:

- mapa operacional;
- dashboard avancado;
- anexos/fotos;
- reabertura ou correcao administrativa;
- novos modulos;
- tela administrativa completa de usuarios/perfis, salvo o minimo necessario para preparar usuarios do piloto em fluxo separado.

Inventario obrigatorio de producao antes de alterar `amambaiGis`:

- schemas existentes: `mod_iluminacao`, `mod_auth` e schemas auxiliares relacionados;
- tabelas, colunas, constraints, FKs e indices;
- sequences usadas por solicitacoes, historico, observacoes, auth e perfis;
- valores permitidos para status, prioridade, origem e acao de historico;
- existencia de `mod_iluminacao.solicitacoes.prioridade`, default `normal`, constraints `baixa`/`normal`/`alta`/`urgente`, campos `prioridade_anterior`/`prioridade_nova` e `acao='alteracao_prioridade'`;
- migrations ja aplicadas em producao;
- roles runtime da API publica e da API interna;
- GRANTs efetivos por tabela, sequence e, quando possivel, por coluna;
- servicos Windows/NSSM existentes e portas locais;
- confirmacao de que `8003` esta livre antes de instalar `GeoportalAPIInternaProducao`;
- VirtualHost Apache ativo, ordem de `Alias` e `ProxyPass`;
- politicas reais de cookie (`HttpOnly`, `Secure`, `SameSite`, `Path`, expiracao), sem copiar valor de cookie;
- logs existentes e garantia de que nao registram segredos.

Backup obrigatorio antes de qualquer alteracao:

1. Fazer backup manual de `amambaiGis`.
2. Validar que o arquivo existe e tem tamanho coerente.
3. Validar o backup com comando seguro de listagem, como `pg_restore --list` quando aplicavel.
4. Registrar data/hora, ambiente, responsavel e finalidade.
5. Fazer backup do arquivo de configuracao Apache se houver mudanca de VirtualHost, `Alias`, `ProxyPass`, headers ou CORS.
6. Fazer backup de `C:/apps/geoportal_interno/` antes de trocar arquivos estaticos.
7. Definir rollback antes de executar qualquer passo.

Comparacao homologacao x producao:

- comparar `amambaiGis_homologacao` com `amambaiGis` somente por inventario/consulta controlada;
- nao copiar tabelas inteiras de homologacao para producao;
- nao migrar dados de homologacao para producao;
- aplicar apenas scripts minimos necessarios para lacunas reais;
- se producao ja tiver coluna, constraint, default, indice e acao de historico adequados, nao criar migration vazia para "confirmar".

Migrations:

- prioridade nao exige migration se `amambaiGis` tiver schema equivalente ao confirmado em homologacao;
- qualquer migration nova deve ser revisada, testada em homologacao, acompanhada de rollback ou plano de contencao, e aplicada em producao somente apos backup validado;
- evitar locks longos em producao;
- separar scripts de estrutura, permissoes e dados iniciais;
- nao executar migrations por comandos soltos sem registro.

GRANTs minimos para runtime interno:

- leitura de solicitacoes: `SELECT` minimo em `mod_iluminacao.solicitacoes`;
- historico: `SELECT` para leitura e `INSERT` + `USAGE` de sequence para mutacoes que gravam historico;
- observacoes: `SELECT` para leitura, `INSERT` + `USAGE` de sequence para criacao;
- status: `UPDATE` preferencialmente por coluna apenas em `status`, `atualizado_em` e `finalizado_em`;
- prioridade: `UPDATE` preferencialmente por coluna apenas em `prioridade` e `atualizado_em`;
- auth: `SELECT` minimo nas tabelas de usuarios, sessoes, perfis e permissoes necessarias para login, `/me`, autorizacao e logout;
- nunca conceder `DELETE` para o runtime comum sem justificativa formal;
- evitar `UPDATE` amplo em `mod_iluminacao.solicitacoes`;
- validar a matriz final de privilegios e registrar apenas flags/resultado, sem string de conexao ou senha.

Validacao da API interna:

- confirmar que o servico interno esta restrito a loopback no servidor;
- confirmar que `/api/internal/auth/me` sem sessao retorna `401`;
- confirmar login com usuario do piloto sem registrar senha/token/cookie;
- confirmar `/api/internal/auth/me` com sessao retorna `200` e permissoes esperadas;
- confirmar que mutacoes sem `X-Geoportal-Internal-Request: 1` retornam `403`;
- confirmar que mutacoes com header incorreto retornam `403`;
- validar listagem, detalhe, historico, observacoes, criacao de observacao, alteracao de status, alteracao de prioridade e logout;
- confirmar que `localStorage` e `sessionStorage` continuam sem token.

Validacao Apache/NSSM:

- manter `/api/internal/` antes de `/api/` no VirtualHost;
- manter `/api/internal/` apontando para `127.0.0.1:8003` em producao interna;
- manter `127.0.0.1:8002` como homologacao interna preservada;
- manter `/api/` apontando para `127.0.0.1:8001`;
- manter `/geoserver` apontando para o Tomcat/GeoServer;
- nao expor as portas `8002` ou `8003` diretamente no firewall ou rede;
- rodar validacao de sintaxe Apache antes de qualquer reload/restart quando houver mudanca de configuracao;
- reiniciar/recarregar Apache apenas quando houver mudanca de configuracao, nao para simples troca de arquivos estaticos;
- reiniciar backend apenas quando houver mudanca de codigo, `.env`, servico, dependencias, migrations ou schema.

Pre-condicoes registradas para ativar `GeoportalAPIInternaProducao`:

1. Backup validado do banco `amambaiGis`.
2. Inventario do schema de producao concluido.
3. Bootstrap minimo de `mod_auth` em `amambaiGis`.
4. GRANTs minimos para a role runtime interna de producao.
5. Servico `GeoportalAPIInternaProducao` instalado via NSSM.
6. Porta `8003` ouvindo somente em `127.0.0.1`.
7. `GET http://127.0.0.1:8003/api/internal/auth/me` validado localmente, retornando `401` sem sessao.
8. Mutacoes internas sem header retornando `403`.
9. Mutacoes internas com header `X-Geoportal-Internal-Request: 1` e permissao funcionando em dado de teste apropriado.
10. Apache validado com `httpd.exe -t` antes da troca.
11. Backup do `httpd-ssl.conf`.
12. Rollback documentado para voltar `/api/internal/` para `http://127.0.0.1:8002/api/internal/`.

Rollback temporario do proxy interno para homologacao:

```apache
ProxyPass        /api/internal/ http://127.0.0.1:8002/api/internal/
ProxyPassReverse /api/internal/ http://127.0.0.1:8002/api/internal/
```

Checklist de rollback do Apache:

```powershell
& "C:\Apache24\bin\httpd.exe" -t
Restart-Service Apache2.4
```

Esse rollback altera apenas o proxy publico de `/api/internal/`; nao apaga banco, usuario, servico, arquivos estaticos nem configuracao de `GeoportalAPIInternaProducao`.

Publicacao do front interno:

- gerar build Vite em ambiente controlado;
- publicar `dist/interno/` em `C:/apps/geoportal_interno/interno/`;
- publicar `dist/assets/` em `C:/apps/geoportal_interno/assets/`;
- nao publicar a area interna apenas no FTP do Geoportal publico;
- validar `https://geoserver.amambai.ms.gov.br/interno/`;
- confirmar que o link publico `Area interna` aponta para `https://geoserver.amambai.ms.gov.br/interno/`;
- manter atencao ao risco futuro do `Alias /assets/` global.

Usuarios e perfis do piloto:

- definir usuarios individuais, nunca compartilhados;
- separar ao menos perfis conceituais de leitor, operador e administrador;
- conceder apenas permissoes necessarias;
- nao conceder todas as permissoes de Iluminacao a todos os usuarios;
- validar `/api/internal/auth/me` para cada perfil do piloto;
- se houver criacao/reset/bloqueio de usuarios, usar endpoints administrativos existentes ou scripts controlados ja documentados, nunca SQL manual solto sem plano.

Checklist do piloto controlado:

1. Abrir `https://geoportal.amambai.ms.gov.br/`.
2. Confirmar que mapa, camadas, busca e solicitacao publica continuam funcionando.
3. Confirmar link `Area interna`.
4. Abrir `https://geoserver.amambai.ms.gov.br/interno/` em aba anonima.
5. Confirmar login e `/api/internal/auth/me -> 401` sem sessao.
6. Fazer login com usuario do piloto.
7. Confirmar `/api/internal/auth/me -> 200`.
8. Confirmar permissoes esperadas.
9. Confirmar listagem.
10. Confirmar detalhe.
11. Carregar historico sob demanda.
12. Carregar observacoes sob demanda.
13. Criar observacao com texto sintetico.
14. Alterar status em solicitacao de teste adequada.
15. Alterar prioridade em solicitacao de teste adequada.
16. Confirmar que status terminal bloqueia alteracao normal de status/prioridade quando aplicavel.
17. Clicar em `Sair`.
18. Confirmar logout e `/api/internal/auth/me -> 401`.
19. Confirmar `localStorage` e `sessionStorage` vazios.
20. Confirmar que console, logs e documentacao nao exibem cookie, token, senha, observacoes reais ou dados pessoais reais.

Rollback:

- banco: restaurar backup validado ou aplicar rollback/contencao documentado; nao improvisar em producao;
- API: restaurar versao anterior do backend ou reverter commit implantado, reiniciar servico e validar `/api/health`, `/api/version`, API publica e API interna;
- Apache: restaurar backup do arquivo de configuracao, rodar `httpd.exe -t`, reiniciar/recarregar controladamente e validar Geoportal publico, GeoServer, API publica e API interna;
- front interno: restaurar backup de `C:/apps/geoportal_interno/` e validar `/interno/`;
- permissoes: revogar GRANTs adicionais ou desativar permissoes de aplicacao conforme roteiro, preferindo reduzir privilegio antes de remover objetos.

Bloqueadores para ampliar uso alem do piloto controlado:

- inexistencia de backup validado;
- inventario incompleto de `amambaiGis`;
- diferenca de schema nao explicada entre homologacao e producao;
- tentativa de usar `GeoportalAPIInternaHomologacao` como producao interna real;
- rollback ausente;
- porta interna exposta diretamente;
- cookie inseguro em HTTPS;
- permissoes PostgreSQL amplas demais;
- perfil de piloto com permissoes excessivas;
- ausencia de validacao do Geoportal publico apos mudanca;
- logs com senha, token, cookie, `DATABASE_URL`, dados pessoais reais ou observacoes reais;
- qualquer necessidade de migration sem teste previo em homologacao.

Ordem recomendada apos o marco de 2026-06-12:

1. Manter piloto controlado com usuarios e perfis explicitamente definidos.
2. Validar periodicamente `/api/`, `/api/internal/`, `/interno/` e logout.
3. Confirmar atributos de cookie no navegador real sem copiar valores.
4. Confirmar `localStorage` e `sessionStorage` vazios apos login/logout.
5. Monitorar logs sem registrar senha, token, cookie, observacoes reais ou dados pessoais desnecessarios.
6. Planejar tela administrativa de usuarios, perfis e permissoes antes de ampliar a operacao.
7. Manter o contrato de `/api/internal/auth/me` enxuto e sanitizado, evitando incluir segredos ou dados pessoais desnecessarios.
8. Planejar mapa operacional, anexos e dashboard apenas em etapas separadas.
9. Decidir sobre validacao manual adicional dos cenarios negativos que exigiriam escrita, e implementar frontend administrativo antes de qualquer uso operacional amplo da correcao administrativa de status.

### Pendencias futuras fora do MVP

- Reabertura/correcao administrativa: backend implementado no commit `313afd8 Implementa correcao administrativa de status`, com fluxo separado, permissao propria `iluminacao.solicitacoes.corrigir_status`, justificativa obrigatoria e auditoria forte. O servidor foi atualizado ate `da4be5c`, `GeoportalAPIInternaProducao` foi reiniciado/validado pelo harness `scripts/deploy/backend-restart-validate-service.ps1 -Environment InternaProducao -Restart -Validate`, com porta `8003`, `/api/health` OK, `/api/version` OK com `environment=producao` e `/api/internal/auth/me` retornando 401 sem sessao. A tentativa inicial de bootstrap da permissao com a role runtime falhou com permissao negada em `mod_auth.permissoes`, comportamento esperado por menor privilegio; depois, com backup previo `C:\apps\geoportal-api\backups\manual\pre_status_correcao_mod_auth_20260617_143551.sql`, a permissao (`modulo = 'iluminacao'`, `chave = 'solicitacoes.corrigir_status'`) foi criada/vinculada por procedimento operacional controlado ao perfil `administrador-interno-geoportal`, mantendo `manutencao-iluminacao` sem a permissao. A chamada direta autenticada em chamado teste/controlado `IP-2026-000001` confirmou `resolvida -> em_execucao`, `finalizado_em=NULL`, prioridade preservada e historico `acao='reabertura'` com `origem_acao='ajuste_administrativo'`; logout confirmado ao final. A validacao negativa zero-write posterior confirmou 403 sem header, 422 para payload invalido, 404 para solicitacao inexistente e 403 para `manutencao.producao` sem permissao, sem alterar `status`, `atualizado_em` ou `finalizado_em` do chamado teste; logout admin e manutencao confirmados. Nao foram executados `terminal -> aberta` nem `terminal -> encaminhada` em producao porque exigiriam escrita adicional para preparar estado terminal.
- UI administrativa restrita publicada por artefato local: o build Vite gerou `dist/interno/index.html`, `dist/assets/interno-5nMdqyri.css` e `dist/assets/interno-DRNqoJ3A.js`; o pacote foi compactado em `.rar`, transferido ao servidor e extraido nas pastas estaticas do frontend interno. Nao houve `git pull` inicial no servidor antes da extracao; depois, o repositorio fonte no servidor foi alinhado com `git pull --ff-only` para evitar divergencia. Nao houve restart backend, alteracao de Apache, alteracao de NSSM, alteracao de banco, migration, SQL, alteracao de `.env` ou exposicao de segredo.
- Dashboard read-only interno validado em producao: o commit `ebc5798` documenta a implantacao dos endpoints `GET /api/internal/iluminacao/dashboard/resumo`, `GET /api/internal/iluminacao/dashboard/ranking` e `GET /api/internal/iluminacao/dashboard/series` em `GeoportalAPIInternaProducao`. O processo incluiu `git pull --ff-only`, `working tree clean`, testes focados `197 passed, 3 warnings`, suite completa `675 passed, 3 warnings`, backup manual `C:\apps\geoportal-api\backups\manual\pre_dashboard_ler_mod_auth_20260622_101948.sql`, permissao `iluminacao.dashboard.ler` criada com `id=18` e vinculada apenas a `administrador-interno-geoportal`, restart controlado do servico com `scripts/deploy/backend-restart-validate-service.ps1 -Environment InternaProducao -Restart -Validate`, validacoes `401` sem sessao, `200` com `admin.producao`, `403` com `manutencao.producao`, resposta validada do resumo e `422` para `granularidade=hora`. Nenhum frontend do dashboard, build adicional, migration estrutural, alteracao de schema, Apache, NSSM, `.env` ou deploy fora do restart controlado foi alterado. A unica escrita em banco foi o procedimento operacional controlado em `mod_auth`, com backup previo, para criar e vincular a permissao `iluminacao.dashboard.ler`.
- Mapa operacional: posicao/poste, coordenadas, rota ate poste, permissoes e privacidade.
- Dashboard: indicadores reais, SLA, prioridades, produtividade e atrasos.
- Anexos/fotos: inventario separado, armazenamento, seguranca e limites.
- Hardening futuro: revisar/remover token no corpo da resposta de login, confirmar `Secure=True` do cookie no servidor, avaliar base propria para assets como `/interno/assets/` se houver conflito com `Alias /assets/`, registrar politica de logs e treinar usuarios.
- Harness de novo agente/chat: preparar resumo operacional e tecnico consolidado para continuidade.

## 7. Relacao com login e painel interno

Login e painel interno devem vir depois da estabilizacao da API publica no servidor.

O desenho inicial do modulo interno de Iluminacao Publica esta registrado em `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

Essa etapa posterior exigira autenticacao, autorizacao por perfil, endpoints internos separados, auditoria, gestao de status, historico e logs administrativos. Nenhum endpoint interno deve ser publicado sem validacao de autenticacao e autorizacao no backend.

O desenho detalhado esta em `docs/INTERNAL-AUTHORIZATION-PLAN.md`.

### Homologacao controlada concluida - migration 0011

Em 2026-06-25, o servidor de homologacao estava no commit `f2b956f Complementa documentacao da auditoria administrativa`. A migration `0011_create_mod_auth_admin_auditoria.sql` foi aplicada somente no banco `amambaiGis_homologacao`, depois de backup manual de 248.973.816 bytes.

Validacoes concluidas:

1. `mod_auth.admin_auditoria` validada com 13 colunas, 6 indices, 12 constraints e count inicial zero;
2. `geoportal_api_homolog` recebeu `USAGE` no schema, `INSERT, SELECT` na tabela e `USAGE` na sequence, sem `UPDATE` ou `DELETE`;
3. `GeoportalAPIInternaHomologacao`, porta `8002`, reiniciado pelo harness `-Environment InternaHomologacao -Restart -Validate`;
4. `/api/health` e `/api/version` validados, com `environment=homologacao`;
5. `/api/internal/auth/me` retornou `401` sem sessao;
6. login de homologacao, criacao e bloqueio de usuario ficticio concluidos;
7. auto-bloqueio negado com `403 {&#34;detail&#34;:&#34;Forbidden&#34;}`;
8. tres eventos auditados e zero ocorrencias dos termos sensiveis verificados.

O usuario ficticio `zz_admin_audit_probe_20260625075205` (`id=11`) permaneceu bloqueado ao final da validacao. Nessa primeira etapa, producao nao foi alterada; a aplicacao posterior em producao, tambem controlada, esta registrada na secao seguinte. A ampliacao do CRUD administrativo continua exigindo planejamento proprio.

Esta secao nao autoriza deploy, restart, aplicacao em producao ou criacao de frontend administrativo.

### Producao controlada concluida - migration 0011

Em 2026-06-25, com o servidor no commit `b40ea7e Documenta homologacao da auditoria administrativa`, foi criado o backup `C:\apps\geoportal-api\backups\manual\pre_admin_auditoria_0011_amambaiGis_20260625_083025.sql`, com 249.028.015 bytes, antes da aplicacao da migration `0011` no banco `amambaiGis`.

A estrutura de `mod_auth.admin_auditoria` foi validada com 13 colunas, 6 indices, 12 constraints e contagem inicial zero. A role `geoportal_api_interna_prod` recebeu apenas `USAGE` no schema, `INSERT, SELECT` na tabela e `USAGE` na sequence. `UPDATE`, `DELETE` e `SELECT` direto na sequence permanecem ausentes e nao devem ser concedidos enquanto o modelo append-only estiver vigente.

O servico `GeoportalAPIInternaProducao`, porta `8003`, passou no harness `backend-restart-validate-service.ps1 -Environment InternaProducao -Restart -Validate`; health, version com `environment=producao` e `401` de `/api/internal/auth/me` sem sessao foram confirmados. O harness final sem restart tambem passou.

Os testes autenticados foram feitos por HTTPS em `https://geoserver.amambai.ms.gov.br/api/internal`, porque `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=true`. O usuario ficticio `zz_admin_audit_prod_probe_20260625084805` (`id=3`) foi criado e bloqueado. A tentativa de auto-bloqueio de `admin.producao` (`id=1`) retornou `403 {&#34;detail&#34;:&#34;Forbidden&#34;}`.

A auditoria terminou com tres eventos: `admin.user.create`, `admin.user.disable` e `admin.security.denied_self_change`, este ultimo com resultado `negada` e motivo interno `self_block`. A verificacao de privacidade encontrou zero registros com os termos sensiveis pesquisados, e o logout foi confirmado. O usuario ficticio permanece bloqueado como evidencia controlada. O working tree do servidor terminou limpo em `b40ea7e`.

## 8. Seguranca operacional

- Segredos e variaveis reais devem ficar fora do Git.
- Mensagens publicas nao devem expor stack trace, SQL, host, porta, caminho local ou credenciais.
- Logs devem evitar dados pessoais desnecessarios.
- Logs nunca devem conter senha, token ou `DATABASE_URL`.
- Rate limit deve permanecer ativo nos endpoints publicos.
- Endpoints internos tambem devem ter protecao contra abuso, especialmente login e operacoes de escrita.
- A consulta publica deve continuar retornando somente dados publicos minimos.
- A confirmacao da consulta deve usar dado complementar minimo, como os ultimos 4 digitos do contato.
- Protecao contra enumeracao deve ser mantida.

### Proximo ciclo operacional - vinculos usuario/perfil

O commit `9173259 Implementa desativacao administrativa de perfis de usuarios` esta implementado localmente e publicado no GitHub, mas ainda nao foi aplicado/validado em homologacao ou producao.

Nao ha migration estrutural para esta etapa. O schema atual de `mod_auth.usuario_perfis` ja comporta a desativacao logica via `ativo=false`.

Ordem recomendada para homologacao:

1. confirmar backup operacional adequado antes de alterar permissao/GRANT;
2. atualizar o servidor de homologacao com `git pull --ff-only`;
3. executar bootstrap administrativo controlado para a permissao `admin.usuarios.remover_perfis`, garantindo vinculo apenas ao perfil administrativo autorizado;
4. conceder ao runtime interno o minimo necessario para `UPDATE (ativo)` em `mod_auth.usuario_perfis`, sem `DELETE`;
5. reiniciar e validar `GeoportalAPIInternaHomologacao` pelo harness;
6. validar leitura de vinculos, desativacao valida, auto-rebaixamento negado, ultimo administrador protegido, auditoria de sucesso/negativa e ausencia de segredo;
7. documentar o resultado antes de qualquer producao.

Producao deve ser ciclo separado, com backup previo, bootstrap/GRANT minimo equivalentes, validacao HTTPS quando cookie `Secure` exigir, e confirmacao final de que `DELETE` em `mod_auth.usuario_perfis` continua ausente.

### Homologacao concluida - desativacao administrativa de perfis de usuarios

Em 2026-06-26, a funcionalidade de desativacao administrativa de vinculos usuario/perfil foi validada em `InternaHomologacao` no commit `d91240a Documenta desativacao administrativa de perfis de usuarios`, com implementacao base `9173259`.

Ambiente:

- servico: `GeoportalAPIInternaHomologacao`;
- porta: `8002`;
- banco: `amambaiGis_homologacao`;
- backup previo: `C:\apps\geoportal-api\backups\manual\pre_desativacao_perfis_admin_amambaiGis_homologacao_20260626_074933.sql`, 248.980.625 bytes.

Bootstrap e permissoes:

- bootstrap controlado executado com `.venv` do backend e `--login admin.homologacao`;
- permissao criada: `modulo='admin'`, `chave='usuarios.remover_perfis'`, id `19`, ativa;
- vinculo somente ao perfil `administrador-interno-geoportal`;
- perfil `manutencao-iluminacao` sem a permissao;
- GRANTs temporarios do bootstrap revogados.

Privilégios finais do runtime `geoportal_api_homolog`:

- `mod_auth.usuario_perfis`: `SELECT=t`, `INSERT=t`, table `UPDATE=f`, `UPDATE(ativo)=t`, `DELETE=f`;
- `mod_auth.permissoes`: `INSERT=f`, `UPDATE=f`;
- `mod_auth.perfil_permissoes`: `INSERT=f`, `UPDATE=f`.

O `INSERT` em `mod_auth.usuario_perfis` permanece necessario para a funcionalidade ja existente de atribuicao de perfil. A nova desativacao exige somente o acrescimo controlado de `UPDATE(ativo)`, preservando ausencia de `DELETE`.

Validacoes:

- harness final sem restart OK;
- `/api/health` OK;
- `/api/version` com `environment=homologacao`;
- `/api/internal/auth/me` retornou `401` sem sessao;
- OpenAPI publicou `GET /api/internal/admin/users/{usuario_id}/profiles` e `POST /api/internal/admin/users/{usuario_id}/profiles/{perfil_id}/deactivate`;
- login `admin.homologacao` OK, `usuario_id=7`, perfil `administrador-interno-geoportal`, permissao `admin.usuarios.remover_perfis` presente;
- GET de vinculos do admin retornou perfil `administrador-interno-geoportal` ativo;
- auto-rebaixamento do admin retornou `403`, manteve vinculo ativo e auditou `admin.security.denied_self_demotion`;
- usuario ficticio `zz_profile_deactivate_probe_20260626085536` (`id=12`) recebeu `manutencao-iluminacao` (`perfil_id=4`) com `201`, foi desativado com `200`, confirmado como `ativo=false/f`, auditado como `admin.user.remove_profile`, e segunda tentativa retornou `409`;
- logout retornou `200`.

Producao nao foi alterada nesta validacao. A aplicacao em producao deve ser planejada em ciclo separado, com backup previo, bootstrap controlado, matriz final preservando `INSERT` para atribuicao existente, `UPDATE(ativo)` para desativacao e `DELETE=false`.
