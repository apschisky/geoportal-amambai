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
20. Desenhar endpoints internos protegidos para status, historico e observacoes.
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

O roteiro manual para proxy interno controlado foi executado com sucesso. Este documento registra a implementação operacional no Apache público ativo, com backup, validação e testes de conformidade.

**Objetivo realizado:**
Tornar o endpoint interno `GET /api/internal/auth/me` acessível via proxy HTTPS controlado (`https://geoserver.amambai.ms.gov.br/api/internal/`), sem expor diretamente a porta `8002` na rede, mantendo a API interna restrita a `127.0.0.1:8002` no servidor.

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
- API interna `/api/internal/` agora aponta para `127.0.0.1:8002` via proxy
- Ambas protegidas por HTTPS e com Geoportal público saudável

**Escopo Completado:**

- ✅ Proxy interno configurado
- ✅ Sintaxe validada
- ✅ Serviço reiniciado controladamente
- ✅ Público + GeoServer testados (sem regressão)
- ✅ Endpoint interno acessível (401 esperado)
- ✅ Porta 8002 continua não-exposta

**Escopo Não Executado Nesta Etapa (Planejado para Futuro):**

- ❌ Nenhum endpoint de login real foi criado
- ❌ Nenhuma sessão autenticada foi testada
- ❌ Nenhum GET para listagem de solicitações foi validado
- ❌ Nenhuma rota mutável (POST/PATCH) foi tocada
- ❌ Nenhum dashboard, mapa ou painel interno foi criado
- ❌ Nenhum usuário, perfil, permissão ou role foi criado/alterado

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

## 7. Relacao com login e painel interno

Login e painel interno devem vir depois da estabilizacao da API publica no servidor.

O desenho inicial do modulo interno de Iluminacao Publica esta registrado em `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

Essa etapa posterior exigira autenticacao, autorizacao por perfil, endpoints internos separados, auditoria, gestao de status, historico e logs administrativos. Nenhum endpoint interno deve ser publicado sem validacao de autenticacao e autorizacao no backend.

O desenho detalhado esta em `docs/INTERNAL-AUTHORIZATION-PLAN.md`.

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
