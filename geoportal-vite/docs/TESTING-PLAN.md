# Plano de Testes do Front-end do Geoportal de Amambai

Este plano descreve uma estrategia incremental para adicionar testes ao front-end sem refatoracao ampla e sem alterar comportamento funcional. A prioridade e aumentar a seguranca de manutencao do Geoportal em producao, com testes pequenos, deterministas e baratos de rodar.

## 1. Objetivo

Criar uma base gradual de testes automatizados para proteger funcoes criticas do front-end, especialmente sanitizacao, montagem de URLs, tratamento de timeout e helpers de estado.

Os testes nao devem forcar mudancas de arquitetura neste momento. A regra principal e testar primeiro o que ja e puro, exportado e independente de OpenLayers/GeoServer/DOM real. Fluxos completos do mapa continuam dependendo de testes manuais ate existir uma etapa propria de integracao ou end-to-end.

## 2. Estrategia

### Testes unitarios para funcoes puras

Devem cobrir funcoes com entrada e saida previsiveis:

- sanitizacao de HTML;
- mensagens de erro;
- montagem de URLs;
- formatacao de coordenadas;
- calculo simples;
- helpers de estado;
- wrappers de rede com `fetch` mockado.

Esses testes devem rodar sem GeoServer online, sem mapa OpenLayers real e sem navegador real.

### Testes manuais para fluxos OpenLayers/GeoServer

Devem continuar cobrindo os fluxos que dependem de mapa, camadas reais, GeoServer e interacao visual:

- abertura do mapa;
- clique em camadas;
- WMS/WFS/GetFeatureInfo reais;
- popups completos;
- medicao;
- impressao;
- geolocalizacao;
- mobile.

### Testes futuros de integracao/end-to-end

Em etapa posterior, avaliar testes com ambiente controlado para:

- DOM com jsdom quando bastar;
- mocks de OpenLayers para handlers isolados;
- Playwright ou ferramenta similar para fluxos reais no navegador;
- interceptacao de rede para nao depender do GeoServer nos testes automatizados.

## 3. Cobertura de segurança para a Etapa 0

O reforço recente da Etapa 0 do login interno integra a cobertura automatizada de segurança do backend. A implementação passou a cobrir:
- spoofing de `X-Forwarded-For` e `X-Real-IP` com peer confiável e não confiável;
- rejeição conservadora de cadeias múltiplas, vazias ou malformadas;
- rate limit por IP, por login/origem e por IP+login;
- resposta `429` sanitizada sem expor usuário, contador ou escopo bloqueado;
- login normal continuando operacional após o reforço;
- auditoria preservando `rate_limit`, `rate_limit_ip` e `rate_limit_ip_login` sem persistir IP bruto.

No ciclo recente, os resultados reportados foram: microchecagem focada com `66 passed`, suíte backend completa com `695 passed` e `3 warnings`, e teste isolado de auditoria complementar com `8 passed`. As warnings conhecidas são de depreciação do `HTTP_422_UNPROCESSABLE_ENTITY`.

Validação operacional em produção interna concluída: a suíte backend no servidor passou com `695 passed` e `3 warnings`; `RATE_LIMIT_ENABLED=true` foi confirmado de forma sanitizada; login normal, `/auth/me` e logout funcionaram; o probe fictício retornou `401,401,401,401,401,429`. Nenhuma credencial, token ou cookie foi documentado.

Lacuna mantida no plano de testes: a configuração ativa pesquisada do Apache não apresentou `X-Forwarded-For` ou `X-Real-IP` explícitos. Assim, a próxima validação de infraestrutura deve ocorrer somente após eventual hardening do proxy e deve confirmar, com IPs fictícios/controlados, a granularidade por cliente e a resistência a spoofing sem registrar IP real em documentação.

## 4. Funcoes candidatas a testes unitarios

### `src/geoportal-utils.js`

- `escapeHtml(value)`
  - `null` e `undefined` retornam string vazia.
  - Escapa `&`, `<`, `>`, `"`, `'`.
  - Converte numeros e outros valores para string.

- `fetchWithTimeout(url, options, timeoutMs)`
  - Deve chamar `fetch` com `AbortController`.
  - Deve retornar a resposta quando `response.ok` e verdadeiro.
  - Deve lancar `Error('HTTP <status>')` quando `response.ok` e falso.
  - Deve lancar `Error('TIMEOUT')` quando ocorrer `AbortError`.
  - Deve limpar o timer ao final.
  - Requer mock de `global.fetch`, timers falsos e ambiente com `window.setTimeout` ou adaptacao controlada no setup do teste.

- `getGeoServerErrorMessage(error)`
  - Retorna mensagem de timeout para `Error('TIMEOUT')`.
  - Retorna mensagem generica para outros erros.
  - Retorna mensagem generica para erro ausente.

### `src/geoportal-routes.js`

