# Arquitetura Front-end do Geoportal de Amambai

Este documento registra a arquitetura atual do front-end do Geoportal de Amambai. Ele foi escrito para orientar manutencao segura em producao e deve ser atualizado quando houver mudancas estruturais relevantes.

## 1. Visao geral

O front-end do Geoportal e uma aplicacao modular baseada em Vite, OpenLayers e JavaScript ES Modules. A aplicacao roda no navegador, monta um mapa OpenLayers e consome dados geograficos publicados no GeoServer, com base de dados espacial mantida no PostGIS.

As camadas principais sao exibidas por WMS. Consultas de atributos e selecao espacial usam GetFeatureInfo e WFS, conforme o fluxo: clique no mapa, busca textual, farmacias de plantao, postes e imoveis rurais. O front-end tambem integra servicos externos como Google Maps, WhatsApp e Google Forms.

## 2. Stack

- Vite: empacotamento e build do front-end.
- OpenLayers: mapa, camadas, overlays, interacoes, medicao, coordenadas e transformacoes de CRS.
- JavaScript ES Modules: organizacao modular em `src/geoportal-*.js`.
- GeoServer: publicacao de WMS, WFS, GetFeatureInfo e legendas.
- PostGIS: armazenamento e consulta dos dados geograficos no backend geoespacial.
- Apache/Tomcat: ambiente esperado para servir aplicacao estatico/GeoServer em producao.
- npm: build de producao com `npm.cmd run build` no Windows.

## 3. Fluxo de inicializacao

O arquivo `src/main.js` e o ponto de entrada da aplicacao. Ele aguarda `DOMContentLoaded` e coordena a montagem dos modulos.

Responsabilidades principais:

- cria o mapa com `initMap('map')`, incluindo mapa OSM, satelite Esri e limites de zoom;
- cria todas as camadas configuradas com `createAllLayers()`;
- adiciona camadas ao mapa em uma ordem controlada por `layerOrder`;
- inicializa a camada vetorial de destaque das farmacias de plantao;
- registra camadas especiais, como pavimentacao;
- conecta checkboxes do painel de camadas a `setLayerVisibility`;
- atualiza legendas dinamicas com `atualizarLegendas`;
- inicializa medicao de distancia e area;
- inicializa busca por BIC, endereco, poste e fazenda;
- inicializa impressao;
- inicializa comportamento de UI, painel de camadas e barra publica;
- inicializa geolocalizacao;
- registra botoes de rota de farmacias;
- mostra avisos iniciais de servicos;
- registra eventos de coordenadas do mouse e clique no mapa;
- chama `setupMapClickHandler` para a logica de popup/selecao;
- controla troca de mapa base OSM/satelite.

A barra publica e montada no proprio `main.js`, usando `data-layer-shortcut` e `data-action` presentes no HTML para ativar camadas, abrir painel de camadas/mapa base e limpar camadas ativas.

## 4. Configuracao de camadas

### `src/geoportal-config.js`

Centraliza a configuracao de camadas e legendas.

`LAYER_CONFIG` define, por camada:

- chave interna usada pelo front-end, como `layer3`, `layer_edificacoes` e `layer_postes`;
- URL WMS do GeoServer;
- `layerName` real no GeoServer;
- CRS quando a camada exige projecao especifica;
- uso de `singleImage` em camadas que precisam de `ImageWMS`, como coleta.

`LEGEND_CONFIG` define o titulo publico e a URL de GetLegendGraphic para as legendas. O mesmo arquivo tambem guarda `POSTE_FORM_CONFIG`, com URL e campos do Google Forms usados no fluxo de Solicitar Reparo.

### `src/geoportal-layers.js`

Transforma `LAYER_CONFIG` em camadas OpenLayers.

- `createLayer` cria `TileLayer` com `TileWMS` por padrao.
- Quando `singleImage` esta ativo, cria `ImageLayer` com `ImageWMS`.
- `registerLayerLoadErrorNotice` registra avisos de erro de carregamento de tiles/imagens com cooldown.
- `createAllLayers` cria o dicionario de camadas.
- `addLayersToMap` adiciona camadas na ordem definida em `main.js`.
- `setLayerVisibility` liga/desliga a visibilidade de cada camada.

