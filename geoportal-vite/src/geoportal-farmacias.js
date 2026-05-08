import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import { Style, Icon, Text, Fill, Circle, Stroke } from 'ol/style.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { toLonLat } from 'ol/proj.js';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';
import { escapeHtml, fetchWithTimeout } from './geoportal-utils.js';
import { showGeoportalNotice } from './geoportal-notice.js';

const FARMACIAS_WFS_URL = 'https://geoserver.amambai.ms.gov.br/geoserver/wfs?' +
  'service=WFS&version=2.0.0&request=GetFeature&typeName=ne:Farm%C3%A1cias' +
  '&outputFormat=application/json&SRSNAME=EPSG:32721';

// Obter dia atual do mês
function getTodayDay() {
  return new Date().getDate();
}

// Extrair dias de plantão do campo "Dias_mes"
function extractDaysFromField(diaMesstrText) {
  if (!diaMesstrText) return [];
  
  const daysArray = String(diaMesstrText)
    .split(',')
    .map(day => parseInt(day.trim()))
    .filter(day => !isNaN(day));
  
  return daysArray;
}

// Verificar se uma farmácia está de plantão hoje
function isFarmaciaDeOntem(properties) {
  const todayDay = getTodayDay();
  const daysOfDuty = extractDaysFromField(properties.Dias_mes);
  const isOnDuty = daysOfDuty.includes(todayDay);
  
  return isOnDuty;
}

export function isFarmaciaDePlantao(properties) {
  return isFarmaciaDeOntem(properties || {});
}

function getFarmaciaProperty(properties, names) {
  if (!properties) return '';

  for (const name of names) {
    if (properties[name] !== undefined && properties[name] !== null) {
      return properties[name];
    }
  }

  const propertyKey = Object.keys(properties).find(key =>
    names.some(name => key.toLowerCase() === name.toLowerCase())
  );

  return propertyKey ? properties[propertyKey] : '';
}

function isEmptyValue(value) {
  return value === undefined || value === null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'N/A';
}

function formatPopupValue(value) {
  return isEmptyValue(value) ? 'N/A' : String(value).trim();
}

// Criar estilo para farmácia de plantão (DESTAQUE)
function createDeOntemStyle(feature) {
  return new Style({
    image: new Circle({
      radius: 12,
      fill: new Fill({ color: 'rgba(255, 0, 0, 0.9)' }),
      stroke: new Stroke({ color: 'darkred', width: 3 })
    }),
    text: new Text({
      text: feature.getProperties().Farmacia,
      font: 'bold 14px Arial',
      fill: new Fill({ color: 'red' }),
      offsetY: -25,
      overflow: true,
    }),
  });
}

// Criar VectorLayer apenas para farmácias de plantão (DESTAQUE)
export function createFarmaciasDeOntemLayer() {
  const source = new VectorSource();

  const layer = new VectorLayer({
    source: source,
    style: (feature) => createDeOntemStyle(feature),
    visible: false,
    zIndex: 1000, // Renderiza acima de outras camadas
  });

  layer.set('name', 'layer_farmacias_highlight');
  layer.set('farmaciasLoaded', false);
  layer.set('alreadyZoomed', false);
  layer.set('alreadyOpenedPopup', false);

  // Carregar features de plantão da WFS quando a layer for criada
  fetchWithTimeout(FARMACIAS_WFS_URL)
    .then(response => {
      return response.json();
    })
    .then(data => {
      const allFeatures = new GeoJSON().readFeatures(data, {
        dataProjection: 'EPSG:32721',    // Projeção dos dados do WFS
        featureProjection: 'EPSG:3857'   // Projeção do mapa (Web Mercator)
      });
      
      // Filtrar apenas farmácias de plantão
      const filteredFeatures = allFeatures.filter(feature => 
        isFarmaciaDeOntem(feature.getProperties())
      );
      
      if (filteredFeatures.length > 0) {
        source.addFeatures(filteredFeatures);
      }
      
      layer.set('farmaciasLoaded', true);
      source.dispatchEvent('change');
    })
    .catch(error => {
      layer.set('farmaciasLoaded', true);
      console.error('[Farmácias Highlight] ✗ ERRO:', error);
      showGeoportalNotice({
        type: 'error',
        message: 'Não foi possível consultar os dados no momento.',
        position: 'top-center',
        cooldownKey: 'farmacias-geoserver-error',
        cooldownMs: 8000
      });
    });

  return layer;
}

export function zoomToFarmaciaDePlantao(map, highlightLayer) {
  if (!map || !highlightLayer) return;

  const source = highlightLayer.getSource();
  if (!source) return;

  const focusFarmacias = () => {
    const features = source.getFeatures();
    if (!features || features.length === 0) return false;

    if (features.length === 1) {
      const coord = features[0].getGeometry()?.getCoordinates?.();
      if (!coord) return false;
      map.getView().animate({ center: coord, zoom: 18, duration: 800 });
      return true;
    }

    map.getView().fit(source.getExtent(), {
      maxZoom: 18,
      duration: 800,
      padding: [40, 40, 40, 40]
    });
    return true;
  };

  if (focusFarmacias()) {
    highlightLayer.set('alreadyZoomed', true);
    return;
  }

  if (highlightLayer.get('farmaciasLoaded')) return;

  source.once('addfeature', () => {
    if (!highlightLayer.getVisible() || highlightLayer.get('alreadyZoomed')) return;
    if (focusFarmacias()) {
      highlightLayer.set('alreadyZoomed', true);
    }
  });
}

