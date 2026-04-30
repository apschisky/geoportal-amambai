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
import { createFarmaciasDeOntemLayer, zoomToFarmaciaDePlantao } from '@/geoportal-farmacias.js'; //ok
import { setupWelcomeNotices } from '@/geoportal-notices.js'; //ok
import { toLonLat } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';


window.addEventListener('DOMContentLoaded', () => {
  // Inicialização do mapa
  const {
    map,
    osmLayer,
    satelliteLayer,
    baseMapZoomLimits
  } = initMap('map');

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
    'layer_convergencia_fluxo',
    'layer_microbacias_urbana',
    'layer_vilas',
    'layer_edificacoes',
    'layer_pavimentacao',
    'layer_contorno_viario',
  'layer_trechosrda',
  'layer_redeesgoto',
  'layer_drenagem_urbana',
  'layer_postes',
  'layer_coleta',
  'layer_coleta_seletiva',
    'layer_assistencia_social',
    'layer_educacao',
    'layer_prefeitura',
    'layer_saude',
    'layer_farmacias',
    'layer5',
    'layer6',
    'layer_tipos_solo',
    'layer_unidades_conservacao',
    'layer_geologia',
    'layer7',
    'layer_imoveis_sigef',
    'layer_imoveis_snci'
  ];
  addLayersToMap(map, layers, layerOrder);

  // Criar camada de destaque para farmácias de plantão
  const farmaciasHighlightLayer = createFarmaciasDeOntemLayer();
  map.addLayer(farmaciasHighlightLayer);

  // Camadas especiais (exemplo: pavimentação)
  const specialLayers = addSpecialLayers(map);

  // Ativação de camadas via checkbox
  Object.keys(layers).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox) {
      checkbox.addEventListener('change', e => {
        setLayerVisibility(layers, layerId, e.target.checked);
        
        // Sincronizar visibilidade da camada de destaque de farmácias
        if (layerId === 'layer_farmacias') {
          farmaciasHighlightLayer.setVisible(e.target.checked);
          if (e.target.checked && !farmaciasHighlightLayer.get('alreadyZoomed')) {
            zoomToFarmaciaDePlantao(map, farmaciasHighlightLayer);
          }
          if (!e.target.checked) {
            farmaciasHighlightLayer.set('alreadyZoomed', false);
          }
        }
        
        atualizarLegendas(layers);
      });
      // Ativar camada se checkbox já estiver marcado no HTML
      setLayerVisibility(layers, layerId, checkbox.checked);
      
      // Sincronizar visibilidade inicial da camada de destaque de farmácias
      if (layerId === 'layer_farmacias' && checkbox.checked) {
        farmaciasHighlightLayer.setVisible(true);
      }
    }
  });

  // Atualização de legendas
  atualizarLegendas(layers);

  // Medição
  const source = new VectorSource();
  const measureLayer = new VectorLayer({ source });
  measureLayer.set('measureLayer', true);
  map.addLayer(measureLayer);
  setupMeasurement(map, source);

  // Busca
  setupSearchHandlers(map, layers, showLotesPopup, () => atualizarLegendas(layers));

  // Impressão
  setupPrint(map, layers);

  // UI/UX
  setupUIHandlers();

  // Ativa geolocalização
  setupGeolocation(map);

  const tutorialLinks = {
    main: '#'
  };

  const activateLayerFromNotice = (layerId) => {
    const checkbox = document.getElementById(layerId);
    if (!checkbox || checkbox.checked) return;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  };

  setupWelcomeNotices({
    tutorialLinks,
    onActivateLighting: () => {
      activateLayerFromNotice('layer_postes');
    },
    onActivateFarmacia: () => {
      activateLayerFromNotice('layer_farmacias');
    }
  });


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
    const setActiveBaseMap = (baseMap) => {
      const view = map.getView();

      osmLayer.setVisible(baseMap === 'osm');
      satelliteLayer.setVisible(baseMap === 'satellite');

      const maxZoom = baseMapZoomLimits[baseMap] ?? baseMapZoomLimits.osm;
      view.setMaxZoom(maxZoom);
      if (view.getZoom() > maxZoom) {
        view.setZoom(maxZoom);
      }
    };

    osmRadio.addEventListener('change', function() {
      if (osmRadio.checked) {
        setActiveBaseMap('osm');
      }
    });
    satRadio.addEventListener('change', function() {
      if (satRadio.checked) {
        setActiveBaseMap('satellite');
      }
    });
    map.getView().on('change:resolution', function() {
      let currentBaseMap = 'osm';
      if (satRadio.checked) {
        currentBaseMap = 'satellite';
      }

      const currentMaxZoom = baseMapZoomLimits[currentBaseMap] ?? baseMapZoomLimits.osm;
      if (map.getView().getZoom() > currentMaxZoom) {
        map.getView().setZoom(currentMaxZoom);
      }
    });
  }
});



