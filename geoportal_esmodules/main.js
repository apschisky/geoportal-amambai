
// Arquivo principal: importa e inicializa todos os módulos do Geoportal
import { initMap } from './geoportal-map.js';
import { createAllLayers, addLayersToMap, setLayerVisibility } from './geoportal-layers.js';
import { atualizarLegendas } from './geoportal-legend.js';
import { setupMeasurement } from './geoportal-measure.js';
import { showLotesPopup } from './geoportal-popup.js';
import { setupSearchHandlers } from './geoportal-search.js';
import { setupPrint } from './geoportal-print.js';
import { setupUIHandlers } from './geoportal-ui.js';
import { addSpecialLayers } from './geoportal-special-layers.js';
import { setupMapClickHandler } from './geoportal-mapclick.js';

window.addEventListener('DOMContentLoaded', () => {
  // Inicialização do mapa
  const { map, osmLayer, satelliteLayer } = initMap('map');

  // Criação das camadas
  const layers = createAllLayers();
  // Ordem correta das camadas conforme LAYER_CONFIG e checkboxes do HTML
  const layerOrder = [
    'layer1',
    'layer_macrozoneamento',
    'layer4',
    'layer2',
    'layer_aeia',
    'layer_aeie',
    'layer_aeis1',
    'layer_aeis2',
    'layer_aeiu',
    'layer_apc',
    'layer_area_protecao_cultural',
    'layer3',
    'layer_edificacoes',
    'layer_pavimentacao',
    'layer_trechosrda',
    'layer_redeesgoto',
    'layer_assistencia_social',
    'layer_educacao',
    'layer_prefeitura',
    'layer_saude',
    'layer5',
    'layer6',
    'layer7',
    'layer_tipos_vegetacao',
    'layer_imoveis_sigef',
    'layer_imoveis_snci'
  ];
  addLayersToMap(map, layers, layerOrder);

  // Camadas especiais (exemplo: pavimentação)
  const specialLayers = addSpecialLayers(map);

  // Ativação de camadas via checkbox
  Object.keys(layers).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox) {
      checkbox.addEventListener('change', e => {
        setLayerVisibility(layers, layerId, e.target.checked);
        atualizarLegendas(layers);
      });
      // Ativar camada se checkbox já estiver marcado no HTML
      setLayerVisibility(layers, layerId, checkbox.checked);
    }
  });

  // Atualização de legendas
  atualizarLegendas(layers);

  // Medição
  const source = new ol.source.Vector();
  setupMeasurement(map, source);

  // Busca
  setupSearchHandlers(map, layers, showLotesPopup);

  // Impressão
  setupPrint(map, layers);

  // UI/UX
  setupUIHandlers();

  // Handler de clique no mapa
  setupMapClickHandler(map, layers, showLotesPopup);
});
