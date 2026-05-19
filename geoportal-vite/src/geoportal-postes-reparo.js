// Funções para gerenciar solicitação de reparo de postes
// Integra com Google Forms pré-preenchido

import { toLonLat, transform } from 'ol/proj.js';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';
import { ILUMINACAO_API_TEST_CONFIG } from './geoportal-config.js';
import { escapeHtml, fetchWithTimeout } from './geoportal-utils.js';

let iluminacaoApiTestButtonHandlerReady = false;
let iluminacaoApiTestModalState = null;
let aguardandoSelecaoManual = false;
let manualPointerStart = null;
let pendingManualLocation = null;

const MANUAL_SELECTION_DRAG_THRESHOLD_PX = 8;

const ILUMINACAO_TIPO_PROBLEMA_OPTIONS = [
  { value: 'lampada_apagada', label: 'Lâmpada apagada' },
  { value: 'lampada_piscando', label: 'Lâmpada piscando' },
  { value: 'poste_danificado', label: 'Poste danificado' },
  { value: 'fiacao_aparente', label: 'Fio solto ou fiação aparente' },
  { value: 'outro', label: 'Outro' }
];

function closeIluminacaoApiTestModal() {
  document.querySelector('.iluminacao-api-test-overlay')?.remove();
}

function closePostePopupDom() {
  document.querySelector('.ol-popup')?.remove();
}

function hideIluminacaoManualSelectionNotice() {
  document.querySelector('.iluminacao-manual-selection-notice')?.remove();
}

function removeIluminacaoManualMarker() {
  document.querySelector('.iluminacao-manual-marker-layer')?.remove();
}

function cancelIluminacaoManualSelection() {
  aguardandoSelecaoManual = false;
  manualPointerStart = null;
  pendingManualLocation = null;
  hideIluminacaoManualSelectionNotice();
  removeIluminacaoManualMarker();
}

function showIluminacaoManualSelectionNotice() {
  hideIluminacaoManualSelectionNotice();

  const notice = document.createElement('div');
  notice.className = 'iluminacao-manual-selection-notice';
  notice.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(520px,calc(100% - 32px));padding:12px 14px;border-radius:6px;background:#1976d2;color:#fff;box-shadow:0 12px 28px rgba(15,23,42,0.3);font-size:14px;line-height:1.4;text-align:center;';
  notice.innerHTML = `
    <strong>Seleção manual ativa.</strong>
    Clique no mapa para definir o local da solicitação.
    <button type="button" data-iluminacao-manual-cancel="true" style="margin-left:8px;padding:4px 8px;border:1px solid rgba(255,255,255,0.7);border-radius:4px;background:transparent;color:#fff;font-weight:700;cursor:pointer;">Cancelar</button>
  `;
  document.body.appendChild(notice);
}