Camadas especiais e com comportamento adicional incluem:

- Lotes (`layer3`): popup cadastral e buscas por BIC/endereco.
- Edificacoes (`layer_edificacoes`): popup proprio e combinacao com Lotes quando ambas estao ativas.
- Postes (`layer_postes`): consulta por clique/busca, rota e Google Forms de reparo.
- Farmacias (`layer_farmacias`): WMS base, camada vetorial de destaque e popup moderno.
- Locais de interesse (`layer_assistencia_social`, `layer_educacao`, `layer_prefeitura`, `layer_saude`): popup moderno com contato/rota.
- Coleta (`layer_coleta`) e Coleta Seletiva (`layer_coleta_seletiva`): configuradas como imagem unica para evitar repeticao de rotulos por tile.

## 5. Clique no mapa e popups

### `src/geoportal-mapclick.js`

Concentra a logica do clique no mapa. O handler consulta `getMeasureActive()` para ignorar cliques durante a medicao, monta consultas para camadas visiveis e decide qual popup abrir.

Fluxo em alto nivel:

- remove destaque anterior;
- cria uma camada vetorial temporaria de destaque;
- consulta camadas WMS por GetFeatureInfo;
- consulta postes via WFS com buffer;
- consulta farmacias e locais de interesse quando suas camadas estao visiveis;
- monta HTML dos blocos de popup;
- adiciona destaque ao mapa quando ha feicoes;
- ajusta zoom/fit conforme prioridade;
- marca `nextPopupSource` com `setNextPopupSource('mapclick')`;
- chama `showLotesPopup`.

Prioridade atual de popup:

1. Postes.
2. Farmacias.
3. Locais de interesse.
4. Lote + Eixo.
5. Eixo.
6. Lote + Zoneamento.
7. Lote + Edificacoes.
8. Lote + Coleta.
9. Lote.
10. Edificacoes.
11. Zoneamento.
12. Coleta.
13. Outras camadas.

Edificacoes deve funcionar sozinha e tambem manter o comportamento combinado com Lotes. Esse ponto ja foi corrigido recentemente em `geoportal-mapclick.js`.

### `src/geoportal-popup.js`

Gerencia o overlay do popup:

- fecha popup existente com `closeLotesPopup`;
- cria `Overlay` do OpenLayers;
- define posicionamento conforme o tipo do popup;
- usa `ultimoPopupHtml` para suporte a impressao;
- permite arrastar o popup por mouse e toque;
- centraliza `activePopupSource` e `nextPopupSource` via helpers de `geoportal-state.js`.

Embora o nome `showLotesPopup` seja historico, ele hoje e usado por varios tipos de popup: lotes, edificacoes, farmacias, postes, locais de interesse e outros blocos de atributos.

### `src/geoportal-state.js`

Mantem estado compartilhado do front-end. Nesta fase, o estado de popup foi centralizado gradualmente:

- `getActivePopupSource`;
- `setActivePopupSource`;
- `clearActivePopupSource`;
- `getNextPopupSource`;
- `setNextPopupSource`;
- `clearNextPopupSource`.

Tambem existem acessos genericos por chave, usados por `ultimoPopupHtml` e `userLonLat`.

### Sanitizacao

Os HTMLs de popup usam `escapeHtml` para valores vindos do GeoServer. Isso e essencial porque os dados de atributos podem conter texto externo ao front-end.

## 6. Busca

`src/geoportal-search.js` registra os handlers da caixa de busca e coordena os fluxos de consulta, destaque, ativacao de camadas e abertura de popup.

`src/geoportal-search-utils.js` concentra funcoes puras de endereco extraidas da busca:

- `parseEnderecoQuery`;
- `buildRuaCandidatesCqlFilter`;
- `buildEnderecoCqlFilter`;
- `extractNumeroFromEndereco`.

Essas funcoes sao cobertas por testes unitarios em `src/geoportal-search-utils.test.js`.

