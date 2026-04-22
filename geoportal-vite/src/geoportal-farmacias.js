import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import { Style, Icon, Text, Fill, Circle, Stroke } from 'ol/style.js';
import GeoJSON from 'ol/format/GeoJSON.js';

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

  // Carregar features de plantão da WFS quando a layer for criada
  const url = 'https://geoserver.amambai.ms.gov.br/geoserver/wfs?' +
    'service=WFS&version=2.0.0&request=GetFeature&typeName=ne:Farm%C3%A1cias' +
    '&outputFormat=application/json&SRSNAME=EPSG:32721';
  
  fetch(url)
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
      
      source.dispatchEvent('change');
    })
    .catch(error => {
      console.error('[Farmácias Highlight] ✗ ERRO:', error);
    });

  return layer;
}

// Obter farmácias de plantão por camada WFS
export async function getFarmaciasDeOntemData() {
  try {
    const url = 'https://geoserver.amambai.ms.gov.br/geoserver/wfs?' +
      'service=WFS&version=2.0.0&request=GetFeature&typeName=ne:Farm%C3%A1cias' +
      '&outputFormat=application/json&SRSNAME=EPSG:32721';
    
    const response = await fetch(url);
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
  const cleanNumber = whatsapp.replace(/\D/g, '');
  
  // Se não tiver pelo menos 10 dígitos, retorna como está
  if (cleanNumber.length < 10) return whatsapp;
  
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
  
  const cleanNumber = whatsapp.replace(/\D/g, '');
  if (cleanNumber.length < 10) return null;
  
  const last11 = cleanNumber.slice(-11);
  return `https://wa.me/55${last11}`;
}

// Atualizar painel de legenda com informações de farmácias de plantão
export async function atualizarLegendaBotaoPonta(legendasDiv) {
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
          <strong>${props.Farmacia || 'N/A'}</strong><br>
          📞 ${props.Telefone || 'N/A'}<br>
          ${whatsappLink ? 
            `<a href="${whatsappLink}" target="_blank" style="color: #25d366; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> ${whatsappFormatted}
            </a>` : 
            `<span style="color: #666; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> ${whatsappFormatted}
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
