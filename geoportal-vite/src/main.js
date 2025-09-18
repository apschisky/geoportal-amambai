// Arquivo principal: importa e inicializa todos os módulos do Geoportal

import { initMap } from '@/geoportal-map.js'; //ok
import { createAllLayers, addLayersToMap, setLayerVisibility } from '@/geoportal-layers.js'; //ok
import { atualizarLegendas } from '@/geoportal-legend.js'; //ok
import { setupMeasurement } from '@/geoportal-measure.js'; //ok
window.measureActive = false;
import { showLotesPopup } from '@/geoportal-popup.js'; //ok
import { setupSearchHandlers } from '@/geoportal-search.js'; //ok
import { setupPrint } from '@/geoportal-print.js'; //ok
import { setupUIHandlers, setupGeolocation } from '@/geoportal-ui.js'; //ok
import { addSpecialLayers } from '@/geoportal-special-layers.js'; //ok
import { setupMapClickHandler } from '@/geoportal-mapclick.js'; //ok
import { toLonLat } from 'ol/proj.js';


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
  import('ol/source/Vector.js').then(({ default: VectorSource }) => {
    const source = new VectorSource();
    // Adiciona camada de medição ao mapa se não existir
    import('ol/layer/Vector.js').then(({ default: VectorLayer }) => {
      const measureLayer = new VectorLayer({ source });
      measureLayer.set('measureLayer', true);
      map.addLayer(measureLayer);
      setupMeasurement(map, source);
    });
    // Controle de ativação da medição
    const btnDist = document.getElementById('measure-distance');
    const btnArea = document.getElementById('measure-area');
    const btnClear = document.getElementById('clear-measurement');
    if (btnDist && btnArea && btnClear) {
  btnDist.addEventListener('click', () => { window.measureActive = true; });
  btnArea.addEventListener('click', () => { window.measureActive = true; });
  btnClear.addEventListener('click', () => { window.measureActive = false; });
    }
  });

  // Busca
  setupSearchHandlers(map, layers, showLotesPopup);

  // Impressão
  setupPrint(map, layers);

  // UI/UX
  setupUIHandlers();

  // Ativa geolocalização
  setupGeolocation(map);


  // Handler único de singleclick: mostra apenas coordenadas
  window.measureActive = false;
  const coordDiv = document.getElementById('mouse-coordinates');
  map.on('singleclick', function(evt) {
    const coord = evt.coordinate;
    if (coord) {
      const [lon, lat] = toLonLat(coord);
      coordDiv.textContent = `Lon: ${lon.toFixed(5)}, Lat: ${lat.toFixed(5)}`;
    }
    // Não chama popup aqui!
  });

  // Handler de popup/seleção e lógica de medição centralizada em geoportal-mapclick.js
  setupMapClickHandler(map, layers, showLotesPopup);

  // Controle de ativação/desativação da interação de popup
  const btnDist = document.getElementById('measure-distance');
  const btnArea = document.getElementById('measure-area');
  const btnClear = document.getElementById('clear-measurement');
  if (btnDist && btnArea && btnClear) {
    btnDist.addEventListener('click', () => { window.measureActive = true; });
    btnArea.addEventListener('click', () => { window.measureActive = true; });
    btnClear.addEventListener('click', () => { window.measureActive = false; });
  }

  // Atualização das coordenadas do mouse
  map.on('pointermove', function(evt) {
    if (evt.dragging) return;
    const coord = evt.coordinate;
    if (coord) {
      const [lon, lat] = toLonLat(coord);
      coordDiv.textContent = `Lon: ${lon.toFixed(5)}, Lat: ${lat.toFixed(5)}`;
    } else {
      coordDiv.textContent = 'Lon: --, Lat: --';
    }
  });

  // Handler para troca do mapa base
  const osmRadio = document.querySelector('input[name="basemap"][value="osm"]');
  const satRadio = document.querySelector('input[name="basemap"][value="satellite"]');
  if (osmRadio && satRadio) {
    osmRadio.addEventListener('change', function() {
      if (osmRadio.checked) {
        osmLayer.setVisible(true);
        satelliteLayer.setVisible(false);
        map.getView().setMaxZoom(undefined); // Libera zoom para OSM
      }
    });
    satRadio.addEventListener('change', function() {
      if (satRadio.checked) {
        osmLayer.setVisible(false);
        satelliteLayer.setVisible(true);
        map.getView().setMaxZoom(18); // Limita zoom para satélite
        if (map.getView().getZoom() > 18) {
          map.getView().setZoom(18); // Se estava acima, volta para 18
        }
      }
    });
    // Impede zoom maior que 18 no satélite
    map.getView().on('change:resolution', function() {
      if (satRadio.checked && map.getView().getZoom() > 18) {
        map.getView().setZoom(18);
      }
    });
  }
});