Fluxos atuais:

- BIC: consulta WFS em `ne:area_urbana`, ativa a camada de lotes quando necessario, destaca a feicao e abre popup.
- Endereco: normaliza rua/numero, monta filtro CQL e busca em `ne:area_urbana`.
- Endereco aproximado: quando o numero exato nao e encontrado, escolhe o endereco mais proximo dentro de uma tolerancia e mostra aviso no popup.
- Poste: valida ID numerico, consulta WFS de postes, ativa camada de postes, destaca o ponto e abre popup com Solicitar Reparo.
- Fazenda/imovel rural: consulta SIGEF e SNCI por nome, ativa camadas rurais e enquadra as feicoes encontradas.

A busca usa `fetchWithTimeout`, `getGeoServerErrorMessage` e `showGeoportalNotice` para tratar falhas de rede/GeoServer. O fluxo completo ainda depende de GeoServer, mapa, camadas, popup e teste manual.

## 7. Rotas e botoes externos

Rotas sao geradas em `src/geoportal-routes.js` por `buildGoogleMapsRouteUrl`.

- Se `originLonLat` for passado explicitamente, a URL do Google Maps inclui origem e destino.
- Quando `originLonLat` nao e passado, `src/geoportal-routes.js` usa `userLonLat` do estado centralizado como fallback.
- `src/geoportal-ui.js` grava `userLonLat` em `src/geoportal-state.js` apos geolocalizacao bem-sucedida.
- Sem origem, a URL inclui apenas destino.
- Farmacias, postes e locais de interesse usam essa funcao para botoes de rota.

Links externos usados:

- Google Maps: rotas para farmacias, postes e locais de interesse.
- WhatsApp: contato de farmacias e locais de interesse, com limpeza de digitos antes de montar `wa.me`.
- Google Forms: botao Solicitar Reparo dos postes, usando `URLSearchParams` em `buildPosteRepairFormUrl`.

Cuidados existentes:

- `target="_blank"` com `rel="noopener noreferrer"` em links externos;
- formatacao/validacao basica de telefone e coordenadas;
- `escapeHtml` para dados textuais exibidos em popup.

## 8. Tratamento de erro e timeout

### `src/geoportal-utils.js`

Define utilitarios compartilhados:

- `escapeHtml`: sanitiza texto antes de inserir em HTML de popup.
- `fetchWithTimeout`: envolve `fetch` com `AbortController`, timeout padrao de 8000 ms e erro `TIMEOUT`.
- `getGeoServerErrorMessage`: converte erro tecnico em mensagem amigavel.

### `src/geoportal-notice.js`

Define `showGeoportalNotice`, um aviso/toast reutilizavel com:

- tipos `info`, `warning`, `error`, `success`;
- posicao `bottom-right` ou `top-center`;
- duracao configuravel;
- cooldown por chave para evitar repeticao excessiva.

Padrao atual: evitar `alert` em fluxos novos e usar notices/toasts para falhas de GeoServer, timeouts, validacoes de busca e geolocalizacao.

## 9. Estado global

`src/geoportal-state.js` e o local preferencial para novos estados compartilhados.

Estado atualmente centralizado:

- `userLonLat`: coordenada do usuario para rotas.
- `ultimoPopupHtml`: HTML usado na impressao.
- `activePopupSource`: origem do popup ativo.
- `nextPopupSource`: origem planejada para o proximo popup.
- `measureActive`: indica quando a ferramenta de medicao esta ativa.

Pontos importantes:

- `activePopupSource` e `nextPopupSource` nao devem voltar para `window.__geoportalActivePopupSource` ou `window.__geoportalNextPopupSource`.
- `geoportal-measure.js` usa `setMeasureActive()` e `clearMeasureActive()` para controlar a medicao.
- `geoportal-mapclick.js` usa `getMeasureActive()` para bloquear selecao/popup enquanto a medicao esta ativa.
- Ainda ha globais de compatibilidade para alguns dados, como coordenadas de refresh de popup e flags internas de modulo. Tratar em etapas pequenas.

## 10. Seguranca no front-end

