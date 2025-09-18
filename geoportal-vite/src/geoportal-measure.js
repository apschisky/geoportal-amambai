import Draw from 'ol/interaction/Draw.js';
import { getLength, getArea } from 'ol/sphere.js';
import Overlay from 'ol/Overlay.js';


export function setupMeasurement(map, source) {
  let draw;
  let measureOverlay = null;
  function removeOverlay() {
    if (measureOverlay) {
      map.removeOverlay(measureOverlay);
      measureOverlay = null;
    }
  }
  function formatMeasurement(feature, type) {
    const geometry = feature.getGeometry();
    let output = "";
    if (type === 'LineString') {
      const length = getLength(geometry);
      output = length > 100000 ? (length / 1000).toFixed(2) + ' km' : length.toFixed(2) + ' m';
    } else {
      const area = getArea(geometry);
      output = area > 100000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(2) + ' m²';
    }
    removeOverlay();
    const el = document.createElement('div');
    el.className = 'measurement-result-overlay';
    el.innerText = output;
    // Posição: centroide para área, último ponto para linha
    let coord;
    if (type === 'Polygon') {
      const poly = geometry;
      if (poly.getInteriorPoint) {
        coord = poly.getInteriorPoint().getCoordinates();
      } else {
        // fallback: centroide simples
        const flat = poly.getCoordinates()[0];
        let x = 0, y = 0;
        flat.forEach(pt => { x += pt[0]; y += pt[1]; });
        x /= flat.length; y /= flat.length;
        coord = [x, y];
      }
    } else if (type === 'LineString') {
      const coords = geometry.getCoordinates();
      coord = coords[coords.length - 1];
    }
    measureOverlay = new Overlay({
      element: el,
      positioning: 'center-center',
      stopEvent: false,
      offset: type === 'Polygon' ? [0, 0] : [20, 0]
    });
    map.addOverlay(measureOverlay);
    measureOverlay.setPosition(coord);
  }

  function addInteraction(type) {
    if (draw) map.removeInteraction(draw);
    removeOverlay();
    // Durante a medição, mantém apenas DragPan e MouseWheelZoom ativos
    const interactionsToKeep = ['DragPan', 'MouseWheelZoom'];
    const toDisable = [];
    map.getInteractions().forEach(interaction => {
      if (!interactionsToKeep.includes(interaction.constructor.name)) {
        interaction.setActive(false);
        toDisable.push(interaction);
      }
    });
    draw = new Draw({ source: source, type: type });
    window.measureActive = true;
    // Evita seleção de feição no último clique da medição
    window.measureActive = true;
    let singleClickHandler = () => {
      window.measureActive = false;
      // Se não houver mais feições de medição, remove o overlay do resultado
      if (source.getFeatures().length === 0) {
        removeOverlay();
      }
      map.un('singleclick', singleClickHandler);
    };
    draw.on('drawend', (event) => {
      formatMeasurement(event.feature, type);
      map.removeInteraction(draw);
      // Só libera seleção após o próximo clique
      map.on('singleclick', singleClickHandler);
      // Reabilita todas as interações
      toDisable.forEach(interaction => interaction.setActive(true));
    });
    map.addInteraction(draw);
  }

  document.getElementById('measure-distance').addEventListener('click', () => {
    addInteraction('LineString');
  });
  document.getElementById('measure-area').addEventListener('click', () => {
    addInteraction('Polygon');
  });
  document.getElementById('clear-measurement').addEventListener('click', () => {
    source.clear();
    if (draw) map.removeInteraction(draw);
    window.measureActive = false;
    removeOverlay();
    // Reabilita todas as interações
    map.getInteractions().forEach(interaction => {
      interaction.setActive(true);
    });
  });
}
