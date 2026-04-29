import GeoJSON from 'ol/format/GeoJSON.js';
import { fromLonLat } from 'ol/proj.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import { extend as extendExtent } from 'ol/extent.js';
import { POSTE_FORM_CONFIG } from './geoportal-config.js';
import { createPostePopupHTML } from './geoportal-postes-reparo.js';
// FunÃ§Ãµes de busca (BIC, endereÃ§o, fazenda) usando ES Modules do OpenLayers
export function setupSearchHandlers(map, layers, showLotesPopup, onLayersChanged = () => {}) {
  const ADDRESS_APPROX_MIN_DIFF = 150;
  const ADDRESS_APPROX_MAX_DIFF = 200;
  const ADDRESS_APPROX_PERCENT = 0.05;

  // Limpa o campo de busca ao trocar o tipo
  const searchType = document.getElementById('search-type');
  const searchInput = document.getElementById('search-input');
  const searchPlaceholders = {
    bic: 'Digite o n\u00famero do BIC',
    endereco: 'Ex.: Pedro Manvailer, 9999',
    poste: 'Digite o n\u00famero do poste',
    fazenda: 'Digite o nome do im\u00f3vel, ch\u00e1cara ou fazenda',
  };

  function updateSearchPlaceholder() {
    if (!searchType || !searchInput) return;
    searchInput.placeholder = searchPlaceholders[searchType.value] || '';
  }

  function collapseSearchBoxOnMobile() {
    if (window.matchMedia('(max-width: 600px)').matches) {
      const searchBox = document.querySelector('.search-box');
      if (searchBox) searchBox.classList.remove('expanded');
    }
  }

  let searchNoticeTimeout = null;

  function showSearchNotice(message) {
    const existingNotice = document.getElementById('geoportal-search-notice');
    if (existingNotice) {
      existingNotice.remove();
    }

    if (searchNoticeTimeout) {
      window.clearTimeout(searchNoticeTimeout);
      searchNoticeTimeout = null;
    }

    const notice = document.createElement('div');
    notice.id = 'geoportal-search-notice';
    notice.textContent = message;
    Object.assign(notice.style, {
      position: 'fixed',
      top: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '3200',
      maxWidth: 'min(420px, calc(100vw - 32px))',
      padding: '10px 14px',
      borderRadius: '10px',
      background: 'rgba(34, 49, 63, 0.94)',
      color: '#fff',
      fontSize: '14px',
      lineHeight: '1.4',
      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
      pointerEvents: 'none',
      textAlign: 'center'
    });

    document.body.appendChild(notice);

    searchNoticeTimeout = window.setTimeout(() => {
      notice.remove();
      searchNoticeTimeout = null;
    }, 3000);
  }

  function buildEnderecoCqlFilter(rawQuery) {
    const parsed = parseEnderecoQuery(rawQuery);
    return buildRuaCandidatesCqlFilter(parsed);
  }

  function parseEnderecoQuery(rawQuery) {
    const sanitized = rawQuery.replace(/\s+/g, ' ').trim();
    const numberMatches = sanitized.match(/\d+/g) || [];
    const targetNumber = numberMatches.length > 0
      ? parseInt(numberMatches[numberMatches.length - 1], 10)
      : null;

    const normalizedStreet = sanitized
      .replace(/[\.,;:\/\\\-'"()]+/g, ' ')
      .replace(/\b(?:n(?:[\u00BA\u00B0o])?|numero)\s*(?=\d)/gi, ' ')
      .replace(/^\s*(?:rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|rodovia|estrada)\s+/i, '')
      .replace(/\b(?:de|da|do|das|dos)\b/gi, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const streetTokens = [...new Set(
      normalizedStreet
        .split(' ')
        .map(token => token.trim())
        .filter(token => token.length > 2)
    )];

    return {
      streetTokens,
      streetText: streetTokens.join(' '),
      targetNumber,
      hasNumber: Number.isInteger(targetNumber)
    };
  }

  function buildRuaCandidatesCqlFilter(parsed) {
    if (!parsed || !parsed.streetTokens || parsed.streetTokens.length === 0) {
      return '';
    }

    const streetText = (parsed.streetText || '').replace(/'/g, "''");
    const tokenFilter = parsed.streetTokens
      .map(token => `endereco ILIKE '%${token.replace(/'/g, "''")}%'`)
      .join(' AND ');

    if (!streetText) {
      return tokenFilter;
    }

    return `(endereco ILIKE '%${streetText}%' OR (${tokenFilter}))`;
  }

  function extractNumeroFromEndereco(endereco) {
    if (!endereco) return null;

    const matches = String(endereco).match(/\d+/g);

    if (!matches || matches.length === 0) return null;

    const numero = Number.parseInt(matches[matches.length - 1], 10);
    return Number.isInteger(numero) ? numero : null;
  }

  function findClosestAddressFeature(features, targetNumber) {
    const normalizedTargetNumber = Number(targetNumber);
    if (!Array.isArray(features) || !Number.isInteger(normalizedTargetNumber)) return null;

    const maxDiff = Math.min(
      ADDRESS_APPROX_MAX_DIFF,
      Math.max(
        ADDRESS_APPROX_MIN_DIFF,
        Math.round(normalizedTargetNumber * ADDRESS_APPROX_PERCENT)
      )
    );
    const candidates = features
      .map(feature => {
        const numero = Number(extractNumeroFromEndereco(feature?.properties?.endereco));
        if (!Number.isInteger(numero)) return null;

        return {
          feature,
          numero,
          diff: Math.abs(numero - normalizedTargetNumber)
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.diff !== b.diff) return a.diff - b.diff;

        const parityA = a.numero % 2 === normalizedTargetNumber % 2 ? 0 : 1;
        const parityB = b.numero % 2 === normalizedTargetNumber % 2 ? 0 : 1;

        if (parityA !== parityB) return parityA - parityB;
        return a.numero - b.numero;
      });

    if (candidates.length === 0) return null;
    if (candidates[0].diff > maxDiff) return null;

    return {
      ...candidates[0],
      maxDiff
    };
  }

  function ensureLotesLayerVisible() {
    if (layers['layer3'] && !layers['layer3'].getVisible()) {
      layers['layer3'].setVisible(true);
      const checkbox = document.getElementById('layer3');
      if (checkbox) checkbox.checked = true;
      onLayersChanged();
    }
  }

  function showAreaUrbanaFeatureResult(feature, titleHtml, extraHtml = '') {
    const format = new GeoJSON();
    const olFeature = format.readFeature(feature, {
      dataProjection: 'EPSG:32721',
      featureProjection: map.getView().getProjection()
    });

    let html = `<div style='font-size:14px;max-width:320px;'><strong>${titleHtml}</strong>`;
    if (extraHtml) {
      html += `<div style='margin:8px 0 10px;'>${extraHtml}</div>`;
    }
    html += `<table style='border-collapse:collapse;width:100%'>`;
    for (const key in feature.properties) {
      if (key === 'geometry' || key === 'id') continue;
      html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
    }
    html += '</table></div>';

    highlightLayer = new VectorLayer({
      source: new VectorSource({ features: [olFeature] }),
      style: new Style({
        stroke: new Stroke({ color: '#ff0', width: 3 }),
        fill: new Fill({ color: 'rgba(255,255,0,0.2)' })
      })
    });
    map.addLayer(highlightLayer);

    const extent = olFeature.getGeometry().getExtent();
    const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    map.getView().fit(extent, { maxZoom: 19, duration: 800, padding: [40,40,40,40] });
    showLotesPopup(map, center, html);
    collapseSearchBoxOnMobile();
  }

  if (searchType && searchInput) {
    searchType.addEventListener('change', () => {
      searchInput.value = '';
      updateSearchPlaceholder();
    });
    updateSearchPlaceholder();
  }

  // Vetor para seleÃ§Ã£o visual das feiÃ§Ãµes encontradas
  let highlightLayer = null;

  // Remove seleÃ§Ã£o apenas ao clicar fora do mapa, popups e ferramentas
  document.addEventListener('mousedown', function(e) {
    // NÃ£o remove se clicar em popup, search-box, toolbox (ferramentas) ou botÃµes de ferramentas
    const popup = document.querySelector('.ol-popup');
    const searchBox = document.querySelector('.search-box');
    const toolbox = document.querySelector('.toolbox');
    // Se clicar em qualquer elemento dentro da toolbox (mediÃ§Ã£o, impressÃ£o, etc), nÃ£o remove
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
    // Remove seleÃ§Ã£o anterior (destaque de busca)
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    // Remove seleÃ§Ã£o anterior (destaque de clique)
    if (map.getLayers().getArray().some(l => l.get('highlightLayer'))) {
      const toRemove = map.getLayers().getArray().filter(l => l.get('highlightLayer'));
      toRemove.forEach(l => map.removeLayer(l));
    }
    if (searchType === 'bic' || searchType === 'endereco') {
      // Busca para BIC e EndereÃ§o
      let typeName, field, value, op, label, cqlFilter;
      const parsedEndereco = searchType === 'endereco' ? parseEnderecoQuery(query) : null;
      typeName = 'ne:area_urbana';
      field = searchType === 'bic' ? 'bic' : 'endereco';
      value = searchType === 'bic' ? query : null;
      op = searchType === 'bic' ? '=' : 'ILIKE';
      label = searchType === 'bic' ? 'BIC' : 'Endere\u00e7o';
      cqlFilter = searchType === 'bic'
        ? `${field} ${op} '${value}'`
        : buildEnderecoCqlFilter(query);
      if (searchType === 'endereco' && !cqlFilter) {
        alert(`${label} n\u00e3o encontrado.`);
        return;
      }
      const maxFeaturesParam = searchType === 'endereco' ? '&maxFeatures=300' : '';
      const wfsUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json${maxFeaturesParam}&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;
      try {
        const response = await fetch(wfsUrl);
        const data = await response.json();
        const features = Array.isArray(data.features) ? data.features : [];
        if (searchType === 'endereco' && parsedEndereco && !parsedEndereco.hasNumber) {
          if (features.length > 0) {
            const format = new GeoJSON();
            let extent = null;

            features.forEach(feature => {
              const olFeature = format.readFeature(feature, {
                dataProjection: 'EPSG:32721',
                featureProjection: map.getView().getProjection()
              });
              const geometry = olFeature.getGeometry();
              if (!geometry) return;

              const featureExtent = geometry.getExtent();
              if (!extent) {
                extent = featureExtent.slice();
              } else {
                extendExtent(extent, featureExtent);
              }
            });

            if (extent) {
              map.getView().fit(extent, {
                maxZoom: 19,
                padding: [80, 80, 80, 80],
                duration: 500
              });
              showSearchNotice('Rua localizada. Informe o n\u00famero para um resultado mais preciso.');
              collapseSearchBoxOnMobile();
            } else {
              alert(`${label} n\u00e3o encontrado.`);
            }
          } else {
            alert(`${label} n\u00e3o encontrado.`);
          }
        } else if (searchType === 'endereco' && parsedEndereco?.hasNumber) {
          const exactNumberFeatures = features.filter(
            feature => extractNumeroFromEndereco(feature.properties?.endereco) === parsedEndereco.targetNumber
          );

          if (exactNumberFeatures.length > 0) {
            ensureLotesLayerVisible();
            showAreaUrbanaFeatureResult(
              exactNumberFeatures[0],
              `${label} encontrado: ${query}`
            );
          } else {
            try {
              const closestMatch = findClosestAddressFeature(features, parsedEndereco.targetNumber);

              if (!closestMatch) {
                alert(`${label} n\u00e3o encontrado.`);
                return;
              }

              ensureLotesLayerVisible();

              const foundAddress = closestMatch.feature.properties?.endereco || 'N/A';
              const warningHtml = `
                <div style='padding:8px;margin-bottom:8px;border:1px solid #ead7a5;border-radius:6px;background:#fff8e6;color:#2c3e50;'>
                  <div style='font-weight:700;margin-bottom:4px;'>&#8505;&#65039; Endere\u00e7o aproximado</div>
                  <div>O n\u00famero exato n\u00e3o foi localizado. Exibindo o endere\u00e7o mais pr\u00f3ximo encontrado na base cadastral do munic\u00edpio.</div>
                  <div style='margin-top:6px;'>
                    <strong>Endere\u00e7o buscado:</strong> ${query}<br>
                    <strong>Endere\u00e7o encontrado:</strong> ${foundAddress}<br>
                    <strong>Diferen\u00e7a aproximada:</strong> ${closestMatch.diff} n\u00fameros
                  </div>
                </div>
              `;

              showAreaUrbanaFeatureResult(
                closestMatch.feature,
                'Endere\u00e7o aproximado encontrado',
                warningHtml
              );
            } catch (fallbackError) {
              alert(`${label} n\u00e3o encontrado.`);
            }
          }
        } else if (features.length > 0) {
          // Se busca por BIC ou Endereco e camada de lotes nao esta visivel, ativa
          ensureLotesLayerVisible();
          const feature = features[0];
          showAreaUrbanaFeatureResult(feature, `${label} encontrado: ${query}`);
        } else {
          alert(`${label} n\u00e3o encontrado.`);
        }
      } catch (e) {
        alert(`Erro ao buscar por ${label}.`);
      }
      return;
    }
    if (searchType === 'poste') {
      const posteId = query.trim();
      if (!/^\d+$/.test(posteId)) {
        alert('Digite um ID de poste vÃ¡lido.');
        return;
      }

      const posteLayer = layers['layer_postes'];
      if (posteLayer && !posteLayer.getVisible()) {
        posteLayer.setVisible(true);
        const checkbox = document.getElementById('layer_postes');
        if (checkbox) checkbox.checked = true;
        onLayersChanged();
      }

      const posteUrl = `https://geoserver.amambai.ms.gov.br/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=ne:Postes%20-%20IDs%20-%20AU&outputFormat=application/json&SRSNAME=EPSG:32721&CQL_FILTER=IDs_coord%20%3D%20${encodeURIComponent(posteId)}`;
      try {
        const response = await fetch(posteUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const format = new GeoJSON();
          const olFeature = format.readFeature(feature, {
            dataProjection: 'EPSG:32721',
            featureProjection: map.getView().getProjection()
          });

          highlightLayer = new VectorLayer({
            source: new VectorSource({ features: [olFeature] }),
            style: new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: 'rgba(255,255,0,0.35)' }),
                stroke: new Stroke({ color: '#ff0', width: 3 })
              })
            })
          });
          map.addLayer(highlightLayer);

          const coord = olFeature.getGeometry().getCoordinates();
          map.getView().animate({ center: coord, zoom: 19, duration: 800 });

          const html = createPostePopupHTML(
            feature.properties,
            coord,
            POSTE_FORM_CONFIG.baseUrl,
            POSTE_FORM_CONFIG.fields
          );
          showLotesPopup(map, coord, html);
          collapseSearchBoxOnMobile();
        } else {
          alert('Poste nÃ£o encontrado.');
        }
      } catch (e) {
        alert('Erro ao buscar poste.');
      }
      return;
    }
    if (searchType === 'fazenda') {
      const sigefLayer = layers['layer_imoveis_sigef'];
      const snciLayer = layers['layer_imoveis_snci'];
      let layersChanged = false;
      // Ativa as camadas SIGEF e SNCI se não estiverem visíveis
      if (sigefLayer && !sigefLayer.getVisible()) {
        sigefLayer.setVisible(true);
        const checkbox = document.getElementById('layer_imoveis_sigef');
        if (checkbox) checkbox.checked = true;
        layersChanged = true;
      }
      if (snciLayer && !snciLayer.getVisible()) {
        snciLayer.setVisible(true);
        const checkbox = document.getElementById('layer_imoveis_snci');
        if (checkbox) checkbox.checked = true;
        layersChanged = true;
      }
      if (layersChanged) onLayersChanged();
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
        collapseSearchBoxOnMobile();
      }
      return;
    }
  });
}