Cuidados atuais e recomendados:

- usar `escapeHtml` em qualquer dado vindo do GeoServer antes de interpolar em HTML;
- evitar inserir HTML bruto de atributos externos;
- montar URLs externas com APIs apropriadas, como `URLSearchParams`;
- manter `rel="noopener noreferrer"` em links `target="_blank"`;
- nao expor segredos, tokens, credenciais ou regras sensiveis no front-end;
- publicar dados sensiveis futuramente apenas por views, endpoints ou APIs controladas no backend;
- revisar popups novos para evitar XSS, especialmente quando exibirem atributos livres do GeoServer/PostGIS.

## 11. Regras para mudancas futuras

Antes de alterar o front-end, preservar explicitamente:

- mapa;
- camadas;
- busca;
- popups;
- farmacias;
- postes;
- rotas;
- medicao;
- geolocalizacao;
- impressao;
- mobile;
- barra publica;
- painel de camadas.

Regras praticas:

- fazer diffs pequenos e localizados;
- nao reescrever arquivos inteiros sem necessidade;
- manter nomes de funcoes publicas existentes quando possivel;
- preferir helpers existentes a novas abstracoes;
- rodar build antes de publicar;
- testar manualmente os fluxos criticos do checklist.

## 12. Checklist minimo de testes manuais

- [ ] Rodar `npm.cmd run build`.
- [ ] Abrir o mapa.
- [ ] Alternar OSM/satelite.
- [ ] Ativar/desativar camadas no painel.
- [ ] Usar a barra publica para ativar camadas e limpar selecao.
- [ ] Buscar BIC.
- [ ] Buscar endereco.
- [ ] Buscar poste.
- [ ] Clicar em lote.
- [ ] Clicar em edificacao com Edificacoes ativada sozinha.
- [ ] Clicar em lote + edificacao com ambas as camadas ativas.
- [ ] Clicar em farmacia.
- [ ] Clicar em local de interesse.
- [ ] Clicar em poste e usar Solicitar Reparo.
- [ ] Testar rota do Google Maps.
- [ ] Testar WhatsApp quando existir.
- [ ] Testar medicao de distancia e area.
- [ ] Limpar medicao.
- [ ] Testar geolocalizacao.
- [ ] Testar impressao com e sem popup.
- [ ] Testar mobile, incluindo painel de camadas, busca e popup.

## Pontos de atencao

- A medicao usa um pequeno atraso de liberacao apos o fim do desenho para evitar popup residual em cliques/toques rapidos, especialmente no mobile. Sempre testar medicao manualmente em desktop e mobile apos alteracoes.
- `showLotesPopup` e um nome historico e hoje representa o popup geral do Geoportal.
- Alguns estados de compatibilidade ainda usam `window.__geoportal...`, como `window.__geoportalActivePopupRefreshCoord`, `window.__geoportalNextPopupRefreshCoord`, `window.__geoportalFarmaciaRouteButtonsReady` e `window.__geoportalNoticeCooldowns`.
- A impressao atual e funcional, mas provisoria. Pode haver diferencas entre desktop, desktop simulando mobile e mobile real; futuras melhorias devem evitar remendos grandes em `src/geoportal-print.js` e priorizar um modulo/layout oficial de impressao com escala, legenda padronizada, titulo, logotipo/brasao, norte, data de emissao, fonte dos dados e informacoes detalhadas da feicao selecionada.
- `geoportal-ui.js` possui codigo executado no topo do modulo antes das exportacoes, relacionado a elementos da search-box. Isso deve ser considerado com cuidado em futuras refatoracoes.
- Ha textos e comentarios com encoding inconsistente em alguns arquivos; evitar refatoracoes amplas apenas para corrigir acentuacao.
- Farmacias usam a nomenclatura historica `DeOntem` em algumas funcoes, embora a regra atual compare o dia do mes atual.
- Os documentos `IMPLEMENTACAO_POSTES_REPARO.md` e `TESTE_POSTES_REPARO.md` descrevem etapas anteriores e podem conter detalhes historicos que ja evoluiram no codigo.