- `buildGoogleMapsRouteUrl(destinationLonLat, originLonLat)`
  - Retorna `#` para destino invalido.
  - Monta URL apenas com destino quando origem nao existe.
  - Monta URL com origem e destino quando ambos existem.
  - Formata coordenadas como `lat,lon` com 6 casas.
  - Deve testar passando `originLonLat` explicitamente para evitar depender de estado global.
  - A integracao geolocalizacao -> `userLonLat` no estado centralizado -> rota continua no checklist manual.

Ponto de atencao futuro:

- `formatMapCoordinateParam` e interna. Nao exportar apenas por conveniencia neste primeiro ciclo, a menos que haja ganho claro.

### `src/geoportal-postes-reparo.js`

- `buildPosteRepairFormUrl(data, formBaseUrl, formFields)`
  - Inclui identificacao do poste quando preenchida.
  - Inclui coordenadas quando presentes.
  - Omite identificacao vazia, `null` ou `undefined`.
  - Usa encoding correto via `URLSearchParams`.

- `calculateDistance(point1, point2)`
  - Calcula distancia euclidiana simples.
  - Cobre zero, horizontal, vertical e diagonal.

- `formatPosteCoordinates(coord)`
  - Pode ser testada com coordenadas conhecidas, mas depende de `ol/proj.toLonLat`.
  - E candidata boa, desde que o teste aceite a dependencia OpenLayers ou use coordenadas simples.

- `createPostePopupHTML(properties, coordinate, formBaseUrl, formFields)`
  - Pode ter testes leves verificando escape de ID e presenca de links principais.
  - Evitar snapshots grandes de HTML nesta fase.

- `queryPosteLayer` e `queryPosteLayerWithBuffer`
  - Sao mais proximas de integracao, pois usam mapa/layer/fetch/CRS.
  - Podem ser testadas no futuro com mocks de `fetchWithTimeout`, `transform` e objetos minimos de mapa/layer.

### `src/geoportal-state.js`

- `getGeoportalStateValue`, `setGeoportalStateValue`, `clearGeoportalStateValue`, incluindo `userLonLat`.
- `getActivePopupSource`, `setActivePopupSource`, `clearActivePopupSource`.
- `getNextPopupSource`, `setNextPopupSource`, `clearNextPopupSource`.

Ponto de atencao:

- O modulo usa um objeto singleton. Os testes precisam limpar o estado entre casos para evitar vazamento de estado.

### `src/geoportal-notice.js`

- `showGeoportalNotice(options)`
  - Candidato a testes com jsdom, nao como primeira etapa.
  - Verificar retorno `null` sem mensagem.
  - Verificar normalizacao de tipo e posicao.
  - Verificar cooldown.
  - Verificar criacao de container e elemento de aviso.

### `src/geoportal-search-utils.js`

Helpers de endereco ja extraidos de `src/geoportal-search.js`:

- `parseEnderecoQuery`;
- `buildRuaCandidatesCqlFilter`;
- `buildEnderecoCqlFilter`;
- `extractNumeroFromEndereco`;
- `findClosestAddressFeature`;

Essas funcoes sao puras, nao dependem de DOM, OpenLayers ou GeoServer, e devem permanecer cobertas por testes unitarios.

### `src/geoportal-search.js`

Funcoes internas candidatas no futuro:

- fluxos completos de busca por endereco, BIC, poste e fazenda com mocks ou testes de integracao.

Ponto de atencao:

- Os fluxos completos ainda dependem de DOM, OpenLayers, GeoServer, camadas e popups. Nao testar em unitario sem uma etapa propria de isolamento.

### `src/geoportal-mapclick.js`

- A prioridade de popup e a montagem de blocos sao criticas, mas hoje estao dentro do handler completo.
- Nao e bom primeiro alvo de teste unitario.
- Futuramente, pode valer extrair uma funcao pura para decidir qual HTML/coord abrir a partir de `posteHtml`, `farmaciaHtml`, `localInteresseHtml`, `loteHtml`, `edificacoesHtml` etc.

Ponto de atencao:

- A regra de Edificacoes sozinha deve continuar coberta por teste manual ate existir uma funcao pura de prioridade.

### `src/geoportal-popup.js`

- `closeLotesPopup` e `showLotesPopup` dependem de OpenLayers Overlay, DOM e objeto `map`.
- Nao devem ser prioridade para unitarios.
- Podem receber testes futuros com mocks de mapa/overlays, mas o risco de teste fragil e alto.

### Funcoes de telefone/WhatsApp em farmacias e locais de interesse

Existem helpers internos em:

- `src/geoportal-farmacias.js`: formatacao de WhatsApp e geracao de `wa.me`.
- `src/geoportal-locais-interesse.js`: limpeza de telefone, formatacao, `tel:` e WhatsApp.

Ponto de atencao:

- Essas funcoes nao estao na lista principal da etapa, mas sao bons candidatos futuros. Hoje varias sao internas; exportar ou mover para utilitario compartilhado deve ser uma decisao separada.

## 5. O que NAO testar em unitario agora

Nao priorizar testes unitarios para:

- renderizacao real do OpenLayers;
- WMS/WFS real contra GeoServer;
- clique completo no mapa;
- overlay real de popup;
- impressao real;
- geolocalizacao real;
- medicao real;
- carregamento real de tiles WMS;
- comportamento visual/mobile;
- navegacao real para Google Maps, WhatsApp ou Google Forms.

Esses fluxos continuam no checklist manual e, no futuro, podem ser cobertos por testes end-to-end controlados.

## 6. Ordem sugerida de implementacao

1. Instalar/configurar Vitest, se ainda nao existir.
   - Adicionar script `test` em `package.json`.
   - Definir ambiente inicial preferencialmente `node`.
   - Usar `jsdom` apenas quando comecarem testes de DOM.

2. Testar `src/geoportal-utils.js`.
   - Primeiro `escapeHtml` e `getGeoServerErrorMessage`.
   - Depois `fetchWithTimeout` com mock de `fetch` e timers falsos.

3. Testar `src/geoportal-routes.js`.
   - Passar origem explicitamente para evitar dependencia de estado global.
   - Cobrir destino invalido, destino valido e origem + destino.

4. Testar `buildPosteRepairFormUrl` em `src/geoportal-postes-reparo.js`.
   - Cobrir parametros presentes/ausentes e encoding.
   - Adicionar `calculateDistance` na mesma etapa se for barato.

5. So depois avaliar funcoes de busca/endereco.
   - Primeiro decidir se vale extrair helpers internos de `setupSearchHandlers`.
   - Fazer diff pequeno, sem alterar comportamento.

6. So depois avaliar testes de integracao.
   - Mocks de OpenLayers e GeoServer.
   - Ou Playwright com rede interceptada.

## 7. Riscos

- Exportar funcao interna pode aumentar acoplamento se feito sem criterio.
- Testes nao devem exigir GeoServer online.
- Testes nao devem depender de DOM real, salvo quando necessario e em ambiente controlado.
- Testes nao devem depender de horario, data atual ou localizacao real sem mocks.
- Nao mudar comportamento para "facilitar teste".
- Evitar snapshots grandes de HTML: eles quebram com mudancas pequenas e nao necessariamente validam comportamento.
- Cuidado com singletons como `geoportal-state.js`: limpar estado entre testes.
- `fetchWithTimeout` depende de `window.setTimeout`; o setup do Vitest precisa refletir o ambiente real ou a funcao deve ser testada com ambiente adequado.

## 8. Convencoes propostas

- Usar Vitest.
- Nomear arquivos como `.test.js`.
- Preferir testes perto do codigo quando o modulo for pequeno:
  - `src/geoportal-utils.test.js`;
  - `src/geoportal-routes.test.js`;
  - `src/geoportal-postes-reparo.test.js`.
- Alternativa aceitavel: pasta `tests/` espelhando os modulos.
- Usar mocks para `fetch`.
- Usar timers falsos para timeout.
- Evitar snapshots grandes de HTML de popup nesta fase.
- Testar URLs com `URL` e `URLSearchParams` quando possivel, em vez de comparar strings longas.
- Manter fixtures pequenas e legiveis.
- Cada teste deve validar uma regra de negocio clara.

## 9. Checklist antes de implementar testes

- [ ] Rodar `npm.cmd run build`.
- [ ] Confirmar que nao ha mudancas funcionais misturadas com configuracao de testes.
- [ ] Quando configurado, rodar `npm.cmd test`.
- [ ] Buscar BIC.
- [ ] Buscar endereco.
- [ ] Buscar poste.
- [ ] Clicar em lote.
- [ ] Clicar em edificacao sozinha.
- [ ] Clicar em lote + edificacao.
- [ ] Clicar em farmacia.
- [ ] Clicar em local de interesse.
- [ ] Clicar em poste e Solicitar Reparo.
- [ ] Testar rota.
- [ ] Testar medicao.
- [ ] Testar geolocalizacao.
- [ ] Testar impressao.
- [ ] Testar mobile.

## 9. Primeira etapa recomendada

O primeiro arquivo a testar deve ser `src/geoportal-utils.js`.

Motivos:

- ja exporta funcoes pequenas e compartilhadas;
- nao depende de OpenLayers;
- protege seguranca basica (`escapeHtml`);
- protege experiencia de erro de rede (`getGeoServerErrorMessage`);
- prepara o padrao de mock para `fetchWithTimeout`, que e usado em busca, clique no mapa, postes e farmacias;
- tem baixo risco de exigir refatoracao.

Primeiro conjunto recomendado:

- `escapeHtml` com caracteres especiais, `null`, `undefined` e numero;
- `getGeoServerErrorMessage` para timeout e erro generico;
- `fetchWithTimeout` somente depois que o setup de mock/timers estiver claro.

Depois disso, seguir para `src/geoportal-routes.js` e `buildPosteRepairFormUrl`.

## Cobertura futura da seguranca administrativa

Auditoria administrativa, anti-autoelevacao e protecao do ultimo administrador foram implementadas e testadas localmente no commit `9f6ec75`. A cobertura inclui:

- usuario sem permissao administrativa recebe `403`;
- administrador nao consegue conceder a si mesmo perfil ou permissao superior;
- administrador nao consegue alterar ou remover seu proprio perfil critico quando a regra proibir;
- sistema nao permite desativar, bloquear ou excluir logicamente o ultimo administrador efetivo;
- sistema nao permite remover perfil ou revogar permissao critica do ultimo administrador efetivo;
- tentativa negada gera evento de auditoria administrativa com motivo seguro;
- mutacao bem-sucedida e auditoria obrigatoria pertencem a mesma transacao;
- payload com campo extra e rejeitado;
- senha, hash, token, cookie, `session_secret`, `DATABASE_URL` e payload sensivel nao aparecem na auditoria;
- concorrencia entre duas operacoes nao permite race condition simples que remova simultaneamente os ultimos administradores;
- endpoints read-only nao retornam `senha_hash`, token, cookie, segredo, SQL ou role de banco;
- permissoes administrativas sao verificadas no backend, independentemente da visibilidade do frontend.

Testes transacionais devem simular pelo menos dois administradores efetivos e duas operacoes concorrentes sobre seus vinculos. A estrategia de lock escolhida deve ser demonstrada pelos testes, sem depender apenas de contagem feita antes da transacao.

Atualizacao local: foram adicionados testes de migration, append-only, sanitizacao, preservacao da categoria `admin.user.reset_password`, auditoria de sucesso e negativa, autoatribuicao administrativa, auto-bloqueio, reset administrativo da propria senha e bloqueio do ultimo administrador efetivo. Os testes tambem confirmam que eventos negados sao commitados antes da excecao convertida em `403`, sem rollback, e que eventos de sucesso permanecem na transacao da mutacao. A suite focada de auth/admin passou com `219 passed`; os testes diretamente afetados passaram com `140 passed`; a suite backend completa passou com `716 passed` e `3 warnings` conhecidos de deprecacao do `HTTP_422_UNPROCESSABLE_ENTITY`.

Permanece futura a cobertura de endpoints de remocao de perfil e revogacao de permissao, pois esses contratos mutaveis ainda nao existem.

### Validacao funcional em homologacao - 2026-06-25

Depois dos testes locais, a migration `0011` foi aplicada de forma controlada somente em `amambaiGis_homologacao`, com backup manual previo. A estrutura iniciou com zero eventos e terminou com tres registros:

- `admin.user.create`, resultado `sucesso`, entidade `usuario`, id `11`;
- `admin.user.disable`, resultado `sucesso`, entidade `usuario`, id `11`;
- `admin.security.denied_self_change`, resultado `negada`, entidade `usuario`, id `7`, motivo interno `self_block`.

O usuario ficticio `zz_admin_audit_probe_20260625075205` permaneceu bloqueado. A tentativa de auto-bloqueio retornou `403 {&#34;detail&#34;:&#34;Forbidden&#34;}`, sem expor a regra interna; o motivo tecnico permaneceu somente na auditoria.

A verificacao dos campos auditados retornou zero registros contendo `token`, `cookie`, `hash`, `session_secret`, `database_url` ou `senha_inicial`. O servico interno de homologacao passou no harness de restart/validate, e `/api/internal/auth/me` continuou protegido com `401` sem sessao.

Esta validacao nao representa aplicacao em producao. A etapa de producao deve repetir backup, migration controlada, GRANT minimo, harness e verificacoes funcionais equivalentes.

### Validacao funcional em producao - 2026-06-25

A etapa equivalente foi executada no banco `amambaiGis` e na API interna de producao depois de backup manual. Por causa do cookie `Secure`, o login e as operacoes autenticadas foram exercitados via HTTPS.

A estrutura iniciou com zero eventos e terminou com tres registros:

- `admin.user.create`, resultado `sucesso`, entidade `usuario`, id `3`;
- `admin.user.disable`, resultado `sucesso`, entidade `usuario`, id `3`;
- `admin.security.denied_self_change`, resultado `negada`, entidade `usuario`, id `1`, motivo interno `self_block`.

O usuario ficticio `zz_admin_audit_prod_probe_20260625084805` permaneceu bloqueado. A tentativa de auto-bloqueio retornou `403 {&#34;detail&#34;:&#34;Forbidden&#34;}`, o logout foi confirmado e a verificacao de privacidade encontrou zero registros com `token`, `cookie`, `hash`, `session_secret`, `database_url` ou `senha_inicial` nos campos auditados.

