// Funções para gerenciar solicitação de reparo de postes
// Integra com Google Forms pré-preenchido

import { toLonLat, transform } from 'ol/proj.js';

/**
 * Formata as coordenadas de um clique do mapa para lat/lon com 6 casas decimais
 * @param {Array} coord - Coordenada do OpenLayers (geralmente em EPSG:3857)
 * @returns {string} String formatada "lat, lon"
 */
export function formatPosteCoordinates(coord) {
  if (!coord || coord.length < 2) {
    return 'Coordenadas indisponíveis';
  }
  try {
    // Converte de EPSG:3857 (WebMercator) para lat/lon (EPSG:4326)
    const lonlat = toLonLat(coord);
    // Formato: latitude, longitude com 6 casas decimais
    const lat = parseFloat(lonlat[1]).toFixed(6);
    const lon = parseFloat(lonlat[0]).toFixed(6);
    return `${lat}, ${lon}`;
  } catch (error) {
    return 'Coordenadas indisponíveis';
  }
}

/**
 * Constrói a URL do Google Forms com parâmetros pré-preenchidos
 * @param {Object} data - Objeto com { identificacaoPoste, coordenadas }
 * @param {string} formBaseUrl - URL base do formulário
 * @param {Object} formFields - Mapeamento de campos do formulário
 * @returns {string} URL completa com parâmetros
 */
export function buildPosteRepairFormUrl(data, formBaseUrl, formFields) {
  const params = new URLSearchParams();
  
  if (data.identificacaoPoste !== undefined && 
      data.identificacaoPoste !== null && 
      String(data.identificacaoPoste).trim() !== '') {
    params.set(formFields.identificacaoPoste, String(data.identificacaoPoste));
  }
  
  if (data.coordenadas) {
    params.set(formFields.coordenadas, data.coordenadas);
  }
  
  return `${formBaseUrl}&${params.toString()}`;
}

/**
 * Cria o HTML do popup para solicitação de reparo de poste
 * @param {Object} properties - Propriedades da feição do WMS
 * @param {Array} coordinate - Coordenada do clique
 * @param {string} formBaseUrl - URL base do formulário
 * @param {Object} formFields - Mapeamento de campos do formulário
 * @returns {string} HTML do popup
 */
