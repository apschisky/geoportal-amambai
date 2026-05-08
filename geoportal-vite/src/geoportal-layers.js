

import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS.js';
import ImageLayer from 'ol/layer/Image.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import { LAYER_CONFIG, LEGEND_CONFIG } from '@/geoportal-config.js';
import { showGeoportalNotice } from './geoportal-notice.js';

const layerLoadErrorNoticeTimes = {};
let lastGlobalLayerLoadErrorNotice = 0;

function getLayerLabel(layerKey, layerName) {
  return LEGEND_CONFIG[layerKey]?.titulo || layerName || 'Camada';
}

export function registerLayerLoadErrorNotice(layer, layerLabel, layerKey = layerLabel) {
  const source = layer?.getSource?.();
  if (!source) return;

  const showLayerError = () => {
    if (!layer.getVisible?.()) return;
    const now = Date.now();
    const layerNoticeKey = layerKey || layerLabel;

    if (now - (layerLoadErrorNoticeTimes[layerNoticeKey] || 0) < 15000) return;
    if (now - lastGlobalLayerLoadErrorNotice < 8000) return;

    layerLoadErrorNoticeTimes[layerNoticeKey] = now;
    lastGlobalLayerLoadErrorNotice = now;

    showGeoportalNotice({
      type: 'error',
      position: 'top-center',
      message: `${layerLabel}: não foi possível carregar esta camada no momento.`
    });
  };

  source.on('tileloaderror', showLayerError);
  source.on('imageloaderror', showLayerError);
}

export function createLayer({ url, layerName, crs = 'EPSG:32721', extent, singleImage }, layerKey = '') {
  // if config requests a single image (ImageWMS), create an ImageLayer
  let layer;
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
    layer = new ImageLayer(layerConfig);
    registerLayerLoadErrorNotice(layer, getLayerLabel(layerKey, layerName), layerKey || layerName);
    return layer;
  }

  // default: tiled WMS
  layer = new TileLayer({
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
  registerLayerLoadErrorNotice(layer, getLayerLabel(layerKey, layerName), layerKey || layerName);
  return layer;
}

export function createAllLayers() {
  const layers = {};
  for (const key in LAYER_CONFIG) {
    layers[key] = createLayer(LAYER_CONFIG[key], key);
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
