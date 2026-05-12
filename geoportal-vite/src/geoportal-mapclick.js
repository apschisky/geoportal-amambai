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
import CircleStyle from 'ol/style/Circle.js';
import { toLonLat, transformExtent } from 'ol/proj.js';
import { LAYER_CONFIG, POSTE_FORM_CONFIG } from './geoportal-config.js';
import { createFarmaciaPopupHTML, getFarmaciaLonLatFromFeature, getFarmaciaMapCoordinate, isFarmaciaDePlantao } from './geoportal-farmacias.js';
import { createLocalInteressePopupHTML, getLocalInteresseCoordinate, getLocalInteresseLonLatFromFeature } from './geoportal-locais-interesse.js';
import { createPostePopupHTML, queryPosteLayerWithBuffer } from './geoportal-postes-reparo.js';
import { escapeHtml, fetchWithTimeout, getGeoServerErrorMessage } from './geoportal-utils.js';
import { showGeoportalNotice } from './geoportal-notice.js';
import { getMeasureActive, setNextPopupRefreshCoord, setNextPopupSource } from './geoportal-state.js';
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
  // Mapeamento amigável para a camada Coleta de Lixo
  const coletaMap = {
    dias: 'Rejeito e lixo úmido',
    dias_recic: 'Recicláveis',
    'hora_nao_recic': 'Horário Rejeito e lixo úmido',
    hora_recic: 'Horário Recicláveis',
    setor: 'Setor'
  };
  map.on('singleclick', async function(evt) {
    if (getMeasureActive()) return; // Bloqueia seleção/popup durante medição
    const view = map.getView();
    const coord = evt.coordinate;
    const resolution = view.getResolution();
    // Lista de camadas para buscar info (inclui Eixo de Adensamento)
    const queryLayers = [
      { key: 'layer2', name: 'Eixo de Adensamento', queryLayer: 'ne:EixoDeAdensamento' },
      { key: 'layer3', name: 'Lote', queryLayer: 'ne:area_urbana' },
  { key: 'layer4', name: 'Zoneamento Urbano', queryLayer: 'ne:ZoneamentoUrbano_PD_novo' },
  { key: 'layer_edificacoes', name: 'Edificações', queryLayer: 'ne:EdificacoesDB' },
  { key: 'layer_coleta', name: 'Coleta de Lixo', queryLayer: 'ne:Coleta' },
      { key: 'layer_imoveis_sigef', name: 'Imóveis SIGEF', queryLayer: 'ne:Imóveis SIGEF 05_25' },
      { key: 'layer_imoveis_snci', name: 'Imóveis SNCI', queryLayer: 'ne:Imóveis SNCI 05_25' }
    ];
    const locaisInteresseLayers = [
      { key: 'layer_assistencia_social', name: 'Assistência Social' },
      { key: 'layer_educacao', name: 'Educação' },
      { key: 'layer_prefeitura', name: 'Prefeitura' },
      { key: 'layer_saude', name: 'Saúde' }
    ];
  let html = '';
  let loteHtml = '';
  let eixoHtml = '';
  let zoneamentoHtml = '';
  let coletaHtml = '';
  let edificacoesHtml = '';
  let otherHtml = '';
    let zoomed = false;
    let loteExtent = null;
    let eixoExtent = null;
    let posteCoord = null;
    let farmaciaHtml = '';
    let farmaciaCoord = null;
    let localInteresseHtml = '';
    let localInteresseCoord = null;
    let mapClickNoticeShown = false;
    const showMapClickErrorNotice = error => {
      if (mapClickNoticeShown) return;
      mapClickNoticeShown = true;
      showGeoportalNotice({
        type: 'error',
        message: getGeoServerErrorMessage(error),
        position: 'top-center',
        cooldownKey: 'mapclick-geoserver-error',
        cooldownMs: 8000
      });
    };
    // Remove highlight anterior
    if (map.getLayers().getArray().some(l => l.get('highlightLayer'))) {
      const toRemove = map.getLayers().getArray().filter(l => l.get('highlightLayer'));
      toRemove.forEach(l => map.removeLayer(l));
    }
    // Camada de destaque
    const highlightSource = new VectorSource();
    const polygonHighlightStyle = new Style({
      stroke: new Stroke({ color: '#ff0', width: 3 }),
      fill: new Fill({ color: 'rgba(255,255,0,0.2)' })
    });
    const pointHighlightStyle = new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: 'rgba(255,255,0,0.35)' }),
        stroke: new Stroke({ color: '#ff0', width: 3 })
      })
    });
    const highlightLayer = new VectorLayer({
      source: highlightSource,
      style: feature => {
        const geometryType = feature.getGeometry()?.getType?.();
        return geometryType === 'Point' || geometryType === 'MultiPoint'
          ? pointHighlightStyle
          : polygonHighlightStyle;
      }
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
            const response = await fetchWithTimeout(url);
            let data = null;
            let isJson = true;
            try {
              data = await response.clone().json();
            } catch (e) {
              isJson = false;
            }
            if (isJson && data && data.features && data.features.length > 0) {
              const props = data.features[0].properties;
              // Usa classes CSS para o bloco do popup e o título (manutenção mais fácil)
              let currentHtml = `<div class=\"popup-block\"><div class=\"popup-title\">${layerInfo.name}</div><table style=\"border-collapse:collapse;width:100%\">`;
              for (const key in props) {
                if (key === 'geometry' || key === 'id') continue;
                if (layerInfo.key === 'layer_imoveis_snci' && snciHidden.includes(key)) continue;
                if (layerInfo.key === 'layer_imoveis_sigef' && sigefHidden.includes(key)) continue;
                let label = key;
                if (layerInfo.key === 'layer2' && eixoMap[key]) label = eixoMap[key];
                if (layerInfo.key === 'layer4' && zoneamentoMap[key]) label = zoneamentoMap[key];
                if (layerInfo.key === 'layer3' && loteMap[key]) label = loteMap[key];
                if (layerInfo.key === 'layer_edificacoes' && edificacoesMap[key]) label = edificacoesMap[key];
                if (layerInfo.key === 'layer_coleta' && coletaMap[key]) label = coletaMap[key];
                if (layerInfo.key === 'layer_imoveis_snci' && snciMap[key]) label = snciMap[key];
                if (layerInfo.key === 'layer_imoveis_sigef' && sigefMap[key]) label = sigefMap[key];
                currentHtml += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${escapeHtml(label)}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${escapeHtml(props[key])}</td></tr>`;
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
              } else if (layerInfo.key === 'layer3') {
                loteHtml = currentHtml;
              } else if (layerInfo.key === 'layer4') {
                zoneamentoHtml = currentHtml;
              } else if (layerInfo.key === 'layer_edificacoes') {
                // Mantém popup separado para Edificações para permitir concatenação com Lote
                edificacoesHtml = currentHtml;
              } else if (layerInfo.key === 'layer_coleta') {
                // Mantém popup separado para Coleta para permitir concatenação com Lote
                coletaHtml = currentHtml;
              } else {
                otherHtml += currentHtml;
              }
            }
          } catch (e) {
            otherHtml += `<div style='color:#c00;font-size:14px;max-width:320px;'><b>${escapeHtml(layerInfo.name)}:</b> ${escapeHtml(getGeoServerErrorMessage(e))}</div>`;
            showMapClickErrorNotice(e);
          }
        }
      }
    }

    // Consulta para camada de Postes (tratamento especial: sem zoom automático)
    // Implementa busca com buffer de 10m selecionando o poste mais próximo
    let posteHtml = '';
    const posteLayer = layers['layer_postes'];
    if (posteLayer && posteLayer.getVisible()) {
      try {
        const posteFeature = await queryPosteLayerWithBuffer(coord, '10', true);
        
        if (posteFeature) {
          const olPosteFeature = new GeoJSON().readFeature(posteFeature, {
            dataProjection: 'EPSG:32721',
            featureProjection: map.getView().getProjection()
          });
          const posteGeometry = olPosteFeature.getGeometry();
          if (posteGeometry?.getType?.() === 'Point') {
            posteCoord = posteGeometry.getCoordinates();
          } else if (posteGeometry?.getType?.() === 'MultiPoint') {
            posteCoord = posteGeometry.getCoordinates()[0];
          } else {
            posteCoord = coord;
          }
          highlightSource.addFeature(olPosteFeature);
          // Gerar HTML especial para postes com botão de formulário
          posteHtml = createPostePopupHTML(
            posteFeature.properties,
            posteCoord,
            POSTE_FORM_CONFIG.baseUrl,
            POSTE_FORM_CONFIG.fields
          );
        }
      } catch (error) {
        console.error('[Postes] Erro ao consultar poste no clique:', error);
        showMapClickErrorNotice(error);
      }
    }

    const farmaciaLayer = layers['layer_farmacias'];
    if (farmaciaLayer && farmaciaLayer.getVisible()) {
      try {
        const farmaciaLayerName = LAYER_CONFIG.layer_farmacias.layerName;
        const url = farmaciaLayer.getSource().getFeatureInfoUrl(
          coord,
          resolution,
          'EPSG:3857',
          {
            'INFO_FORMAT': 'application/json',
            'QUERY_LAYERS': farmaciaLayerName,
            'LAYERS': farmaciaLayerName,
            'FEATURE_COUNT': 5
          }
        );

        if (url) {
          const response = await fetchWithTimeout(url);
          const data = await response.json();
          const farmaciaFeatureData = data?.features?.[0];

          if (farmaciaFeatureData) {
            const farmaciaFeature = new GeoJSON().readFeature(farmaciaFeatureData, {
              dataProjection: 'EPSG:3857',
              featureProjection: map.getView().getProjection()
            });

            farmaciaCoord = getFarmaciaMapCoordinate(farmaciaFeature) || coord;
            const destinationLonLat = getFarmaciaLonLatFromFeature(farmaciaFeature) || toLonLat(coord);
            highlightSource.addFeature(farmaciaFeature);
            farmaciaHtml = createFarmaciaPopupHTML(farmaciaFeatureData.properties, {
              isPlantao: isFarmaciaDePlantao(farmaciaFeatureData.properties),
              destinationLonLat
            });
          }
        }
      } catch (error) {
        console.error('[Farmácias] Erro ao consultar farmácia no clique:', error);
        showMapClickErrorNotice(error);
      }
    }

    for (const layerInfo of locaisInteresseLayers) {
      if (localInteresseHtml) break;

      const localLayer = layers[layerInfo.key];
      if (!localLayer || !localLayer.getVisible()) continue;

      try {
        const layerName = LAYER_CONFIG[layerInfo.key]?.layerName;
        const url = localLayer.getSource().getFeatureInfoUrl(
          coord,
          resolution,
          'EPSG:3857',
          {
            'INFO_FORMAT': 'application/json',
            'QUERY_LAYERS': layerName,
            'LAYERS': layerName,
            'FEATURE_COUNT': 5
          }
        );

        if (!url) continue;

        const response = await fetchWithTimeout(url);
        const data = await response.json();
        const localFeatureData = data?.features?.[0];
        if (!localFeatureData) continue;

        const localFeature = new GeoJSON().readFeature(localFeatureData, {
          dataProjection: 'EPSG:3857',
          featureProjection: map.getView().getProjection()
        });

        localInteresseCoord = getLocalInteresseCoordinate(localFeature) || coord;
        const destinationLonLat = getLocalInteresseLonLatFromFeature(localFeature) || toLonLat(coord);
        highlightSource.addFeature(localFeature);
        localInteresseHtml = createLocalInteressePopupHTML(localFeatureData.properties, {
          category: layerInfo.name,
          destinationLonLat
        });
      } catch (error) {
        console.error('[Locais de Interesse] Erro ao consultar local no clique:', error);
        showMapClickErrorNotice(error);
      }
    }

    if (highlightSource.getFeatures().length > 0) {
      map.addLayer(highlightLayer);
    }
    // Zoom: prioriza lote se existir, senão eixo, senão qualquer outra feição
    // NÃO faz zoom se apenas Postes foram encontrados (requisito especial)
    if (posteCoord) {
      map.getView().cancelAnimations();
      map.getView().animate({ center: posteCoord, zoom: 19, duration: 800 });
    } else if (farmaciaCoord) {
      map.getView().cancelAnimations();
      map.getView().animate({ center: farmaciaCoord, zoom: 19, duration: 800 });
    } else if (localInteresseCoord) {
      map.getView().cancelAnimations();
      map.getView().animate({ center: localInteresseCoord, zoom: 19, duration: 800 });
    } else if (loteExtent) {
      map.getView().fit(loteExtent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    } else if (eixoExtent) {
      map.getView().fit(eixoExtent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    } else if (highlightSource.getFeatures().length > 0) {
      // Só faz zoom se NÃO for só postes
      const extent = highlightSource.getFeatures()[0].getGeometry().getExtent();
      map.getView().fit(extent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    }
    // Lógica de exibição dos popups
    // Prioriza Postes se encontrado (sem as outras camadas)
    if (posteHtml || farmaciaHtml || localInteresseHtml || eixoHtml || loteHtml || zoneamentoHtml || edificacoesHtml || coletaHtml || otherHtml) {
      setNextPopupSource('mapclick');
      setNextPopupRefreshCoord(coord);
    }

    if (posteHtml) {
      showLotesPopup(map, posteCoord || coord, posteHtml);
    } else if (farmaciaHtml) {
      showLotesPopup(map, farmaciaCoord || coord, farmaciaHtml);
    } else if (localInteresseHtml) {
      showLotesPopup(map, localInteresseCoord || coord, localInteresseHtml);
    } else if (eixoHtml && loteHtml) {
      // Se Eixo está presente, ignora Zoneamento
      showLotesPopup(map, coord, loteHtml + eixoHtml);
    } else if (eixoHtml) {
      showLotesPopup(map, coord, eixoHtml);
    } else if (loteHtml && zoneamentoHtml) {
      showLotesPopup(map, coord, loteHtml + zoneamentoHtml);
    } else if (loteHtml && edificacoesHtml) {
      // Quando Lote + Edificações estão ativos, mostrar os dois popups juntos com um separador
      showLotesPopup(map, coord, loteHtml + '<hr class="popup-separator">' + edificacoesHtml);
    } else if (loteHtml && coletaHtml) {
      // Quando Lote + Coleta estão ativos, mostrar os dois popups juntos com um separador
      // Usa classe CSS para o separador entre blocos
      showLotesPopup(map, coord, loteHtml + '<hr class="popup-separator">' + coletaHtml);
    } else if (loteHtml) {
      showLotesPopup(map, coord, loteHtml);
    } else if (edificacoesHtml) {
      showLotesPopup(map, coord, edificacoesHtml);
    } else if (zoneamentoHtml) {
      showLotesPopup(map, coord, zoneamentoHtml);
    } else if (coletaHtml) {
      showLotesPopup(map, coord, coletaHtml);
    } else if (otherHtml) {
      showLotesPopup(map, coord, otherHtml);
    }
  });
}