// Obter farmácias de plantão por camada WFS
export function getFarmaciaMapCoordinate(feature) {
  const geometry = feature?.getGeometry?.();
  if (!geometry) return null;

  const geometryType = geometry.getType?.();
  if (geometryType === 'Point') return geometry.getCoordinates();
  if (geometryType === 'MultiPoint') return geometry.getCoordinates()?.[0] || null;

  const extent = geometry.getExtent?.();
  if (!extent) return null;

  return [
    (extent[0] + extent[2]) / 2,
    (extent[1] + extent[3]) / 2
  ];
}

export function getFarmaciaLonLatFromFeature(feature) {
  const coord = getFarmaciaMapCoordinate(feature);
  return coord ? toLonLat(coord) : null;
}

export function createFarmaciaPopupHTML(properties, options = {}) {
  const isPlantao = options.isPlantao ?? isFarmaciaDePlantao(properties);
  const destinationLonLat = options.destinationLonLat || null;
  const nome = formatPopupValue(getFarmaciaProperty(properties, ['Farmacia', 'Farmacia_nome', 'Nome']));
  const telefone = formatPopupValue(getFarmaciaProperty(properties, ['Telefone', 'Fone']));
  const whatsapp = getFarmaciaProperty(properties, ['Whatsapp', 'WhatsApp', 'WHATSAPP']);
  const whatsappFormatted = formatWhatsappNumber(whatsapp);
  const whatsappLink = generateWhatsappLink(whatsapp);
  const routeUrl = buildGoogleMapsRouteUrl(destinationLonLat);
  const title = isPlantao ? 'Farm&aacute;cia de Plant&atilde;o' : 'Farm&aacute;cia';
  const routeData = destinationLonLat
    ? `data-destination-lon="${Number(destinationLonLat[0])}" data-destination-lat="${Number(destinationLonLat[1])}"`
    : '';

  return `
    <div class="popup-block farmacia-popup farmacia-popup-modern${isPlantao ? ' is-plantao' : ''}">
      <div class="farmacia-popup-header">
        <span class="farmacia-popup-kicker">${title}</span>
        <h3 class="farmacia-popup-title">${escapeHtml(nome)}</h3>
        ${isPlantao ? '<span class="farmacia-popup-badge">Plant&atilde;o hoje</span>' : ''}
      </div>

      <div class="farmacia-popup-contact">
        <div class="farmacia-contact-item">
          <span class="farmacia-contact-label">Telefone</span>
          <strong>${escapeHtml(telefone)}</strong>
        </div>

        <div class="farmacia-contact-item">
          <span class="farmacia-contact-label">WhatsApp</span>
          ${whatsappLink
            ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${escapeHtml(whatsappFormatted)}</a>`
            : `<strong>${escapeHtml(whatsappFormatted)}</strong>`
          }
        </div>
      </div>

      <div class="farmacia-popup-actions">
        ${whatsappLink
          ? `<a class="farmacia-action farmacia-action-whatsapp" href="${whatsappLink}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>`
          : ''
        }
        <a class="farmacia-action farmacia-action-route" href="${routeUrl}" ${routeData} data-farmacia-route="true" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-route" aria-hidden="true"></i> Rota</a>
      </div>
    </div>
  `;
}

export function openFarmaciaDePlantaoPopup(map, highlightLayer, showPopup) {
  if (!map || !highlightLayer || typeof showPopup !== 'function') return;

  const source = highlightLayer.getSource();
  if (!source) return;

  const openPopup = () => {
    const feature = source.getFeatures()?.[0];
    if (!feature) return false;

    const coord = getFarmaciaMapCoordinate(feature);
    const destinationLonLat = getFarmaciaLonLatFromFeature(feature);
    if (!coord || !destinationLonLat) return false;

    const html = createFarmaciaPopupHTML(feature.getProperties(), {
      isPlantao: true,
      destinationLonLat
    });
    showPopup(map, coord, html);
    return true;
  };

  if (openPopup()) {
    highlightLayer.set('alreadyOpenedPopup', true);
    return;
  }

  if (highlightLayer.get('farmaciasLoaded')) return;

  source.once('addfeature', () => {
    if (!highlightLayer.getVisible() || highlightLayer.get('alreadyOpenedPopup')) return;
    if (openPopup()) {
      highlightLayer.set('alreadyOpenedPopup', true);
    }
  });
}

export function setupFarmaciaRouteButtons() {
  if (window.__geoportalFarmaciaRouteButtonsReady) return;
  window.__geoportalFarmaciaRouteButtonsReady = true;

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    const routeButton = event.target.closest('[data-farmacia-route]');
    if (!routeButton) return;

    const destinationLon = Number(routeButton.dataset.destinationLon);
    const destinationLat = Number(routeButton.dataset.destinationLat);
    if (!Number.isFinite(destinationLon) || !Number.isFinite(destinationLat)) return;

    routeButton.href = buildGoogleMapsRouteUrl([destinationLon, destinationLat]);
  });
}

export async function getFarmaciasDeOntemData() {
  try {
    const response = await fetchWithTimeout(FARMACIAS_WFS_URL);
    const data = await response.json();
    const features = new GeoJSON().readFeatures(data, {
      dataProjection: 'EPSG:32721',    // Projeção dos dados do WFS
      featureProjection: 'EPSG:3857'   // Projeção do mapa (Web Mercator)
    });
    
    // Filtrar apenas farmácias em plantão
    const result = features
      .filter(feature => isFarmaciaDeOntem(feature.getProperties()))
      .map(feature => feature.getProperties());
    
    return result;
  } catch (error) {
    console.error('[Farmácias Legenda] Erro ao carregar dados:', error);
    showGeoportalNotice({
      type: 'error',
      message: 'Não foi possível consultar os dados no momento.',
      position: 'top-center',
      cooldownKey: 'farmacias-geoserver-error',
      cooldownMs: 8000
    });
    return [];
  }
}

// Formatar data para exibição
function formatDataBrasilera() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

// Formatar número do WhatsApp
function formatWhatsappNumber(whatsapp) {
  if (!whatsapp || whatsapp === 'N/A') return 'N/A';
  
  // Remove todos os caracteres não numéricos
  const rawNumber = String(whatsapp);
  const cleanNumber = rawNumber.replace(/\D/g, '');
  
  // Se não tiver pelo menos 10 dígitos, retorna como está
  if (cleanNumber.length < 10) return rawNumber;
  
  // Pega os últimos 11 dígitos (para números brasileiros com DDD)
  const last11 = cleanNumber.slice(-11);
  
  // Formata como (xx) xxxxx-xxxx
  const ddd = last11.slice(0, 2);
  const first5 = last11.slice(2, 7);
  const last4 = last11.slice(7);
  
  return `(${ddd}) ${first5}-${last4}`;
}

// Gerar link do WhatsApp
function generateWhatsappLink(whatsapp) {
  if (!whatsapp || whatsapp === 'N/A') return null;
  
  const cleanNumber = String(whatsapp).replace(/\D/g, '');
  if (cleanNumber.length < 10) return null;
  
  const last11 = cleanNumber.slice(-11);
  return `https://wa.me/55${last11}`;
}

