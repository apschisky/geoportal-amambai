import ImageLayer from 'ol/layer/Image.js';
import ImageWMS from 'ol/source/ImageWMS.js';

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
