import ImageLayer from 'https://cdn.jsdelivr.net/npm/ol@latest/layer/Image.js';
import ImageWMS from 'https://cdn.jsdelivr.net/npm/ol@latest/source/ImageWMS.js';

export function addSpecialLayers(map) {
  const pavimentacaoLayer = new ImageLayer({
    source: new ImageWMS({
      url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
      params: {
        'LAYERS': 'ne:Pavimentação',
        'TILED': true,
        'FORMAT': 'image/png'
      },
      ratio: 1,
      serverType: 'geoserver'
    }),
    visible: false
  });
  map.addLayer(pavimentacaoLayer);
  return { pavimentacaoLayer };
}
