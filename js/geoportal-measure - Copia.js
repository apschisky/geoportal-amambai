import { Draw } from 'https://cdn.jsdelivr.net/npm/ol@latest/interaction.js';
import * as sphere from 'https://cdn.jsdelivr.net/npm/ol@latest/sphere.js';

export function setupMeasurement(map, source) {
  let draw;
  function formatMeasurement(feature, type) {
    const geometry = feature.getGeometry();
    let output = "";
    if (type === 'LineString') {
      const length = sphere.getLength(geometry);
      output = length > 100000 ? (length / 1000).toFixed(2) + ' km' : length.toFixed(2) + ' m';
    } else {
      const area = sphere.getArea(geometry);
      output = area > 100000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(2) + ' m²';
    }
    const resultSpan = document.getElementById('measurement-result');
    resultSpan.innerText = output;
    resultSpan.style.display = "inline-block";
  }

  function addInteraction(type) {
    if (draw) map.removeInteraction(draw);
    draw = new Draw({ source: source, type: type });
    draw.on('drawend', (event) => formatMeasurement(event.feature, type));
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
    const resultSpan = document.getElementById('measurement-result');
    resultSpan.innerText = "";
    resultSpan.style.display = "none";
  });
}
