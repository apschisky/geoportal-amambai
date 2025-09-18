const sigefMap = {
    nome_area: 'Nome da Área',
    area_ha: 'Área do Imóvel (ha)'
  };
  const sigefHidden = [
    'parcela_co',
    'rt',
    'art',
    'situacao_i',
    'codigo_imo',
    'data_submi',
    'data_aprov',
    'status',
    'registro_m',
    'registro_d',
    'municipio_',
    'uf_id'
  ];
  const snciMap = {
    nome_imove: 'Nome da Área',
    qtd_area_p: 'Área do Imóvel (ha)'
  };
  const snciHidden = [
    'num_proces',
    'sr',
    'num_certif',
    'data_certif',
    'cod_profis',
    'cod_imovel',
    'uf_municip',
    'area_ha',
    'data_certi'
  ];


import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
// Handler para clique no mapa: busca atributos e destaca feição usando ES Modules do OpenLayers
export function setupMapClickHandler(map, layers, showLotesPopup) {
  // Mapeamento amigável para Eixo de Adensamento
  const eixoMap = {
    ca_bas: 'Coeficiente Básico',
    ca_min: 'Coeficiente Mínimo',
    ca_max: 'Coeficiente Máximo',
    to_max: 'Taxa de Ocupação Máxima',
    tp_min: 'Taxa de Permeabilidade Mínima',
    pavimentos_max: 'Qtd. Máxima de Pavimentos'
  };
  // Mapeamento de nomes técnicos para amigáveis (zoneamento urbano e lotes urbanos)
  const zoneamentoMap = {
    zona: 'Zona',
    areas: 'Áreas',
    ca_bas: 'Coeficiente Básico',
    ca_min: 'Coeficiente Mínimo',
    ca_max: 'Coeficiente Máximo',
    to_max: 'Taxa de Ocupação Máxima',
    tp_min: 'Taxa de Permeabilidade Mínima',
    pavimentos_max: 'Qtd. Máxima de Pavimentos'
  };
  const loteMap = {
    quadra: 'Quadra',
    vila: 'Vila',
    lote: 'Lote',
    bic: 'BIC',
    area_lote: 'Área do Lote',
    construcao: 'Construído',
    endereco: 'Endereço',
    desc_uso: 'Descrição de Uso',
    cep: 'CEP'
  };
  const edificacoesMap = {
    bic: 'BIC',
    area_edif: 'Área Edificada',
    lote: 'Lote',
    quadra: 'Quadra',
    vila: 'Vila'
  };
  map.on('singleclick', async function(evt) {
    if (window.measureActive) return; // Bloqueia seleção/popup durante medição
    const view = map.getView();
    const coord = evt.coordinate;
    const resolution = view.getResolution();
    // Lista de camadas para buscar info (inclui Eixo de Adensamento)
    const queryLayers = [
      { key: 'layer2', name: 'Eixo de Adensamento', queryLayer: 'ne:EixoDeAdensamento' },
      { key: 'layer3', name: 'Lote', queryLayer: 'ne:area_urbana' },
      { key: 'layer4', name: 'Zoneamento Urbano', queryLayer: 'ne:ZoneamentoUrbano_PD_novo' },
      { key: 'layer_edificacoes', name: 'Edificações', queryLayer: 'ne:EdificaçõesDB' },
      { key: 'layer_imoveis_sigef', name: 'Imóveis SIGEF', queryLayer: 'ne:Imóveis SIGEF 05_25' },
      { key: 'layer_imoveis_snci', name: 'Imóveis SNCI', queryLayer: 'ne:Imóveis SNCI 05_25' }
    ];
    let html = '';
    let loteHtml = '';
    let eixoHtml = '';
    let zoneamentoHtml = '';
    let otherHtml = '';
    let zoomed = false;
    let loteExtent = null;
    let eixoExtent = null;
    // Remove highlight anterior
    if (map.getLayers().getArray().some(l => l.get('highlightLayer'))) {
      const toRemove = map.getLayers().getArray().filter(l => l.get('highlightLayer'));
      toRemove.forEach(l => map.removeLayer(l));
    }
    // Camada de destaque
    const highlightSource = new VectorSource();
    const highlightLayer = new VectorLayer({
      source: highlightSource,
      style: new Style({
        stroke: new Stroke({ color: '#ff0', width: 3 }),
        fill: new Fill({ color: 'rgba(255,255,0,0.2)' })
      })
    });
    highlightLayer.set('highlightLayer', true);
    // Limpa seleção anterior
    if (map.getLayers().getArray().some(l => l.get('highlightLayer'))) {
      const toRemove = map.getLayers().getArray().filter(l => l.get('highlightLayer'));
      toRemove.forEach(l => map.removeLayer(l));
    }

    // Consulta as demais camadas normalmente
    for (const layerInfo of queryLayers) {
      const lyr = layers[layerInfo.key];
      if (lyr && lyr.getVisible()) {
        let infoFormat = 'application/json';
        if (layerInfo.key === 'layer4') infoFormat = 'application/json';
        const url = lyr.getSource().getFeatureInfoUrl(
          coord,
          resolution,
          'EPSG:3857',
          {
            'INFO_FORMAT': infoFormat,
            'QUERY_LAYERS': layerInfo.queryLayer,
            'LAYERS': layerInfo.queryLayer // Garante que LAYERS seja igual ao nome correto
          }
        );
        if (url) {
          try {
            console.log('Consultando camada:', layerInfo.name, url);
            const response = await fetch(url);
            let data = null;
            let isJson = true;
            try {
              data = await response.clone().json();
            } catch (e) {
              isJson = false;
            }
            if (isJson && data && data.features && data.features.length > 0) {
              console.log('Features encontradas para', layerInfo.name, data.features);
              const props = data.features[0].properties;
              let currentHtml = `<div style=\"font-size:14px;max-width:320px;\"><strong>${layerInfo.name}</strong><br><table style=\"border-collapse:collapse;width:100%\">`;
              for (const key in props) {
                if (key === 'geometry' || key === 'id') continue;
                if (layerInfo.key === 'layer_imoveis_snci' && snciHidden.includes(key)) continue;
                if (layerInfo.key === 'layer_imoveis_sigef' && sigefHidden.includes(key)) continue;
                let label = key;
                if (layerInfo.key === 'layer2' && eixoMap[key]) label = eixoMap[key];
                if (layerInfo.key === 'layer4' && zoneamentoMap[key]) label = zoneamentoMap[key];
                if (layerInfo.key === 'layer3' && loteMap[key]) label = loteMap[key];
                if (layerInfo.key === 'layer_edificacoes' && edificacoesMap[key]) label = edificacoesMap[key];
                if (layerInfo.key === 'layer_imoveis_snci' && snciMap[key]) label = snciMap[key];
                if (layerInfo.key === 'layer_imoveis_sigef' && sigefMap[key]) label = sigefMap[key];
                currentHtml += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${label}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
              }
              currentHtml += '</table></div>';
              const format = new GeoJSON();
              const feats = format.readFeatures(data, {
                dataProjection: 'EPSG:3857',
                featureProjection: map.getView().getProjection()
              });
              highlightSource.addFeatures(feats);
              if (layerInfo.key === 'layer3' && feats.length > 0) {
                loteExtent = feats[0].getGeometry().getExtent();
              }
              if (layerInfo.key === 'layer2' && feats.length > 0) {
                eixoExtent = feats[0].getGeometry().getExtent();
              }
              if (!zoomed && feats.length > 0) {
                // Não faz zoom aqui, faz depois conforme prioridade
              }
              if (layerInfo.key === 'layer2') {
                eixoHtml = currentHtml;
                console.log('Popup do Eixo de Adensamento gerado:', eixoHtml);
              } else if (layerInfo.key === 'layer3') {
                loteHtml = currentHtml;
              } else if (layerInfo.key === 'layer4') {
                zoneamentoHtml = currentHtml;
              } else {
                otherHtml += currentHtml;
              }
            } else {
              console.log('Nenhuma feição encontrada para', layerInfo.name);
            }
          } catch (e) {
            otherHtml += `<div style='color:#c00;font-size:14px;max-width:320px;'><b>${layerInfo.name}:</b> Erro ao buscar informações.</div>`;
            console.error('Erro ao buscar camada', layerInfo.name, e);
          }
        }
      }
    }
    if (highlightSource.getFeatures().length > 0) {
      map.addLayer(highlightLayer);
    }
    // Zoom: prioriza lote se existir, senão eixo, senão qualquer outra feição
    if (loteExtent) {
      map.getView().fit(loteExtent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    } else if (eixoExtent) {
      map.getView().fit(eixoExtent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    } else if (highlightSource.getFeatures().length > 0) {
      const extent = highlightSource.getFeatures()[0].getGeometry().getExtent();
      map.getView().fit(extent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    }
    // Lógica de exibição dos popups
    if (eixoHtml && loteHtml) {
      // Se Eixo está presente, ignora Zoneamento
      showLotesPopup(map, coord, loteHtml + eixoHtml);
    } else if (eixoHtml) {
      showLotesPopup(map, coord, eixoHtml);
    } else if (loteHtml && zoneamentoHtml) {
      showLotesPopup(map, coord, loteHtml + zoneamentoHtml);
    } else if (loteHtml) {
      showLotesPopup(map, coord, loteHtml);
    } else if (zoneamentoHtml) {
      showLotesPopup(map, coord, zoneamentoHtml);
    } else if (otherHtml) {
      showLotesPopup(map, coord, otherHtml);
    }
  });
}
