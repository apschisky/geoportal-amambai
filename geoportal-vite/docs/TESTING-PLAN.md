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

## 3. Funcoes candidatas a testes unitarios

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

Essas funcoes sao puras, nao dependem de DOM, OpenLayers ou GeoServer, e devem permanecer cobertas por testes unitarios.

### `src/geoportal-search.js`

Funcoes internas candidatas no futuro:

- `findClosestAddressFeature`.

Ponto de atencao:

- `findClosestAddressFeature` ainda esta interna a `setupSearchHandlers`. Para testa-la, seria preciso isola-la ou exporta-la em etapa propria, junto com suas constantes de tolerancia. Nao fazer isso apenas para satisfazer teste sem avaliar impacto de acoplamento.

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

## 4. O que NAO testar em unitario agora

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

## 5. Ordem sugerida de implementacao

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

## 6. Riscos

- Exportar funcao interna pode aumentar acoplamento se feito sem criterio.
- Testes nao devem exigir GeoServer online.
- Testes nao devem depender de DOM real, salvo quando necessario e em ambiente controlado.
- Testes nao devem depender de horario, data atual ou localizacao real sem mocks.
- Nao mudar comportamento para "facilitar teste".
- Evitar snapshots grandes de HTML: eles quebram com mudancas pequenas e nao necessariamente validam comportamento.
- Cuidado com singletons como `geoportal-state.js`: limpar estado entre testes.
- `fetchWithTimeout` depende de `window.setTimeout`; o setup do Vitest precisa refletir o ambiente real ou a funcao deve ser testada com ambiente adequado.

## 7. Convencoes propostas

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

## 8. Checklist antes de implementar testes

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
