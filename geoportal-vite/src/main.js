// Arquivo principal: importa e inicializa todos os módulos do Geoportal

import { initMap } from '@/geoportal-map.js'; //ok
import { createAllLayers, addLayersToMap, setLayerVisibility } from '@/geoportal-layers.js'; //ok
import { atualizarLegendas } from '@/geoportal-legend.js'; //ok
import { setupMeasurement } from '@/geoportal-measure.js'; //ok
import { clearMeasureActive, setMeasureActive } from '@/geoportal-state.js';
clearMeasureActive();
import { closeLotesPopup, showLotesPopup } from '@/geoportal-popup.js'; //ok
import { setupSearchHandlers } from '@/geoportal-search.js'; //ok
import { setupPrint } from '@/geoportal-print.js'; //ok
import { setupUIHandlers, setupGeolocation } from '@/geoportal-ui.js'; //ok
import { addSpecialLayers } from '@/geoportal-special-layers.js'; //ok
import { setupMapClickHandler } from '@/geoportal-mapclick.js'; //ok
import { createFarmaciasDeOntemLayer, openFarmaciaDePlantaoPopup, setupFarmaciaRouteButtons, zoomToFarmaciaDePlantao } from '@/geoportal-farmacias.js'; //ok
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

  const clearTemporaryMapSelection = () => {
    closeLotesPopup(map);

    map.getLayers().getArray()
      .filter(layer => layer.get('highlightLayer') && !layer.get('measureLayer'))
      .forEach(layer => map.removeLayer(layer));
  };

  const collapseLayerPanelOnMobile = () => {
    if (!window.matchMedia('(max-width: 600px)').matches) return;

    const layerBox = document.querySelector('.layer-controls-box');
    if (layerBox) layerBox.classList.remove('expanded');
  };

  const activateLayerByCheckboxId = (id) => {
    const checkbox = document.getElementById(id);
    if (!checkbox) return false;
    if (!checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  };

  const clearAllActiveLayers = () => {
    Object.keys(layers).forEach(layerId => {
      if (layerId === 'layer1') return;

      const checkbox = document.getElementById(layerId);
      if (!checkbox || !checkbox.checked) return;

      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    clearTemporaryMapSelection();
    atualizarLegendas(layers);
  };

  const openLayerPanel = () => {
    const layerBox = document.querySelector('.layer-controls-box');
    if (layerBox) layerBox.classList.add('expanded');
  };

  const publicNavLayerMap = {
    assistencia: 'layer_assistencia_social',
    educacao: 'layer_educacao',
    prefeitura: 'layer_prefeitura',
    saude: 'layer_saude',
    farmacias: 'layer_farmacias',
    'coleta-lixo': 'layer_coleta',
    'coleta-seletiva': 'layer_coleta_seletiva',
    postes: 'layer_postes'
  };

  const setupPublicNavHandlers = () => {
    const publicNav = document.querySelector('.geoportal-public-nav');
    if (!publicNav) return;

    const closePublicNavMenus = () => {
      publicNav.querySelectorAll('.geoportal-public-nav-item.is-open, .geoportal-public-nav-item.is-click-closed')
        .forEach(item => item.classList.remove('is-open', 'is-click-closed'));
      if (document.activeElement instanceof HTMLElement && publicNav.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    };

    publicNav.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !publicNav.contains(button)) return;

      const layerShortcut = button.dataset.layerShortcut;
      const action = button.dataset.action;
      const navItem = button.closest('.geoportal-public-nav-item');

      if (!layerShortcut && !action) {
        if (!navItem) return;
        event.preventDefault();
        event.stopPropagation();
        const wasOpen = navItem.classList.contains('is-open');
        closePublicNavMenus();
        if (wasOpen) {
          navItem.classList.add('is-click-closed');
        } else {
          navItem.classList.add('is-open');
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (layerShortcut) {
        activateLayerByCheckboxId(publicNavLayerMap[layerShortcut]);
        closePublicNavMenus();
        return;
      }

      if (action === 'open-layer-panel' || action === 'open-basemap-panel') {
        openLayerPanel();
        closePublicNavMenus();
        return;
      }

      if (action === 'clear-layers') {
        clearAllActiveLayers();
        closePublicNavMenus();
      }
    });

    document.addEventListener('click', event => {
      if (!publicNav.contains(event.target)) {
        closePublicNavMenus();
      }
    });

    publicNav.querySelectorAll('.geoportal-public-nav-item').forEach(item => {
      item.addEventListener('mouseleave', () => {
        item.classList.remove('is-click-closed');
      });
    });
  };

  // FUTURO eServiços:
  // Fluxo previsto:
  // eServiços -> Geoportal para seleção espacial -> Protocolo
  // Geoportal -> eServiços com parâmetros de localização
  // Exemplo futuro:
  // /eservicos/novo?tipo=iluminacao&lat=...&lon=...&id=...
  // Não ativado nesta etapa.

  // Ativação de camadas via checkbox
  Object.keys(layers).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox) {
      checkbox.addEventListener('change', e => {
        setLayerVisibility(layers, layerId, e.target.checked);
        if (!e.target.checked) {
          clearTemporaryMapSelection();
        }
        
        // Sincronizar visibilidade da camada de destaque de farmácias
        if (layerId === 'layer_farmacias') {
          farmaciasHighlightLayer.setVisible(e.target.checked);
          if (e.target.checked) {
            collapseLayerPanelOnMobile();
          }
          if (e.target.checked && !farmaciasHighlightLayer.get('alreadyZoomed')) {
            zoomToFarmaciaDePlantao(map, farmaciasHighlightLayer);
          }
          if (e.target.checked && !farmaciasHighlightLayer.get('alreadyOpenedPopup')) {
            openFarmaciaDePlantaoPopup(map, farmaciasHighlightLayer, showLotesPopup);
          }
          if (!e.target.checked) {
            farmaciasHighlightLayer.set('alreadyZoomed', false);
            farmaciasHighlightLayer.set('alreadyOpenedPopup', false);
          }
        }
        
        atualizarLegendas(layers);
      });
      // Ativar camada se checkbox já estiver marcado no HTML
      setLayerVisibility(layers, layerId, checkbox.checked);
      
      // Sincronizar visibilidade inicial da camada de destaque de farmácias
      if (layerId === 'layer_farmacias' && checkbox.checked) {
        farmaciasHighlightLayer.setVisible(true);
        zoomToFarmaciaDePlantao(map, farmaciasHighlightLayer);
        openFarmaciaDePlantaoPopup(map, farmaciasHighlightLayer, showLotesPopup);
      }
    }
  });

  // Atualização de legendas
  atualizarLegendas(layers);

  // Medição
  const clearLayersButton = document.getElementById('clear-layers-button');
  if (clearLayersButton) {
    clearLayersButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      clearAllActiveLayers();
    });
  }

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
  setupPublicNavHandlers();

  // Ativa geolocalização
  setupGeolocation(map);
  setupFarmaciaRouteButtons();

  const tutorialLinks = {
    main: '#'
  };

  setupWelcomeNotices({
    tutorialLinks,
    onActivateLighting: () => {
      activateLayerByCheckboxId('layer_postes');
    },
    onActivateFarmacia: () => {
      activateLayerByCheckboxId('layer_farmacias');
    }
  });


  // Handler único de singleclick: mostra apenas coordenadas
  clearMeasureActive();
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
    btnDist.addEventListener('click', () => { setMeasureActive(true); });
    btnArea.addEventListener('click', () => { setMeasureActive(true); });
    btnClear.addEventListener('click', () => { clearMeasureActive(); });
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