// Atualizar painel de legenda com informações de farmácias de plantão
export async function atualizarLegendaBotaoPonta(legendasDiv) {
  const legendaAntigaCompacta = legendasDiv?.querySelector('.legenda-farmacia');
  if (legendaAntigaCompacta) legendaAntigaCompacta.remove();
  return;

  const farmaciasDeOntem = await getFarmaciasDeOntemData();
  
  let legendaHtml = '';
  
  if (farmaciasDeOntem.length > 0) {
    legendaHtml = `
      <div class="legenda-farmacia" style="border: 2px solid red; padding: 10px; margin: 10px 0; border-radius: 5px; background-color: #fff3f3;">
        <h4 style="color: red; margin-top: 0; font-weight: bold;">Farmácia de Plantão - ${formatDataBrasilera()}</h4>
    `;
    
    farmaciasDeOntem.forEach(props => {
      const whatsappFormatted = formatWhatsappNumber(props.Whatsapp);
      const whatsappLink = generateWhatsappLink(props.Whatsapp);
      
      legendaHtml += `
        <div style="margin: 8px 0; padding: 8px; border-bottom: 1px solid #ddd;">
          <strong>${escapeHtml(props.Farmacia || 'N/A')}</strong><br>
          📞 ${escapeHtml(props.Telefone || 'N/A')}<br>
          ${whatsappLink ? 
            `<a href="${whatsappLink}" target="_blank" style="color: #25d366; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> ${escapeHtml(whatsappFormatted)}
            </a>` : 
            `<span style="color: #666; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> ${escapeHtml(whatsappFormatted)}
            </span>`
          }
        </div>
      `;
    });
    
    legendaHtml += '</div>';
  } else {
    legendaHtml = `
      <div class="legenda-farmacia" style="border: 1px solid orange; padding: 10px; margin: 10px 0; border-radius: 5px; background-color: #fffbf0;">
        <h4 style="color: orange; margin-top: 0;">Farmácia de Plantão - ${formatDataBrasilera()}</h4>
        <p style="margin: 0; color: gray;">Nenhuma farmácia de plantão para hoje.</p>
      </div>
    `;
  }
  
  // Remove legenda anterior de farmácias se existir
  const legendaAntiga = legendasDiv.querySelector('.legenda-farmacia');
  if (legendaAntiga) {
    legendaAntiga.remove();
  }
  
  // Adiciona nova legenda se houver
  if (legendaHtml) {
    legendasDiv.insertAdjacentHTML('afterbegin', legendaHtml);
  }
}
