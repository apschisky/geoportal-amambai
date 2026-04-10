

import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS.js';
import ImageLayer from 'ol/layer/Image.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import { LAYER_CONFIG } from '@/geoportal-config.js';

export function createLayer({ url, layerName, crs = 'EPSG:32721', extent, singleImage }) {
  // if config requests a single image (ImageWMS), create an ImageLayer
  if (singleImage) {
    const layerConfig = {
      source: new ImageWMS({
        url: url,
        params: {
          'VERSION': '1.1.0',
          'LAYERS': layerName,
          'FORMAT': 'image/png',
          'SRS': crs
        },
        serverType: 'geoserver'
      }),
      visible: false
    };
    if (extent) {
      layerConfig.extent = extent;
    }
    return new ImageLayer(layerConfig);
  }

  // default: tiled WMS
  return new TileLayer({
    source: new TileWMS({
      url: url,
      params: {
        'VERSION': '1.1.0',
        'LAYERS': layerName,
        'FORMAT': 'image/png',
        'SRS': crs,
        'TILED': true
      },
      serverType: 'geoserver'
    }),
    visible: false
  });
}

export function createAllLayers() {
  const layers = {};
  for (const key in LAYER_CONFIG) {
    layers[key] = createLayer(LAYER_CONFIG[key]);
  }
  return layers;
}

export function addLayersToMap(map, layers, order) {
  // order: array de chaves de layers para sobreposição
  order.forEach(layerKey => {
    if (layers[layerKey]) map.addLayer(layers[layerKey]);
  });
}

export function setLayerVisibility(layers, layerId, visible) {
  if (layers[layerId]) layers[layerId].setVisible(visible);
}