O harness com restart e a validacao final sem restart passaram. Esse marco confirma a auditoria administrativa em producao, mas nao substitui testes e salvaguardas especificos para futuros endpoints administrativos.

### Cobertura local - desativacao administrativa de vinculos usuario/perfil

O commit `9173259 Implementa desativacao administrativa de perfis de usuarios` adicionou cobertura local para o complemento de CRUD administrativo de vinculos usuario/perfil.

Cobertura reportada:

- listagem sanitizada de vinculos do usuario;
- usuario inexistente retornando `404`;
- desativacao valida de vinculo global e por modulo quando aplicavel;
- rejeicao de campo extra, justificativa ausente e justificativa curta com `422`;
- ausencia de `X-Geoportal-Internal-Request` com `403`;
- ausencia de `admin.usuarios.remover_perfis` com `403`;
- vinculo inexistente com `404` e vinculo ja inativo com `409`;
- auto-rebaixamento negado com `403` e auditoria persistida;
- remocao que deixaria zero administradores efetivos negada com `403` e auditoria persistida;
- remocao permitida quando existe outro administrador efetivo ou outro vinculo critico ativo;
- auditoria de sucesso atomica com `ativo=false`;
- auditoria negada persistida antes do `403`;
- ausencia de `DELETE` em `mod_auth.usuario_perfis`;
- `UPDATE` tecnico restrito a `ativo=false` do vinculo alvo;
- bootstrap idempotente de `admin.usuarios.remover_perfis`, sem conceder a perfis operacionais.

Resultados locais reportados: focados diretos `50 passed`, administrativos ampliados `269 passed`, suite backend completa `742 passed` e `3 warnings` conhecidos de deprecacao de `HTTP_422_UNPROCESSABLE_ENTITY`.

Validacao operacional concluida em 2026-06-26: homologacao primeiro, seguida de producao interna em ciclo separado, com bootstrap controlado da permissao, GRANT minimo de `UPDATE (ativo)` em `mod_auth.usuario_perfis`, sem `DELETE`.

### Validacao funcional em homologacao - desativacao de vinculos usuario/perfil

Em 2026-06-26, a desativacao administrativa de vinculos usuario/perfil foi validada em `InternaHomologacao`.

Cenarios confirmados:

- OpenAPI publicou `GET /api/internal/admin/users/{usuario_id}/profiles` e `POST /api/internal/admin/users/{usuario_id}/profiles/{perfil_id}/deactivate`;
- `/auth/me` de `admin.homologacao` confirmou `admin.usuarios.remover_perfis`;
- GET de vinculos do admin retornou o perfil `administrador-interno-geoportal` ativo;
- auto-rebaixamento do admin retornou `403`, manteve vinculo ativo e registrou `admin.security.denied_self_demotion` com motivo `self_demotion`;
- usuario ficticio `zz_profile_deactivate_probe_20260626085536` recebeu perfil `manutencao-iluminacao` com `201`, foi desativado com `200`, ficou `ativo=false/f` e registrou `admin.user.remove_profile`;
- segunda desativacao do mesmo vinculo retornou `409`;
- logout retornou `200`.

A validacao de privilegios confirmou `DELETE=f`, table `UPDATE=f` e `UPDATE(ativo)=t` em `mod_auth.usuario_perfis`, preservando `INSERT=t` para a funcionalidade ja existente de atribuicao de perfil.

### Validacao funcional em producao interna - desativacao de vinculos usuario/perfil