export function createPostePopupHTML(properties, coordinate, formBaseUrl, formFields) {
  // Busca o ID do poste com fallbacks
  const id = properties['IDs_coord'] || 
             properties['ids_coord'] || 
             properties['ID'] || 
             properties['id'] || 
             'Não identificado';
  
  // Formata as coordenadas
  const coords = formatPosteCoordinates(coordinate);
  
  // Constrói a URL do formulário
  const formUrl = buildPosteRepairFormUrl(
    { identificacaoPoste: id, coordenadas: coords },
    formBaseUrl,
    formFields
  );
  
  // Constrói o HTML do popup
  const html = `
    <div class="popup-block">
      <div class="popup-title">Poste</div>
      <table style="border-collapse:collapse;width:100%">
        <tr>
          <td style="border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;">
            <b>ID do Poste</b>
          </td>
          <td style="border:1px solid #ccc;padding:4px 8px;">
            ${id}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;">
            <b>Coordenadas</b>
          </td>
          <td style="border:1px solid #ccc;padding:4px 8px;">
            ${coords}
          </td>
        </tr>
      </table>
      <div style="margin-top:12px;text-align:center;">
        <a href="${formUrl}" 
           target="_blank" 
           rel="noopener noreferrer"
           style="display:inline-block;padding:8px 16px;background:#25d366;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;cursor:pointer;">
          <i class="fa-brands fa-whatsapp" style="margin-right:6px;"></i>Solicitar Reparo
        </a>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Consulta a camada de postes usando GetFeatureInfo
 * @param {Object} map - Instância do mapa OpenLayers
 * @param {Object} layerConfig - Configuração da camada (de LAYER_CONFIG)
 * @param {Array} coord - Coordenada do clique em EPSG:3857
 * @param {number} resolution - Resolução atual do mapa
 * @returns {Promise<Object|null>} Propriedades da feição ou null
 */
export async function queryPosteLayer(map, layerConfig, coord, resolution) {
  try {
    const url = map.getLayers().getArray()
      .find(lyr => lyr.get('name') === 'layer_postes')
      ?.getSource()
      ?.getFeatureInfoUrl(
        coord,
        resolution,
        layerConfig.layer_postes.crs,
        {
          'INFO_FORMAT': 'application/json',
          'QUERY_LAYERS': layerConfig.layer_postes.layerName,
          'LAYERS': layerConfig.layer_postes.layerName
        }
      );
    
    if (!url) {
      return null;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.features && data.features.length > 0) {
      return data.features[0].properties;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Calcula a distância euclidiana entre dois pontos (em coordenadas UTM/projetadas)
 * @param {Array} point1 - [x, y] primeiro ponto
 * @param {Array} point2 - [x, y] segundo ponto
 * @returns {number} Distância em metros
 */
export function calculateDistance(point1, point2) {
  const dx = point2[0] - point1[0];
  const dy = point2[1] - point1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Consulta postes próximos usando WFS com buffer de busca
 * Implementa margem de erro de 10 metros, selecionando o mais próximo se houver múltiplos
 * @param {Array} coord - Coordenada do clique em EPSG:3857 (padrão do mapa Web Mercator)
 * @param {string} bufferDistance - Distância do buffer em metros (ex: "10")
 * @returns {Promise<Object|null>} Propriedades do poste mais próximo ou null
 */
export async function queryPosteLayerWithBuffer(coord, bufferDistance = '10') {
  try {
    const layerName = 'ne:Postes%20-%20IDs%20-%20AU';
    const fromCrs = 'EPSG:3857';  // CRS do clique (Web Mercator)
    const toCrs = 'EPSG:32721';   // CRS da camada de postes (UTM 21S)
    const buffer = parseFloat(bufferDistance); // 10 metros
    
    // Converter coordenada do clique de EPSG:3857 para EPSG:32721
    const coordConverted = transform(coord, fromCrs, toCrs);
    
    // Criar bbox de ±buffer metros ao redor da coordenada convertida
    const bbox = [
      coordConverted[0] - buffer,
      coordConverted[1] - buffer,
      coordConverted[0] + buffer,
      coordConverted[1] + buffer
    ];
    
    const bboxStr = bbox.join(',');
    const wfsUrl = `https://geoserver.amambai.ms.gov.br/geoserver/wfs?` +
      `service=WFS&version=2.0.0&request=GetFeature&` +
      `typeName=${layerName}&` +
      `outputFormat=application/json&` +
      `SRSNAME=${toCrs}&` +
      `bbox=${bboxStr},${toCrs}`;
    
    const response = await fetch(wfsUrl);
    const data = await response.json();
    
    if (!data || !data.features || data.features.length === 0) {
      return null;
    }
    
    // Se encontrou apenas um, retornar diretamente
    if (data.features.length === 1) {
      return data.features[0].properties;
    }
    
    // Se encontrou múltiplos, calcular distância e selecionar o mais próximo
    
    let closestFeature = null;
    let closestDistance = Infinity;
    
    data.features.forEach(feature => {
      // Extrair coordenadas da geometria (já em EPSG:32721)
      let featureCoord = null;
      if (feature.geometry.type === 'Point') {
        featureCoord = feature.geometry.coordinates;
      } else if (feature.geometry.type === 'MultiPoint') {
        featureCoord = feature.geometry.coordinates[0];
      }
      
      if (featureCoord) {
        // Calcular distância em EPSG:32721 (metros)
        const distance = calculateDistance(coordConverted, featureCoord);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestFeature = feature;
        }
      }
    });
    
    if (closestFeature) {
      return closestFeature.properties;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}
