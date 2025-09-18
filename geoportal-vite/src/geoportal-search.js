import GeoJSON from 'ol/format/GeoJSON.js';
import { fromLonLat } from 'ol/proj.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import { extend as extendExtent } from 'ol/extent.js';
// Funções de busca (BIC, endereço, fazenda) usando ES Modules do OpenLayers
export function setupSearchHandlers(map, layers, showLotesPopup) {
  // Limpa o campo de busca ao trocar o tipo
  const searchType = document.getElementById('search-type');
  const searchInput = document.getElementById('search-input');
  if (searchType && searchInput) {
    searchType.addEventListener('change', () => {
      searchInput.value = '';
    });
  }

  // Vetor para seleção visual das feições encontradas
  let highlightLayer = null;

  // Remove seleção apenas ao clicar fora do mapa, popups e ferramentas
  document.addEventListener('mousedown', function(e) {
    // Não remove se clicar em popup, search-box, toolbox (ferramentas) ou botões de ferramentas
    const popup = document.querySelector('.ol-popup');
    const searchBox = document.querySelector('.search-box');
    const toolbox = document.querySelector('.toolbox');
    // Se clicar em qualquer elemento dentro da toolbox (medição, impressão, etc), não remove
    if ((popup && popup.contains(e.target)) ||
        (searchBox && searchBox.contains(e.target)) ||
        (toolbox && toolbox.contains(e.target))) return;
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
  });

  document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value.trim();
    const searchType = document.getElementById('search-type').value;
    if (!query) {
      alert('Digite um valor para buscar.');
      return;
    }
    // Remove seleção anterior (destaque de busca)
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    // Remove seleção anterior (destaque de clique)
    if (map.getLayers().getArray().some(l => l.get('highlightLayer'))) {
      const toRemove = map.getLayers().getArray().filter(l => l.get('highlightLayer'));
      toRemove.forEach(l => map.removeLayer(l));
    }
    if (searchType === 'bic' || searchType === 'endereco') {
      // Busca para BIC e Endereço
      let typeName, field, value, op, label;
      typeName = 'ne:area_urbana';
      field = searchType === 'bic' ? 'bic' : 'endereco';
      value = searchType === 'bic' ? query : `%25${encodeURIComponent(query)}%25`;
      op = searchType === 'bic' ? '=' : 'ILIKE';
      label = searchType === 'bic' ? 'BIC' : 'Endereço';
      const wfsUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&CQL_FILTER=${field} ${op} '${value}'`;
      try {
        const response = await fetch(wfsUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          // Se busca por BIC ou Endereço e camada de lotes não está visível, ativa
          if ((searchType === 'bic' || searchType === 'endereco') && layers['layer3'] && !layers['layer3'].getVisible()) {
            layers['layer3'].setVisible(true);
            const checkbox = document.getElementById('layer3');
            if (checkbox) checkbox.checked = true;
          }
          const feature = data.features[0];
          const format = new GeoJSON();
          const olFeature = format.readFeature(feature, {
            dataProjection: 'EPSG:32721',
            featureProjection: map.getView().getProjection()
          });
          let html = `<div style='font-size:14px;max-width:320px;'><strong>${label} encontrado: ${query}</strong><br><table style='border-collapse:collapse;width:100%'>`;
          for (const key in feature.properties) {
            if (key === 'geometry' || key === 'id') continue;
            html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
          }
          html += '</table></div>';
          // Seleciona e enquadra
          highlightLayer = new VectorLayer({
            source: new VectorSource({ features: [olFeature] }),
            style: new Style({
              stroke: new Stroke({ color: '#ff0', width: 3 }),
              fill: new Fill({ color: 'rgba(255,255,0,0.2)' })
            })
          });
          map.addLayer(highlightLayer);
          // Calcula o centro do extent para o popup
          const extent = olFeature.getGeometry().getExtent();
          const center = [ (extent[0]+extent[2])/2, (extent[1]+extent[3])/2 ];
          map.getView().fit(extent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
          showLotesPopup(map, center, html);
        } else {
          alert(`${label} não encontrado.`);
        }
      } catch (e) {
        alert(`Erro ao buscar por ${label}.`);
      }
      return;
    }
    if (searchType === 'fazenda') {
      const sigefLayer = layers['layer_imoveis_sigef'];
      const snciLayer = layers['layer_imoveis_snci'];
      // Ativa as camadas SIGEF e SNCI se não estiverem visíveis
      if (sigefLayer && !sigefLayer.getVisible()) {
        sigefLayer.setVisible(true);
        const checkbox = document.getElementById('layer_imoveis_sigef');
        if (checkbox) checkbox.checked = true;
      }
      if (snciLayer && !snciLayer.getVisible()) {
        snciLayer.setVisible(true);
        const checkbox = document.getElementById('layer_imoveis_snci');
        if (checkbox) checkbox.checked = true;
      }
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
      const format = new GeoJSON();
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
        // Seleciona e enquadra todas as feições
        highlightLayer = new VectorLayer({
          source: new VectorSource({ features: olFeatures }),
          style: new Style({
            stroke: new Stroke({ color: '#ff0', width: 3 }),
            fill: new Fill({ color: 'rgba(255,255,0,0.2)' })
          })
        });
        map.addLayer(highlightLayer);
        // Calcula o extent de todas as feições
        let extent = olFeatures[0].getGeometry().getExtent();
        olFeatures.forEach(f => { extent = extendExtent(extent, f.getGeometry().getExtent()); });
        map.getView().fit(extent, { maxZoom: 18, duration: 800, padding: [40,40,40,40] });
        showLotesPopup(map, olFeatures[0].getGeometry().getFirstCoordinate(), html);
      }
      return;
    }
  });
}