Em 2026-06-26, a desativacao administrativa de vinculos usuario/perfil foi validada em `InternaProducao`, no servico `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, banco `amambaiGis`, runtime `geoportal_api_interna_prod`, com `APP_ENV=producao` e cookie interno `Secure` ativo. O backup manual previo registrado foi `C:\apps\geoportal-api\backups\manual\pre_desativacao_perfis_admin_amambaiGis_20260626_092442.sql`, com 249.202.757 bytes.

Cenarios confirmados:

- inventario previo: `admin.usuarios.remover_perfis` nao existia em producao e nenhum perfil a possuia;
- bootstrap real com `bootstrap_internal_admin_profile.py --login admin.producao` criou a permissao `id=19` e vinculou somente ao perfil `administrador-interno-geoportal`;
- `manutencao-iluminacao` permaneceu sem `admin.usuarios.remover_perfis`;
- harness `InternaProducao -Validate` passou antes e depois; apos restart controlado do servico, `/api/health`, `/api/version` e `/api/internal/auth/me` sem sessao mantiveram os resultados esperados;
- OpenAPI local confirmou `GET,POST /api/internal/admin/users/{usuario_id}/profiles` e `POST /api/internal/admin/users/{usuario_id}/profiles/{perfil_id}/deactivate`;
- login HTTPS de `admin.producao` retornou `200`, `/auth/me` confirmou permissao `admin.usuarios.remover_perfis`, e GET dos proprios vinculos retornou `administrador-interno-geoportal` ativo;
- auto-rebaixamento `POST /api/internal/admin/users/1/profiles/1/deactivate` retornou `403`, manteve o vinculo do admin ativo e registrou auditoria `admin.security.denied_self_demotion` com motivo `self_demotion`;
- usuario ficticio `zz_profile_deactivate_prod_20260626094758` (`id=4`) recebeu `manutencao-iluminacao` (`perfil_id=2`) com `201`, foi desativado com `200`, ficou `ativo=false/f` e registrou auditoria `admin.user.remove_profile`;
- segunda desativacao do mesmo vinculo retornou `409`;
- usuario ficticio foi bloqueado ao final com `bloqueado=true`, e o vinculo desativado permaneceu `ativo=f`;
- usuario real `manutencao.producao` nao foi alterado;
- login sem campo `login`, com senha ficticia, retornou `422`;
- raw JSON da listagem do vinculo inativo retornou explicitamente `"ativo": false`;
- logout retornou `200` nos fluxos autenticados.

A validacao de privilegios finais confirmou menor privilegio para `geoportal_api_interna_prod`: `mod_auth.usuario_perfis` com `SELECT=t`, `INSERT=t`, table `UPDATE=f`, `UPDATE(ativo)=t` e `DELETE=f`; `mod_auth.permissoes` sem `INSERT`/`UPDATE`; `mod_auth.perfil_permissoes` sem `INSERT`/`UPDATE`. O `INSERT` em `usuario_perfis` permanece necessario para o endpoint ja existente de atribuicao de perfil, enquanto a desativacao logica acrescenta somente `UPDATE(ativo)`.

Resultado: producao interna validada com sucesso e funcionalidade operacional no backend/API. UI administrativa para este CRUD complementar deve ser planejada separadamente, se houver necessidade futura.

### Publicacao frontend - tela administrativa MVP de usuarios internos

A tela administrativa MVP de usuarios internos foi publicada no commit `be3d2e7 Adiciona tela administrativa de usuarios internos`, depois do marco `acda7c0 Documenta validacao em producao da desativacao administrativa de perfis`.

Escopo validado antes do commit: alteracoes somente no frontend interno (`geoportal-vite/src/internal-iluminacao-shell.js`, `geoportal-vite/src/internal-iluminacao-shell.css` e `geoportal-vite/src/internal-iluminacao-shell.test.js`). Nao houve backend novo, migration, banco, scripts, `.env`, Apache, NSSM, configuracao de servico, deploy de API ou restart da API.

Validacoes locais registradas:

- `npm.cmd test -- internal-iluminacao-shell.test.js`: 78 testes passaram;
- `npm.cmd run build`: passou;
- scanner de mojibake no JS: OK;
- `git diff --check`: sem erros, apenas avisos LF/CRLF do Windows.

A publicacao operacional foi manual: build local no PC de desenvolvimento, compactacao em `.rar`, envio ao servidor e extracao nas pastas estaticas corretas, sem build no servidor. A URL publicada foi `https://geoserver.amambai.ms.gov.br/interno/`.

Validacao visual em producao interna com `admin.producao`: login OK, menu `Administração do Sistema` habilitado, tela `Administração` abrindo corretamente, busca/lista de usuarios aparecendo, usuarios reais visiveis, textos principais sem mojibake e layout administrativo melhorado.

Funcionalidades cobertas pelo MVP: listagem de usuarios internos, pesquisa por nome/login/e-mail, selecao de usuario, detalhe basico, listagem de vinculos usuario/perfil, criacao de usuario, bloqueio, desbloqueio via `POST /api/internal/admin/users/{id}/unblock`, redefinicao de senha, atribuicao de perfil e desativacao logica de vinculo usuario/perfil. As chamadas mantem `credentials: include`; mutacoes mantem `X-Geoportal-Internal-Request: 1`; a tela nao usa `localStorage`, `sessionStorage` ou token armazenado; e as acoes continuam condicionadas por permissoes administrativas.

Ressalvas de teste e escopo: o MVP usa RBAC por perfis e nao implementa permissoes individuais por usuario. Criar/editar perfis e permissoes diretamente pela UI, perfil Prefeito/gestor somente leitura, mapa operacional da manutencao e ordenamentos/filtros avancados da lista de chamados permanecem fora deste ciclo e devem ter planos/testes proprios.

### Cobertura local - bootstrap de perfis RBAC de consulta global e administracao de Iluminacao

A implementacao local do bootstrap dos perfis `gestor-consulta-global` e `administrador-modulo-iluminacao` adicionou testes focados em `geoportal-backend/tests/test_bootstrap_internal_authorization_profiles_admin.py`.

Cobertura principal:

