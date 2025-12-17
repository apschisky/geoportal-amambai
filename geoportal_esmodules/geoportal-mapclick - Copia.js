

// Handler para clique no mapa: busca atributos e destaca feição usando o objeto global ol
export function setupMapClickHandler(map, layers, showLotesPopup) {
  map.on('singleclick', async function(evt) {
    // Exemplo: busca atributos do lote se layer3 estiver visível
    if (layers['layer3'] && layers['layer3'].getVisible()) {
      const view = map.getView();
      const url = layers['layer3'].getSource().getFeatureInfoUrl(
        evt.coordinate,
        view.getResolution(),
        'EPSG:3857',
        {
          'INFO_FORMAT': 'application/json',
          'QUERY_LAYERS': 'ne:area_urbana'
        }
      );
      if (url) {
        try {
          const response = await fetch(url);
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            let html = '<div style="font-size:14px;max-width:320px;"><strong>Atributos do lote</strong><br><table style="border-collapse:collapse;width:100%">';
            for (const key in props) {
              if (key === 'geometry' || key === 'id') continue;
              html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
            }
            html += '</table></div>';
            showLotesPopup(map, evt.coordinate, html);
          }
        } catch (e) {}
      }
    }
    // Adicione lógica para outras camadas conforme necessário
  });
}
