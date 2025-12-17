

// Inicialização do mapa base usando o objeto global ol (OpenLayers via CDN)
export function initMap(targetId) {
  const osmLayer = new ol.layer.Tile({ source: new ol.source.OSM() });
  const satelliteLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }),
    visible: false
  });
  const map = new ol.Map({
    target: targetId,
    layers: [osmLayer, satelliteLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([-55.2333, -23.1050]),
      zoom: 12
    })
  });
  const scaleLineControl = new ol.control.ScaleLine({
    units: 'metric',
    bar: false,
    steps: 4,
    text: true,
    minWidth: 100
  });
  map.addControl(scaleLineControl);
  return { map, osmLayer, satelliteLayer };
}