- script executa a partir da raiz do backend sem `PYTHONPATH` externo;
- `--dry-run` nao chama repository nem persiste alteracoes;
- fluxo padrao processa os dois perfis e `--profile` processa perfil unico;
- nomes/chaves dos perfis sao os esperados;
- `gestor-consulta-global` nao recebe mutacoes nem `admin.*`;
- `administrador-modulo-iluminacao` recebe apenas permissoes do modulo e nenhuma `admin.*`;
- bootstrap e idempotente quando perfil/vinculos ja existem;
- cria perfil e vinculos sem criar permissoes nem usuarios;
- permissao candidata inexistente falha com erro claro;
- seeds nao contem senha, token, hash, `session_secret` ou `DATABASE_URL`.

Validacoes locais executadas nesta rodada: teste novo isolado com 12 passed; testes focados de bootstrap novo, administrativo e manutencao com 36 passed.

### Cobertura local - bootstrap administrativo da permissao iluminacao.dashboard.ler

A correcao local do bootstrap administrativo adicionou cobertura para garantir que `bootstrap_internal_admin_profile.py` cria `iluminacao.dashboard.ler` quando ausente, mantem idempotencia quando existente, vincula a permissao ao perfil `administrador-interno-geoportal` pelo fluxo normal de `perfil_permissoes` e nao inclui a permissao no perfil `manutencao-iluminacao`.

Os testes tambem preservam a garantia de que os novos perfis de autorizacao nao criam permissoes novas por conta propria: eles continuam falhando claramente quando uma permissao candidata, como `iluminacao.dashboard.ler`, nao existir previamente.

### Cobertura local - internal.auth.me no administrador do modulo Iluminacao

A cobertura do bootstrap `bootstrap_internal_authorization_profiles.py` foi reforcada para falhar se algum plano de perfil desse script nao incluir `internal.auth.me` ou incluir permissao `admin.*`. Tambem foi adicionado teste de regressao simulando `administrador-modulo-iluminacao` ja existente com o vinculo de `internal.auth.me` ausente; o bootstrap deve criar exatamente esse vinculo em `perfil_permissoes`, sem criar permissao nova e sem usar `DELETE` ou `UPDATE`.

### Validacao funcional em homologacao - bootstraps RBAC de perfis de autorizacao

Em 2026-06-29, com o servidor alinhado ao commit `bd50401 Garante auth me nos perfis de autorizacao`, foram homologados os bootstraps RBAC dos perfis `gestor-consulta-global` e `administrador-modulo-iluminacao` em `amambaiGis_homologacao`. O backup manual previo foi `C:\apps\geoportal-api\backups\manual\pre_bootstrap_perfis_autorizacao_amambaiGis_homologacao_20260629_080619.sql`, com `249012192` bytes.

Testes focados no servidor: `tests/test_bootstrap_internal_admin_profile_admin.py`, `tests/test_bootstrap_internal_authorization_profiles_admin.py` e `tests/test_bootstrap_internal_maintenance_profile_admin.py`, totalizando 39 itens executados sem falha reportada.

Fase 1: com GRANT temporario em `mod_auth.permissoes` e `mod_auth.perfil_permissoes`, o script `bootstrap_internal_admin_profile.py --login admin.homologacao` garantiu `iluminacao.dashboard.ler`, vinculou ao perfil `administrador-interno-geoportal` e preservou `manutencao-iluminacao` sem essa permissao. Os GRANTs temporarios foram revogados e os privilegios finais ficaram fechados.

Fase 2: com GRANT temporario minimo para perfis e vinculos, `bootstrap_internal_authorization_profiles.py --profile all` criou `gestor-consulta-global` (`id=5`, ativo) e `administrador-modulo-iluminacao` (`id=6`, ativo), ambos sem `admin.*`. A correcao posterior do commit `bd50401` completou o vinculo `internal.auth.me` faltante em `administrador-modulo-iluminacao` no rerun controlado.

Validacao final: `administrador-modulo-iluminacao` retornou `admin_permissoes=0`, `auth_me=1` e `prioridade=1`; `gestor-consulta-global` retornou `admin_permissoes=0` e `auth_me=1`. O dry-run final do administrador do modulo listou `internal.auth.me`, `iluminacao.dashboard.ler`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_historico`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar`, `iluminacao.solicitacoes.atualizar_status`, `iluminacao.solicitacoes.atualizar_prioridade` e `iluminacao.solicitacoes.corrigir_status`.

Estado final de privilegios de `geoportal_api_homolog`: `mod_auth.perfis` com `INSERT=false`, `UPDATE=false`; `mod_auth.perfil_permissoes` com `INSERT=false`, `UPDATE=false`, `DELETE=false`. Nao houve migration estrutural, endpoint novo, frontend, Apache, NSSM, `.env`, deploy ou restart de API.

### Validacao funcional em producao interna - bootstraps RBAC de perfis de autorizacao

