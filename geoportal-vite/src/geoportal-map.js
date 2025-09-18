import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import ScaleLine from 'ol/control/ScaleLine.js';
import { fromLonLat } from 'ol/proj.js';

export function initMap(targetId) {
  const osmLayer = new TileLayer({ source: new OSM() });
  const satelliteLayer = new TileLayer({
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 18 // Limite apenas para satélite
    }),
    visible: false
  });
  const map = new Map({
    target: targetId,
    layers: [osmLayer, satelliteLayer],
      view: new View({
        center: fromLonLat([-55.2333, -23.1050]),
        zoom: 13
      // maxZoom removido daqui
    })
  });
  const scaleLineControl = new ScaleLine({
    units: 'metric',
    bar: false,
    steps: 4,
    text: true,
    minWidth: 100
  });
  map.addControl(scaleLineControl);
  return { map, osmLayer, satelliteLayer };
}