function parseMapCoordinateDisplay() {
  const text = document.getElementById('mouse-coordinates')?.textContent || '';
  const match = text.match(/Lon:\s*(-?\d+(?:\.\d+)?),\s*Lat:\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function isManualSelectionDrag(event) {
  if (!manualPointerStart) return false;

  const dx = event.clientX - manualPointerStart.x;
  const dy = event.clientY - manualPointerStart.y;
  return Math.sqrt((dx * dx) + (dy * dy)) > MANUAL_SELECTION_DRAG_THRESHOLD_PX;
}

function showIluminacaoManualMarker({ clientX, clientY, coordenadas }) {
  removeIluminacaoManualMarker();
  pendingManualLocation = { coordenadas };

  const layer = document.createElement('div');
  layer.className = 'iluminacao-manual-marker-layer';
  layer.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;';
  layer.innerHTML = `
    <div style="position:fixed;left:${clientX}px;top:${clientY}px;transform:translate(-50%,-100%);pointer-events:none;">
      <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,0.35);border:2px solid #fff;"></div>
      <div style="position:absolute;left:50%;top:5px;width:8px;height:8px;border-radius:50%;background:#fff;transform:translateX(-50%);"></div>
    </div>
    <div class="location-confirm-modal" style="position:fixed;left:min(${clientX + 18}px, calc(100vw - 336px));top:min(${clientY + 18}px, calc(100vh - 184px));width:min(304px, calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:none;overflow:visible;padding:12px;border:1px solid #dbe3ef;border-radius:8px;background:#fff;color:#111827;box-shadow:0 12px 28px rgba(15,23,42,0.28);font-size:13px;line-height:1.35;pointer-events:auto;">
      <strong style="display:block;margin-bottom:3px;color:#123f73;font-size:14px;">Confirmar localização</strong>
      <div style="margin-bottom:6px;color:#334155;">Usar este local para a solicitação?</div>
      <div style="margin-bottom:10px;color:#64748b;font-size:12px;white-space:normal;word-break:break-word;">Coordenadas: ${escapeHtml(coordenadas)}</div>
      <div style="display:grid;grid-template-columns:1fr;gap:6px;">
        <button type="button" data-iluminacao-manual-confirm="true" style="padding:8px 10px;border:0;border-radius:4px;background:#1976d2;color:#fff;font-weight:700;cursor:pointer;">Confirmar local</button>
        <button type="button" data-iluminacao-manual-retry="true" style="padding:7px 10px;border:1px solid #1976d2;border-radius:4px;background:#fff;color:#1976d2;font-weight:700;cursor:pointer;">Escolher outro ponto</button>
        <button type="button" data-iluminacao-manual-cancel="true" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-weight:700;cursor:pointer;">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(layer);
}

function getIluminacaoModalStateFromDom() {
  const modal = document.querySelector('.iluminacao-api-test-modal');
  if (!modal) return iluminacaoApiTestModalState || {};

  return {
    ...(iluminacaoApiTestModalState || {}),
    localizacaoTipo: modal.dataset.localizacaoTipo || 'poste_mapa',
    posteId: modal.querySelector('#iluminacao-api-poste-id')?.value || '',
    coordenadas: modal.querySelector('#iluminacao-api-coordenadas')?.value || '',
    tipoProblema: modal.querySelector('#iluminacao-api-tipo-problema')?.value || 'lampada_apagada',
    descricao: modal.querySelector('#iluminacao-api-descricao')?.value || '',
    pontoReferencia: modal.querySelector('#iluminacao-api-ponto-referencia')?.value || '',
    nomeSolicitante: modal.querySelector('#iluminacao-api-nome')?.value || '',
    contatoSolicitante: modal.querySelector('#iluminacao-api-contato')?.value || '',
    observacoesLocalizacao: modal.querySelector('#iluminacao-api-observacoes')?.value || ''
  };
}

function formatRequiredLabel(text, required) {
  return `${escapeHtml(text)}${required ? ' <span aria-hidden="true" style="color:#dc2626;">*</span>' : ''}`;
}

function createIluminacaoApiTestModalHtml(state) {
  const localizacaoTipo = state.localizacaoTipo || 'poste_mapa';
  const isManual = localizacaoTipo === 'ponto_manual';
  const posteId = isManual ? 'Não informado' : (state.posteId || '');
  const coordenadas = state.coordenadas || '';
  const required = {
    posteId: !isManual,
    coordenadas: true,
    tipoProblema: true,
    descricao: true,
    pontoReferencia: false,
    nomeSolicitante: true,
    contatoSolicitante: true,
    observacoesLocalizacao: isManual
  };
  const fieldStyle = 'width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font:inherit;font-size:13px;min-height:30px;';
  const labelStyle = 'display:block;margin:5px 0 2px;font-weight:700;color:#1f2937;font-size:12px;';
  const fieldGroupStyle = 'min-width:0;margin:0;';
  const optionsHtml = ILUMINACAO_TIPO_PROBLEMA_OPTIONS
    .map(option => `<option value="${escapeHtml(option.value)}"${(state.tipoProblema || 'lampada_apagada') === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');

  return `
    <div class="iluminacao-api-test-overlay" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:10px 12px;overflow-y:auto;overflow-x:hidden;">
      <div class="iluminacao-api-test-modal" data-localizacao-tipo="${escapeHtml(localizacaoTipo)}" role="dialog" aria-modal="true" aria-labelledby="iluminacao-api-test-title" style="width:min(380px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:none;overflow:visible;background:#fff;border-radius:8px;box-shadow:0 20px 45px rgba(15,23,42,0.35);padding:12px;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
          <h2 id="iluminacao-api-test-title" style="font-size:17px;line-height:1.2;margin:0;color:#123f73;">Solicitação pela API (teste)</h2>
          <button type="button" data-iluminacao-api-test-close="true" aria-label="Fechar" style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#374151;">&times;</button>
        </div>
        <p style="margin:0 0 4px;color:#4b5563;font-size:12px;">Formulário local de preparação. O envio real ainda não está ativo.</p>
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;">* Campos obrigatórios.</p>

        ${isManual ? `
          <div style="margin:5px 0 3px;padding:6px 8px;border-left:4px solid #1976d2;background:#eff6ff;border-radius:4px;color:#1e3a8a;font-size:12px;">
            Modo manual ativo. O ID do poste não é obrigatório; confirme o local pelas coordenadas e descreva a referência em observações.
          </div>
        ` : ''}

        <div style="display:flex;flex-direction:column;gap:0;">
          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-poste-id">${formatRequiredLabel('ID do poste', required.posteId)}</label>
            <input id="iluminacao-api-poste-id" type="text" readonly ${required.posteId ? 'required' : ''} value="${escapeHtml(posteId)}" style="${fieldStyle}background:#f8fafc;" ${isManual ? 'disabled' : ''}>
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-coordenadas">${formatRequiredLabel('Coordenadas', required.coordenadas)}</label>
            <input id="iluminacao-api-coordenadas" type="text" readonly required value="${escapeHtml(coordenadas)}" style="${fieldStyle}background:#f8fafc;">
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-tipo-problema">${formatRequiredLabel('Tipo de problema', required.tipoProblema)}</label>
            <select id="iluminacao-api-tipo-problema" required style="${fieldStyle}">
              ${optionsHtml}
            </select>
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-ponto-referencia">${formatRequiredLabel('Ponto de referência', required.pontoReferencia)}</label>
            <input id="iluminacao-api-ponto-referencia" type="text" value="${escapeHtml(state.pontoReferencia || '')}" style="${fieldStyle}">
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-nome">${formatRequiredLabel('Nome do solicitante', required.nomeSolicitante)}</label>
            <input id="iluminacao-api-nome" type="text" required value="${escapeHtml(state.nomeSolicitante || '')}" style="${fieldStyle}">
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-contato">${formatRequiredLabel('Contato / WhatsApp', required.contatoSolicitante)}</label>
            <input id="iluminacao-api-contato" type="text" required value="${escapeHtml(state.contatoSolicitante || '')}" style="${fieldStyle}">
          </div>
        </div>

        <label style="${labelStyle}" for="iluminacao-api-descricao">${formatRequiredLabel('Descrição', required.descricao)}</label>
        <textarea id="iluminacao-api-descricao" rows="1" required style="${fieldStyle}resize:vertical;min-height:34px;">${escapeHtml(state.descricao || '')}</textarea>

        <label style="${labelStyle}" for="iluminacao-api-observacoes">${formatRequiredLabel('Observações de localização', required.observacoesLocalizacao)}</label>
        <textarea id="iluminacao-api-observacoes" rows="1" ${required.observacoesLocalizacao ? 'required' : ''} style="${fieldStyle}resize:vertical;min-height:34px;">${escapeHtml(state.observacoesLocalizacao || '')}</textarea>

        <button type="button" data-iluminacao-api-manual-location="true" style="width:100%;margin-top:6px;padding:6px 10px;border:1px solid #1976d2;border-radius:4px;background:#fff;color:#1976d2;font-weight:700;cursor:pointer;font-size:13px;">
          O poste não está correto? Selecionar local manualmente
        </button>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button type="button" data-iluminacao-api-test-close="true" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-weight:700;cursor:pointer;">Cancelar</button>
          <button type="button" data-iluminacao-api-test-submit="true" style="padding:6px 10px;border:0;border-radius:4px;background:#94a3b8;color:#fff;font-weight:700;cursor:pointer;">Enviar teste</button>
        </div>
      </div>
    </div>
  `;
}

function openIluminacaoApiTestModal(button) {
  closeIluminacaoApiTestModal();

  iluminacaoApiTestModalState = {
    localizacaoTipo: 'poste_mapa',
    posteId: button.dataset.posteId || '',
    coordenadas: button.dataset.coordenadas || '',
    tipoProblema: 'lampada_apagada',
    descricao: '',
    pontoReferencia: '',
    nomeSolicitante: '',
    contatoSolicitante: '',
    observacoesLocalizacao: ''
  };
  openIluminacaoApiTestModalFromState();
}

function openIluminacaoApiTestModalFromState() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = createIluminacaoApiTestModalHtml(iluminacaoApiTestModalState || {});
  document.body.appendChild(wrapper.firstElementChild);
}

export function setupIluminacaoApiTestButtonHandler() {
  if (iluminacaoApiTestButtonHandlerReady || typeof document === 'undefined') {
    return;
  }

  iluminacaoApiTestButtonHandlerReady = true;
  document.addEventListener('pointerdown', event => {
    if (!(event.target instanceof Element) || !aguardandoSelecaoManual) return;

    manualPointerStart = event.target.closest('#map')
      ? { x: event.clientX, y: event.clientY }
      : null;
  });

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest('[data-iluminacao-manual-cancel="true"]')) {
      event.preventDefault();
      cancelIluminacaoManualSelection();
      return;
    }

    if (event.target.closest('[data-iluminacao-manual-retry="true"]')) {
      event.preventDefault();
      removeIluminacaoManualMarker();
      pendingManualLocation = null;
      aguardandoSelecaoManual = true;
      showIluminacaoManualSelectionNotice();
      return;
    }

    if (event.target.closest('[data-iluminacao-manual-confirm="true"]')) {
      event.preventDefault();
      if (!pendingManualLocation?.coordenadas) return;

      iluminacaoApiTestModalState = {
        ...(iluminacaoApiTestModalState || {}),
        localizacaoTipo: 'ponto_manual',
        posteId: '',
        coordenadas: pendingManualLocation.coordenadas
      };
      cancelIluminacaoManualSelection();
      openIluminacaoApiTestModalFromState();
      return;
    }

    if (aguardandoSelecaoManual && event.target.closest('#map')) {
      if (isManualSelectionDrag(event)) {
        manualPointerStart = null;
        return;
      }

      const clickPoint = { clientX: event.clientX, clientY: event.clientY };
      manualPointerStart = null;
      setTimeout(() => {
        const coordenadas = parseMapCoordinateDisplay();
        if (coordenadas) {
          hideIluminacaoManualSelectionNotice();
          showIluminacaoManualMarker({ ...clickPoint, coordenadas });
        }
      }, 120);
      return;
    }

    if (event.target.closest('[data-iluminacao-api-test-close="true"]')) {
      event.preventDefault();
      closeIluminacaoApiTestModal();
      return;
    }

    if (event.target.classList.contains('iluminacao-api-test-overlay')) {
      closeIluminacaoApiTestModal();
      return;
    }

    if (event.target.closest('[data-iluminacao-api-test-submit="true"]')) {
      event.preventDefault();
      alert('Envio real ainda não está ativo nesta etapa.');
      return;
    }

    if (event.target.closest('[data-iluminacao-api-manual-location="true"]')) {
      event.preventDefault();
      iluminacaoApiTestModalState = {
        ...getIluminacaoModalStateFromDom(),
        localizacaoTipo: 'ponto_manual',
        posteId: '',
        coordenadas: ''
      };
      aguardandoSelecaoManual = true;
      closeIluminacaoApiTestModal();
      closePostePopupDom();
      removeIluminacaoManualMarker();
      showIluminacaoManualSelectionNotice();
      return;
    }

    const button = event.target.closest('[data-iluminacao-api-test="true"]');
    if (!button) return;

    event.preventDefault();
    openIluminacaoApiTestModal(button);
  });
}

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
  if (ILUMINACAO_API_TEST_CONFIG.enabled) {
    setupIluminacaoApiTestButtonHandler();
  }

  // Busca o ID do poste com fallbacks
  const id = properties['IDs_coord'] || 
             properties['ids_coord'] || 
             properties['ID'] || 
             properties['id'] || 
             'Não identificado';
  
  // Formata as coordenadas
  const coords = formatPosteCoordinates(coordinate);
  const destinationLonLat = coordinate && coordinate.length >= 2 ? toLonLat(coordinate) : null;
  const latitude = destinationLonLat ? Number(destinationLonLat[1]).toFixed(6) : '';
  const longitude = destinationLonLat ? Number(destinationLonLat[0]).toFixed(6) : '';
  const routeUrl = buildGoogleMapsRouteUrl(destinationLonLat);
  
  // Constrói a URL do formulário
  const formUrl = buildPosteRepairFormUrl(
    { identificacaoPoste: id, coordenadas: coords },
    formBaseUrl,
    formFields
  );
  
  // Constrói o HTML do popup
  const apiTestButtonHtml = ILUMINACAO_API_TEST_CONFIG.enabled
    ? `
      <div class="poste-popup-actions poste-popup-api-test-actions" style="margin-top:8px;text-align:center;">
        <button type="button"
                class="poste-popup-action poste-popup-action-api-test"
                data-iluminacao-api-test="true"
                data-poste-id="${escapeHtml(id)}"
                data-latitude="${escapeHtml(latitude)}"
                data-longitude="${escapeHtml(longitude)}"
                data-coordenadas="${escapeHtml(coords)}"
                style="display:block;width:100%;padding:8px 16px;background:#1976d2;color:#fff;border:0;text-decoration:none;border-radius:4px;font-weight:bold;cursor:pointer;">
          <i class="fa-solid fa-flask" style="margin-right:6px;"></i>${escapeHtml(ILUMINACAO_API_TEST_CONFIG.buttonLabel)}
        </button>
      </div>`
    : '';

  const html = `
    <div class="popup-block">
      <div class="popup-title">Poste</div>
      <table style="border-collapse:collapse;width:100%">
        <tr>
          <td style="border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;">
            <b>ID do Poste</b>
          </td>
          <td style="border:1px solid #ccc;padding:4px 8px;">
            ${escapeHtml(id)}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;">
            <b>Coordenadas</b>
          </td>
          <td style="border:1px solid #ccc;padding:4px 8px;">
            ${escapeHtml(coords)}
          </td>
        </tr>
      </table>
      <div class="poste-popup-actions" style="margin-top:12px;text-align:center;">
        <a class="poste-popup-action poste-popup-action-repair" href="${formUrl}" 
           target="_blank" 
           rel="noopener noreferrer"
           style="display:inline-block;padding:8px 16px;background:#25d366;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;cursor:pointer;">
          <i class="fa-brands fa-whatsapp" style="margin-right:6px;"></i>Solicitar Reparo
        </a>
        <a class="poste-popup-action poste-popup-action-route" href="${routeUrl}"
           target="_blank"
           rel="noopener noreferrer">
          <i class="fa-solid fa-route" style="margin-right:6px;"></i>Traçar rota
        </a>
      </div>
      ${apiTestButtonHtml}
      <div style="margin-top:16px;padding:12px;background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;font-size:13px;line-height:1.5;color:#333;">
        <div style="margin-bottom:8px;font-weight:bold;color:#ff9800;">
          <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>Não encontrou o poste correto?
        </div>
        <p style="margin:6px 0;">
          Se este não for o poste desejado ou se a localização estiver incorreta no mapa, você ainda pode registrar a solicitação normalmente.
        </p>
        <p style="margin:6px 0;">
          <strong>👉 Utilize o poste mais próximo disponível</strong> e, no formulário, informe o <strong>endereço correto</strong> e um <strong>ponto de referência</strong> no campo de observações.
        </p>
        <p style="margin:6px 0;color:#666;">
          Isso ajuda nossa equipe a localizar com precisão o ponto e realizar o atendimento mais rapidamente.
        </p>
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
    
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    
    if (data && data.features && data.features.length > 0) {
      return data.features[0].properties;
    }
    
    return null;
  } catch (error) {
    console.error('[Postes] Erro ao consultar camada por GetFeatureInfo:', error);
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
export async function queryPosteLayerWithBuffer(coord, bufferDistance = '10', returnFeature = false) {
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
    
    const response = await fetchWithTimeout(wfsUrl);
    const data = await response.json();
    
    if (!data || !data.features || data.features.length === 0) {
      return null;
    }
    
    // Se encontrou apenas um, retornar diretamente
    if (data.features.length === 1) {
      return returnFeature ? data.features[0] : data.features[0].properties;
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
      return returnFeature ? closestFeature : closestFeature.properties;
    }
    
    return null;
  } catch (error) {
    console.error('[Postes] Erro ao consultar camada com buffer:', error);
    return null;
  }
}