Em 2026-06-29, com o servidor alinhado ao commit `a1abb6d Documenta homologacao dos perfis RBAC internos`, foram executados e validados em producao interna os bootstraps dos perfis `gestor-consulta-global` e `administrador-modulo-iluminacao` no banco `amambaiGis`, em `127.0.0.1:5434`, com `APP_ENV=producao`, `DATABASE_USER=geoportal_api_interna_prod` e `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=true`.

Inventario previo: `administrador-interno-geoportal` (`id=1`) e `manutencao-iluminacao` (`id=2`) ja existiam; os novos perfis ainda nao existiam; `iluminacao.dashboard.ler` ja existia e estava ativa; todas as permissoes candidatas estavam existentes e ativas; `geoportal_api_interna_prod` tinha somente leitura nas tabelas de perfis/permissoes/vinculos de perfil-permissao, com escrita fechada.

Backup manual previo: `C:\apps\geoportal-api\backups\manual\pre_bootstrap_perfis_autorizacao_amambaiGis_20260629_094941.sql`, tamanho `249145986` bytes. O dry-run `bootstrap_internal_authorization_profiles.py --profile all --dry-run` passou sem alterar dados.

A execucao real usou GRANT temporario minimo: `INSERT` em `mod_auth.perfis`, `INSERT` em `mod_auth.perfil_permissoes` e `USAGE, SELECT` temporario na sequence de `mod_auth.perfis`, sem `UPDATE` e sem `DELETE`. O comando `bootstrap_internal_authorization_profiles.py --profile all` concluiu com sucesso e criou `gestor-consulta-global` (`id=3`, ativo) e `administrador-modulo-iluminacao` (`id=4`, ativo).

Matriz validada: `gestor-consulta-global` recebeu `internal.auth.me`, `iluminacao.dashboard.ler`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_historico` e `iluminacao.solicitacoes.ver_observacoes`, sem `admin.*` e sem mutacoes. `administrador-modulo-iluminacao` recebeu `internal.auth.me`, `iluminacao.dashboard.ler`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_historico`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar`, `iluminacao.solicitacoes.atualizar_status`, `iluminacao.solicitacoes.atualizar_prioridade` e `iluminacao.solicitacoes.corrigir_status`, sem `admin.*`.

Validacao agregada: `admin_permissoes=0` para ambos, `auth_me=1` para ambos, `prioridade=1` para `administrador-modulo-iluminacao` e `prioridade=0` para `gestor-consulta-global`. Apos revogacao, os privilegios finais ficaram `perfis_insert=false`, `perfil_permissoes_insert=false`, `perfis_update=false`, `perfil_permissoes_update=false` e `perfil_permissoes_delete=false`.

Nao houve migration estrutural, endpoint novo, frontend, Apache, NSSM, `.env`, deploy ou restart de API. Proximos testes recomendados dependem de atribuicao real pela tela administrativa: login com usuario gestor e usuario administrador de modulo, sem menu Administracao do Sistema, com dashboard/listas conforme permissoes, gestor sem acoes mutaveis e administrador do modulo com acoes do modulo sem administracao global.

### Validacao funcional em producao - usuarios reais vinculados aos novos perfis RBAC

Depois da criacao e validacao dos perfis `gestor-consulta-global` (`id=3`) e `administrador-modulo-iluminacao` (`id=4`) em producao interna, foram criados/vinculados pela UI administrativa os usuarios reais `sergio` (`usuario_id=6`) e `seleido.admin` (`usuario_id=8`). SQL de confirmacao mostrou ambos ativos, sem bloqueio e com vinculos ativos aos respectivos perfis.

Para `sergio`, com perfil `gestor-consulta-global`, a validacao visual confirmou login OK, Dashboard disponivel, Iluminacao Publica disponivel, Administracao do Sistema ausente, tela de solicitacoes como `Somente leitura`, alteracao de prioridade indisponivel, criacao de observacao indisponivel e ausencia de acoes mutaveis do modulo.

Para `seleido.admin`, com perfil `administrador-modulo-iluminacao`, a validacao visual confirmou login OK, Dashboard disponivel, Iluminacao Publica disponivel, Administracao do Sistema ausente e acoes operacionais do modulo disponiveis conforme perfil: observacoes, alteracao de fase/status, alteracao de prioridade e correcao administrativa/volta de fase.

Resultado: o frontend refletiu as permissoes efetivas do backend/RBAC, perfis operacionais permaneceram sem `admin.*` e a Administracao do Sistema continuou restrita ao administrador interno global. Nao houve migration, deploy, restart, endpoint novo, frontend novo, Apache, NSSM ou `.env`.

Proximos testes/ciclos: mapa operacional por modulo, ordenacao/filtros avancados da lista, ajustes finos de UX por perfil se necessario e replicacao do modelo para futuros modulos internos.
