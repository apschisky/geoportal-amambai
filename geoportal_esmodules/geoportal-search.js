// Funções de busca (BIC, endereço, fazenda) usando o objeto global ol
export function setupSearchHandlers(map, layers, showLotesPopup) {
  document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value.trim();
    const searchType = document.getElementById('search-type').value;
    if (!query) {
      alert('Digite um valor para buscar.');
      return;
    }
    if (searchType === 'bic') {
      const bicField = 'bic';
      if (layers['layer3']) {
        layers['layer3'].setVisible(true);
        const checkbox = document.getElementById('layer3');
        if (checkbox) checkbox.checked = true;
      }
      const wfsUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${bicField}='${query}'`;
      try {
        const response = await fetch(wfsUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const format = new ol.format.GeoJSON();
          const olFeature = format.readFeature(feature, {
            dataProjection: 'EPSG:32721',
            featureProjection: map.getView().getProjection()
          });
          let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (BIC: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
          for (const key in feature.properties) {
            if (key === 'geometry' || key === 'id') continue;
            html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
          }
          html += '</table></div>';
          showLotesPopup(map, olFeature.getGeometry().getFirstCoordinate(), html);
        } else {
          alert('Lote com este número BIC não encontrado.');
        }
      } catch (e) {
        alert('Erro ao buscar lote pelo número BIC.');
      }
      return;
    }
    if (searchType === 'endereco') {
      const enderecoField = 'endereco';
      const wfsEnderecoUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${enderecoField} ILIKE '%25${encodeURIComponent(query)}%25'`;
      try {
        const response = await fetch(wfsEnderecoUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          if (layers['layer3']) {
            layers['layer3'].setVisible(true);
            const checkbox = document.getElementById('layer3');
            if (checkbox) checkbox.checked = true;
          }
          const feature = data.features[0];
          const format = new ol.format.GeoJSON();
          const olFeature = format.readFeature(feature, {
            dataProjection: 'EPSG:32721',
            featureProjection: map.getView().getProjection()
          });
          let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (Endereço: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
          for (const key in feature.properties) {
            if (key === 'geometry' || key === 'id') continue;
            html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
          }
          html += '</table></div>';
          showLotesPopup(map, olFeature.getGeometry().getFirstCoordinate(), html);
          return;
        }
      } catch (e) {}
      // Busca padrão por endereço (Nominatim)
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      fetch(url)
        .then(async response => {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            alert('Erro ao buscar endereço. Resposta inesperada do servidor.');
            return;
          }
          return response.json();
        })
        .then(data => {
          if (!data) return;
          if (data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            map.getView().animate({
              center: ol.proj.fromLonLat([lon, lat]),
              zoom: 16,
              duration: 1500
            });
          } else {
            alert('Endereço não encontrado.');
          }
        })
        .catch(() => {
          alert('Erro ao buscar endereço.');
        });
      return;
    }
    if (searchType === 'fazenda') {
      if (layers['layer_imoveis_sigef']) layers['layer_imoveis_sigef'].setVisible(true);
      if (layers['layer_imoveis_snci']) layers['layer_imoveis_snci'].setVisible(true);
      const sigefUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:Imóveis SIGEF 05_25&outputFormat=application/json&CQL_FILTER=nome_area ILIKE '%25${encodeURIComponent(query)}%25'`;
      const snciUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:Imóveis SNCI 05_25&outputFormat=application/json&CQL_FILTER=nome_imove ILIKE '%25${encodeURIComponent(query)}%25'`;
      let foundFeatures = [];
      try {
        const [sigefResp, snciResp] = await Promise.all([
          fetch(sigefUrl).then(r => r.json()),
          fetch(snciUrl).then(r => r.json())
        ]);
        if (sigefResp.features) foundFeatures = foundFeatures.concat(sigefResp.features.map(f => ({...f, origem: 'SIGEF', nome_fazenda: f.properties.nome_area})));
        if (snciResp.features) foundFeatures = foundFeatures.concat(snciResp.features.map(f => ({...f, origem: 'SNCI', nome_fazenda: f.properties.nome_imove})));
      } catch (e) {
        alert('Erro ao buscar imóveis rurais.');
        return;
      }
      if (foundFeatures.length === 0) {
        alert('Nenhum imóvel rural encontrado com esse nome.');
        return;
      }
      const format = new ol.format.GeoJSON();
      const olFeatures = foundFeatures.map(f => format.readFeature(f, {
        dataProjection: 'EPSG:32721',
        featureProjection: map.getView().getProjection()
      }));
      let html = `<div style='font-size:14px;max-width:320px;'><strong>Imóveis Rurais encontrados</strong><br><table style='border-collapse:collapse;width:100%'>`;
      foundFeatures.forEach(f => {
        html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${f.nome_fazenda || 'Sem nome'}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${f.origem}</td></tr>`;
      });
      html += '</table></div>';
      if (olFeatures.length > 0) {
        showLotesPopup(map, olFeatures[0].getGeometry().getFirstCoordinate(), html);
      }
      return;
    }
  });
}
