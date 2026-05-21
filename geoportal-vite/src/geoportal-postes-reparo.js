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

const ILUMINACAO_PHONE_COUNTRIES = [
  { value: 'BR', label: 'Brasil', dialCode: '+55' },
  { value: 'PY', label: 'Paraguai', dialCode: '+595' },
  { value: 'OUTRO', label: 'Outro', dialCode: '+1' }
];

function getIluminacaoPhoneCountry(countryValue) {
  return ILUMINACAO_PHONE_COUNTRIES.find(country => country.value === countryValue) || ILUMINACAO_PHONE_COUNTRIES[0];
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function cleanOtherPhone(value) {
  return String(value || '').replace(/[^\d+\s()-]/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function formatIluminacaoPhone(countryValue, rawValue) {
  const country = getIluminacaoPhoneCountry(countryValue);
  const digits = onlyDigits(rawValue);

  if (country.value === 'BR') {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  if (country.value === 'PY') {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  return cleanOtherPhone(rawValue);
}

export function normalizeIluminacaoPhone(countryValue, rawValue) {
  const country = getIluminacaoPhoneCountry(countryValue);

  if (country.value === 'BR' || country.value === 'PY') {
    const digits = onlyDigits(rawValue);
    return digits ? `${country.dialCode}${digits}` : '';
  }

  const cleaned = cleanOtherPhone(rawValue);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;

  const digits = onlyDigits(cleaned);
  return digits ? `${country.dialCode}${digits}` : cleaned;
}

export function validateIluminacaoPhone(countryValue, rawValue) {
  const country = getIluminacaoPhoneCountry(countryValue);
  const digits = onlyDigits(rawValue);

  if (country.value === 'BR') {
    return digits.length === 10 || digits.length === 11;
  }

  if (country.value === 'PY') {
    return digits.length === 9;
  }

  return digits.length >= 6;
}

function getIluminacaoPhonePlaceholder(countryValue) {
  const country = getIluminacaoPhoneCountry(countryValue);
  if (country.value === 'BR') return '(67) 99999-9999';
  if (country.value === 'PY') return '981 123 456';
  return '+1 555 123 4567';
}

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
    contatoPais: modal.querySelector('#iluminacao-api-contato-pais')?.value || 'BR',
    contatoSolicitante: modal.querySelector('#iluminacao-api-contato')?.value || '',
    observacoesLocalizacao: modal.querySelector('#iluminacao-api-observacoes')?.value || ''
  };
}

export function parseIluminacaoCoordinates(coordenadasText) {
  const match = String(coordenadasText || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function normalizeOptionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

export function buildIluminacaoApiTestPayloadFromModal() {
  const state = getIluminacaoModalStateFromDom();
  const localizacaoTipo = state.localizacaoTipo === 'ponto_manual' ? 'ponto_manual' : 'poste_mapa';
  const coordenada = parseIluminacaoCoordinates(state.coordenadas);

  return {
    localizacao_tipo: localizacaoTipo,
    poste_id: localizacaoTipo === 'ponto_manual' ? null : String(state.posteId || '').trim(),
    coordenada,
    tipo_problema: String(state.tipoProblema || '').trim(),
    descricao: String(state.descricao || '').trim(),
    ponto_referencia: normalizeOptionalText(state.pontoReferencia),
    observacoes_localizacao: normalizeOptionalText(state.observacoesLocalizacao),
    nome_solicitante: String(state.nomeSolicitante || '').trim(),
    contato_solicitante: normalizeIluminacaoPhone(state.contatoPais || 'BR', state.contatoSolicitante)
  };
}

export function validateIluminacaoApiTestPayload(payload, state = getIluminacaoModalStateFromDom()) {
  const errors = [];

  if (payload.localizacao_tipo !== 'poste_mapa' && payload.localizacao_tipo !== 'ponto_manual') {
    errors.push('Tipo de localização inválido.');
  }

  if (payload.localizacao_tipo === 'poste_mapa' && !payload.poste_id) {
    errors.push('ID do poste \u00e9 obrigat\u00f3rio.');
  }

  if (!payload.coordenada) {
    errors.push('Coordenadas inv\u00e1lidas.');
  }

  if (!payload.tipo_problema) {
    errors.push('Tipo de problema \u00e9 obrigat\u00f3rio.');
  }

  if (!payload.descricao) {
    errors.push('Descri\u00e7\u00e3o \u00e9 obrigat\u00f3ria.');
  }

  if (!payload.nome_solicitante) {
    errors.push('Nome do solicitante \u00e9 obrigat\u00f3rio.');
  }

  if (!payload.contato_solicitante) {
    errors.push('Contato / WhatsApp \u00e9 obrigat\u00f3rio.');
  }

  if (payload.contato_solicitante && !validateIluminacaoPhone(state.contatoPais || 'BR', state.contatoSolicitante)) {
    errors.push('Contato / WhatsApp inv\u00e1lido para o pa\u00eds selecionado.');
  }

  if (payload.localizacao_tipo === 'ponto_manual' && !payload.observacoes_localizacao) {
    errors.push('Observa\u00e7\u00f5es de localiza\u00e7\u00e3o s\u00e3o obrigat\u00f3rias no modo manual.');
  }

  return errors;
}

function getIluminacaoInvalidFieldIds(payload, state = getIluminacaoModalStateFromDom()) {
  const fieldIds = [];

  if (payload.localizacao_tipo === 'poste_mapa' && !payload.poste_id) {
    fieldIds.push('iluminacao-api-poste-id');
  }

  if (!payload.coordenada) {
    fieldIds.push('iluminacao-api-coordenadas');
  }

  if (!payload.tipo_problema) {
    fieldIds.push('iluminacao-api-tipo-problema');
  }

  if (!payload.descricao) {
    fieldIds.push('iluminacao-api-descricao');
  }

  if (!payload.nome_solicitante) {
    fieldIds.push('iluminacao-api-nome');
  }

  if (!payload.contato_solicitante || !validateIluminacaoPhone(state.contatoPais || 'BR', state.contatoSolicitante)) {
    fieldIds.push('iluminacao-api-contato-pais', 'iluminacao-api-contato');
  }

  if (payload.localizacao_tipo === 'ponto_manual' && !payload.observacoes_localizacao) {
    fieldIds.push('iluminacao-api-observacoes');
  }

  return [...new Set(fieldIds)];
}

function closeIluminacaoPayloadPreview() {
  document.querySelector('.iluminacao-payload-preview-overlay')?.remove();
}

function closeIluminacaoSubmitResult() {
  document.querySelector('.iluminacao-submit-result-overlay')?.remove();
}

function closeIluminacaoConsultaModal() {
  document.querySelector('.iluminacao-consulta-overlay')?.remove();
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function showCopyProtocolFeedback(button) {
  const originalText = button.dataset.originalText || button.textContent || 'Copiar protocolo';
  button.dataset.originalText = originalText;
  button.textContent = 'Copiado!';
  window.setTimeout(() => {
    if (document.body.contains(button)) {
      button.textContent = button.dataset.originalText || 'Copiar protocolo';
    }
  }, 2200);
}

function clearIluminacaoFormValidationErrors() {
  document.querySelector('.iluminacao-api-validation-errors')?.remove();

  document.querySelectorAll('[data-iluminacao-field-highlighted="true"]').forEach(field => {
    field.style.cssText = field.dataset.iluminacaoOriginalStyle || '';
    delete field.dataset.iluminacaoOriginalStyle;
    delete field.dataset.iluminacaoFieldHighlighted;
    field.removeAttribute('aria-invalid');
  });
}

function highlightIluminacaoInvalidFields(fieldIds) {
  fieldIds.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (!field.dataset.iluminacaoFieldHighlighted) {
      field.dataset.iluminacaoOriginalStyle = field.style.cssText || '';
    }

    field.dataset.iluminacaoFieldHighlighted = 'true';
    field.setAttribute('aria-invalid', 'true');
    field.style.borderColor = '#dc2626';
    field.style.boxShadow = '0 0 0 2px rgba(220,38,38,0.16)';
    field.style.backgroundColor = '#fff7f7';
  });
}

function showIluminacaoFormValidationErrors(errors, fieldIds = []) {
  const modal = document.querySelector('.iluminacao-api-test-modal');
  if (!modal) return;

  clearIluminacaoFormValidationErrors();
  highlightIluminacaoInvalidFields(fieldIds);

  const errorsHtml = errors
    .map(error => `<li style="margin:2px 0;">${escapeHtml(error)}</li>`)
    .join('');
  const wrapper = document.createElement('div');
  wrapper.className = 'iluminacao-api-validation-errors';
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText = 'margin:6px 0 5px;padding:8px 10px;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:6px;background:#fff1f2;color:#7f1d1d;font-size:12px;line-height:1.4;';
  wrapper.innerHTML = `
    <strong style="display:block;margin-bottom:2px;color:#991b1b;">Revise as informa\u00e7\u00f5es</strong>
    <div style="margin-bottom:4px;">Corrija os campos indicados antes de continuar.</div>
    <ul style="margin:0;padding-left:18px;">${errorsHtml}</ul>
  `;

  const anchor = modal.querySelector('[data-iluminacao-required-note="true"]');
  if (anchor) {
    anchor.insertAdjacentElement('afterend', wrapper);
  } else {
    modal.insertBefore(wrapper, modal.firstElementChild?.nextSibling || modal.firstChild);
  }

  wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showIluminacaoPayloadPreview(payload) {
  closeIluminacaoPayloadPreview();

  const payloadJson = JSON.stringify(payload, null, 2);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="iluminacao-payload-preview-overlay" style="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:14px 12px;overflow-y:auto;overflow-x:hidden;">
      <div class="iluminacao-payload-preview-modal" role="dialog" aria-modal="true" aria-labelledby="iluminacao-payload-preview-title" style="width:min(520px,calc(100vw - 32px));max-width:calc(100vw - 32px);background:#fff;border-radius:8px;box-shadow:0 20px 45px rgba(15,23,42,0.35);padding:14px;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <h2 id="iluminacao-payload-preview-title" style="font-size:17px;line-height:1.2;margin:0;color:#123f73;">Pr\u00e9via da solicita\u00e7\u00e3o</h2>
          <button type="button" data-iluminacao-payload-preview-close="true" aria-label="Fechar" style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#374151;">&times;</button>
        </div>
        <p style="margin:0 0 10px;color:#4b5563;font-size:13px;">Nenhum dado foi enviado. Esta \u00e9 apenas uma valida\u00e7\u00e3o local.</p>
        <pre style="margin:0;max-height:55vh;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:6px;padding:10px;font-size:12px;line-height:1.45;">${escapeHtml(payloadJson)}</pre>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <button type="button" data-iluminacao-payload-preview-close="true" style="padding:7px 11px;border:0;border-radius:4px;background:#1976d2;color:#fff;font-weight:700;cursor:pointer;">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function showIluminacaoSubmitResult({ title, message, protocolo = '', status = '', isSuccess = false }) {
  closeIluminacaoSubmitResult();

  const detailsHtml = isSuccess
    ? `
      <div style="margin-top:10px;padding:8px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#334155;">
        ${protocolo ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <span><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</span>
            <button type="button" data-iluminacao-copy-protocolo="${escapeHtml(protocolo)}" style="padding:4px 7px;border:1px solid #1976d2;border-radius:4px;background:#fff;color:#1976d2;font-size:12px;font-weight:700;cursor:pointer;">Copiar protocolo</button>
          </div>
        ` : ''}
        ${status ? `<div><strong>Status:</strong> ${escapeHtml(status)}</div>` : ''}
      </div>
      <p style="margin:10px 0 0;color:#64748b;font-size:12px;">O Google Forms permanece dispon\u00edvel como alternativa.</p>
    `
    : '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="iluminacao-submit-result-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:16px 12px;overflow-y:auto;overflow-x:hidden;">
      <div class="iluminacao-submit-result-modal" role="dialog" aria-modal="true" aria-labelledby="iluminacao-submit-result-title" style="width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);background:#fff;border-radius:8px;box-shadow:0 20px 45px rgba(15,23,42,0.35);padding:14px;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <h2 id="iluminacao-submit-result-title" style="font-size:17px;line-height:1.2;margin:0;color:${isSuccess ? '#166534' : '#123f73'};">${escapeHtml(title)}</h2>
          <button type="button" data-iluminacao-submit-result-close="true" aria-label="Fechar" style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#374151;">&times;</button>
        </div>
        <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.45;">${escapeHtml(message)}</p>
        ${detailsHtml}
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <button type="button" data-iluminacao-submit-result-close="true" style="padding:7px 11px;border:0;border-radius:4px;background:#1976d2;color:#fff;font-weight:700;cursor:pointer;">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

async function fetchIluminacaoApiWithTimeout(payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(ILUMINACAO_API_TEST_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readIluminacaoApiResponseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function getIluminacaoApiErrorMessage(status) {
  if (status === 422) {
    return 'Há informações inválidas ou incompletas. Revise os campos e tente novamente.';
  }

  if (status === 429) {
    return 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.';
  }

  if (status === 409) {
    return 'Já existe uma solicitação aberta para este poste. A equipe responsável já foi notificada.';
  }

  if (status === 503) {
    return 'Serviço temporariamente indisponível. Tente novamente mais tarde.';
  }

  return ILUMINACAO_API_TEST_CONFIG.genericErrorMessage;
}

export async function submitIluminacaoApiTestPayload(payload) {
  try {
    const response = await fetchIluminacaoApiWithTimeout(payload);
    const responseData = await readIluminacaoApiResponseJson(response);

    if (response.status === 201) {
      showIluminacaoSubmitResult({
        title: 'Solicitação registrada',
        message: ILUMINACAO_API_TEST_CONFIG.successMessage,
        protocolo: responseData?.protocolo || '',
        status: responseData?.status || '',
        isSuccess: true
      });
      return true;
    }

    showIluminacaoSubmitResult({
      title: 'Não foi possível registrar',
      message: getIluminacaoApiErrorMessage(response.status)
    });
    return false;
  } catch (error) {
    showIluminacaoSubmitResult({
      title: 'Não foi possível registrar',
      message: ILUMINACAO_API_TEST_CONFIG.genericErrorMessage
    });
    return false;
  }
}

function formatIluminacaoProtocoloInput(value) {
  const cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!cleaned) return '';

  if (cleaned.startsWith('IP')) {
    const digits = onlyDigits(cleaned.slice(2)).slice(0, 10);
    if (!digits) return 'IP';
    if (digits.length <= 4) return `IP-${digits}`;
    return `IP-${digits.slice(0, 4)}-${digits.slice(4, 10)}`;
  }

  if (/^\d/.test(cleaned)) {
    const digits = onlyDigits(cleaned).slice(0, 10);
    if (digits.length <= 4) return `IP-${digits}`;
    return `IP-${digits.slice(0, 4)}-${digits.slice(4, 10)}`;
  }

  return cleaned.slice(0, 14);
}

function normalizeIluminacaoProtocolo(value) {
  return formatIluminacaoProtocoloInput(value).trim().toUpperCase();
}

function normalizeIluminacaoConsultaConfirmacao(value) {
  return onlyDigits(value).slice(0, 4);
}

function buildIluminacaoConsultaPayloadFromModal() {
  const modal = document.querySelector('.iluminacao-consulta-modal');
  return {
    protocolo: normalizeIluminacaoProtocolo(
      modal?.querySelector('#iluminacao-consulta-protocolo')?.value || ''
    ),
    contato_confirmacao: normalizeIluminacaoConsultaConfirmacao(
      modal?.querySelector('#iluminacao-consulta-confirmacao')?.value || ''
    )
  };
}

function validateIluminacaoConsultaPayload(payload) {
  const errors = [];

  if (!payload.protocolo) {
    errors.push('Protocolo é obrigatório.');
  } else if (!/^IP-\d{4}-\d{6}$/.test(payload.protocolo)) {
    errors.push('Protocolo deve estar no formato IP-YYYY-NNNNNN.');
  }

  if (!payload.contato_confirmacao) {
    errors.push('Últimos 4 dígitos do contato são obrigatórios.');
  } else if (!/^\d{4}$/.test(payload.contato_confirmacao)) {
    errors.push('Informe exatamente 4 dígitos do contato.');
  }

  return errors;
}

function clearIluminacaoConsultaErrors() {
  document.querySelector('.iluminacao-consulta-errors')?.remove();
}

function clearIluminacaoConsultaResult() {
  document.querySelector('.iluminacao-consulta-result')?.remove();
}

function showIluminacaoConsultaErrors(errors) {
  const modal = document.querySelector('.iluminacao-consulta-modal');
  if (!modal) return;

  clearIluminacaoConsultaErrors();
  clearIluminacaoConsultaResult();

  const errorsHtml = errors
    .map(error => `<li style="margin:2px 0;">${escapeHtml(error)}</li>`)
    .join('');
  const wrapper = document.createElement('div');
  wrapper.className = 'iluminacao-consulta-errors';
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText = 'margin:8px 0 6px;padding:8px 10px;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:6px;background:#fff1f2;color:#7f1d1d;font-size:12px;line-height:1.4;';
  wrapper.innerHTML = `
    <strong style="display:block;margin-bottom:2px;color:#991b1b;">Revise as informações</strong>
    <div style="margin-bottom:4px;">Corrija os campos indicados antes de continuar.</div>
    <ul style="margin:0;padding-left:18px;">${errorsHtml}</ul>
  `;

  const anchor = modal.querySelector('[data-iluminacao-consulta-help="true"]');
  anchor?.insertAdjacentElement('afterend', wrapper);
}

function showIluminacaoConsultaResult(data) {
  const modal = document.querySelector('.iluminacao-consulta-modal');
  if (!modal) return;

  clearIluminacaoConsultaErrors();
  clearIluminacaoConsultaResult();

  const wrapper = document.createElement('div');
  wrapper.className = 'iluminacao-consulta-result';
  wrapper.setAttribute('role', 'status');
  wrapper.style.cssText = 'margin:10px 0 0;padding:9px 10px;border:1px solid #bfdbfe;border-left:4px solid #1976d2;border-radius:6px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.45;';
  wrapper.innerHTML = `
    <strong style="display:block;margin-bottom:5px;color:#123f73;">Andamento da solicitação</strong>
    <div><strong>Protocolo:</strong> ${escapeHtml(data?.protocolo || '')}</div>
    <div><strong>Status:</strong> ${escapeHtml(data?.status_publico || '')}</div>
    <div><strong>Data de abertura:</strong> ${escapeHtml(data?.data_abertura || '')}</div>
    <div><strong>Última atualização:</strong> ${escapeHtml(data?.ultima_atualizacao || '')}</div>
    <p style="margin:6px 0 0;color:#334155;">${escapeHtml(data?.mensagem || '')}</p>
  `;

  const actions = modal.querySelector('[data-iluminacao-consulta-actions="true"]');
  actions?.insertAdjacentElement('beforebegin', wrapper);
}

function getIluminacaoConsultaErrorMessage(status) {
  if (status === 404) {
    return 'Solicitação não encontrada ou dados de confirmação inválidos.';
  }

  if (status === 422) {
    return 'Revise o protocolo e os dados de confirmação.';
  }

  if (status === 429) {
    return 'Muitas consultas em pouco tempo. Tente novamente mais tarde.';
  }

  if (status === 503) {
    return 'Serviço temporariamente indisponível. Tente novamente mais tarde.';
  }

  return 'Não foi possível consultar o protocolo no momento. Tente novamente mais tarde.';
}

async function fetchIluminacaoConsultaWithTimeout(payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(ILUMINACAO_API_TEST_CONFIG.consultaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function submitIluminacaoConsultaPayload(payload) {
  try {
    const response = await fetchIluminacaoConsultaWithTimeout(payload);
    const responseData = await readIluminacaoApiResponseJson(response);

    if (response.status === 200) {
      showIluminacaoConsultaResult(responseData || {});
      return true;
    }

    showIluminacaoConsultaErrors([getIluminacaoConsultaErrorMessage(response.status)]);
    return false;
  } catch (error) {
    showIluminacaoConsultaErrors([
      'Não foi possível consultar o protocolo no momento. Tente novamente mais tarde.'
    ]);
    return false;
  }
}

function openIluminacaoConsultaModal() {
  if (!ILUMINACAO_API_TEST_CONFIG.consultaEnabled) return;

  closeIluminacaoConsultaModal();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="iluminacao-consulta-overlay" style="position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:14px 12px;overflow-y:auto;overflow-x:hidden;">
      <div class="iluminacao-consulta-modal" role="dialog" aria-modal="true" aria-labelledby="iluminacao-consulta-title" style="width:min(380px,calc(100vw - 32px));max-width:calc(100vw - 32px);background:#fff;border-radius:8px;box-shadow:0 20px 45px rgba(15,23,42,0.35);padding:13px;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
          <h2 id="iluminacao-consulta-title" style="font-size:17px;line-height:1.2;margin:0;color:#123f73;">Consultar andamento</h2>
          <button type="button" data-iluminacao-consulta-close="true" aria-label="Fechar" style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#374151;">&times;</button>
        </div>
        <p data-iluminacao-consulta-help="true" style="margin:0 0 8px;color:#4b5563;font-size:12px;line-height:1.4;">Informe o protocolo recebido e os últimos 4 dígitos do contato usado na solicitação.</p>

        <label style="display:block;margin:6px 0 2px;font-weight:700;color:#1f2937;font-size:12px;" for="iluminacao-consulta-protocolo">Protocolo</label>
        <input id="iluminacao-consulta-protocolo" type="text" autocomplete="off" maxlength="14" placeholder="IP-YYYY-NNNNNN" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font:inherit;font-size:13px;min-height:32px;text-transform:uppercase;">

        <label style="display:block;margin:6px 0 2px;font-weight:700;color:#1f2937;font-size:12px;" for="iluminacao-consulta-confirmacao">Últimos 4 dígitos do contato</label>
        <input id="iluminacao-consulta-confirmacao" type="text" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="9999" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font:inherit;font-size:13px;min-height:32px;">

        <div data-iluminacao-consulta-actions="true" style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
          <button type="button" data-iluminacao-consulta-close="true" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-weight:700;cursor:pointer;">Cancelar</button>
          <button type="button" data-iluminacao-consulta-submit="true" style="padding:6px 10px;border:0;border-radius:4px;background:#1976d2;color:#fff;font-weight:700;cursor:pointer;">Consultar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function formatRequiredLabel(text, required) {
  return `${escapeHtml(text)}${required ? ' <span aria-hidden="true" style="color:#dc2626;">*</span>' : ''}`;
}

function createIluminacaoApiTestModalHtml(state) {
  const localizacaoTipo = state.localizacaoTipo || 'poste_mapa';
  const isManual = localizacaoTipo === 'ponto_manual';
  const posteId = isManual ? 'N\u00e3o informado' : (state.posteId || '');
  const coordenadas = state.coordenadas || '';
  const contatoPais = state.contatoPais || 'BR';
  const contatoCountry = getIluminacaoPhoneCountry(contatoPais);
  const contatoFormatado = formatIluminacaoPhone(contatoPais, state.contatoSolicitante || '');
  const contatoPlaceholder = getIluminacaoPhonePlaceholder(contatoPais);
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
  const phoneCountryOptionsHtml = ILUMINACAO_PHONE_COUNTRIES
    .map(country => {
      const label = country.value === 'OUTRO' ? 'Outro' : country.value;
      return `<option value="${escapeHtml(country.value)}"${contatoCountry.value === country.value ? ' selected' : ''}>${escapeHtml(`${label} ${country.dialCode}`)}</option>`;
    })
    .join('');
  const consultaLinkHtml = ILUMINACAO_API_TEST_CONFIG.consultaEnabled
    ? `
        <div style="margin-top:8px;text-align:center;">
          <button type="button" data-iluminacao-consulta-open="true" style="border:0;background:transparent;color:#1976d2;font-size:12px;font-weight:700;text-decoration:underline;cursor:pointer;padding:2px 4px;">
            Já possui protocolo? Consultar andamento
          </button>
        </div>
      `
    : '';

  return `
    <div class="iluminacao-api-test-overlay" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:10px 12px;overflow-y:auto;overflow-x:hidden;">
      <div class="iluminacao-api-test-modal" data-localizacao-tipo="${escapeHtml(localizacaoTipo)}" role="dialog" aria-modal="true" aria-labelledby="iluminacao-api-test-title" style="width:min(380px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:none;overflow:visible;background:#fff;border-radius:8px;box-shadow:0 20px 45px rgba(15,23,42,0.35);padding:12px;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
          <h2 id="iluminacao-api-test-title" style="font-size:17px;line-height:1.2;margin:0;color:#123f73;">Solicita\u00e7\u00e3o pela API (teste)</h2>
          <button type="button" data-iluminacao-api-test-close="true" aria-label="Fechar" style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#374151;">&times;</button>
        </div>
        <p style="margin:0 0 4px;color:#4b5563;font-size:12px;">Formul\u00e1rio local de prepara\u00e7\u00e3o. O envio real ainda n\u00e3o est\u00e1 ativo.</p>
        <p data-iluminacao-required-note="true" style="margin:0 0 4px;color:#64748b;font-size:12px;">* Campos obrigat\u00f3rios.</p>

        ${isManual ? `
          <div style="margin:5px 0 3px;padding:6px 8px;border-left:4px solid #1976d2;background:#eff6ff;border-radius:4px;color:#1e3a8a;font-size:12px;">
            Modo manual ativo. O ID do poste n\u00e3o \u00e9 obrigat\u00f3rio; confirme o local pelas coordenadas e descreva a refer\u00eancia em observa\u00e7\u00f5es.
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
            <label style="${labelStyle}" for="iluminacao-api-ponto-referencia">${formatRequiredLabel('Ponto de refer\u00eancia', required.pontoReferencia)}</label>
            <input id="iluminacao-api-ponto-referencia" type="text" value="${escapeHtml(state.pontoReferencia || '')}" style="${fieldStyle}">
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-nome">${formatRequiredLabel('Nome do solicitante', required.nomeSolicitante)}</label>
            <input id="iluminacao-api-nome" type="text" required value="${escapeHtml(state.nomeSolicitante || '')}" style="${fieldStyle}">
          </div>

          <div style="${fieldGroupStyle}">
            <label style="${labelStyle}" for="iluminacao-api-contato">${formatRequiredLabel('Contato / WhatsApp', required.contatoSolicitante)}</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="iluminacao-api-contato-pais" data-iluminacao-phone-country="true" aria-label="Pa\u00eds do contato" style="${fieldStyle}width:88px;flex:0 0 88px;padding-left:6px;padding-right:6px;">
                ${phoneCountryOptionsHtml}
              </select>
              <input id="iluminacao-api-contato" data-iluminacao-phone-input="true" type="text" inputmode="tel" required value="${escapeHtml(contatoFormatado)}" placeholder="${escapeHtml(contatoPlaceholder)}" style="${fieldStyle}flex:1;min-width:0;">
            </div>
          </div>
        </div>

        <label style="${labelStyle}" for="iluminacao-api-descricao">${formatRequiredLabel('Descri\u00e7\u00e3o', required.descricao)}</label>
        <textarea id="iluminacao-api-descricao" rows="1" required style="${fieldStyle}resize:vertical;min-height:34px;">${escapeHtml(state.descricao || '')}</textarea>

        <label style="${labelStyle}" for="iluminacao-api-observacoes">${formatRequiredLabel('Observa\u00e7\u00f5es de localiza\u00e7\u00e3o', required.observacoesLocalizacao)}</label>
        <textarea id="iluminacao-api-observacoes" rows="1" ${required.observacoesLocalizacao ? 'required' : ''} style="${fieldStyle}resize:vertical;min-height:34px;">${escapeHtml(state.observacoesLocalizacao || '')}</textarea>

        <button type="button" data-iluminacao-api-manual-location="true" style="width:100%;margin-top:6px;padding:6px 10px;border:1px solid #1976d2;border-radius:4px;background:#fff;color:#1976d2;font-weight:700;cursor:pointer;font-size:13px;">
          O poste n\u00e3o est\u00e1 correto? Selecionar local manualmente
        </button>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button type="button" data-iluminacao-api-test-close="true" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-weight:700;cursor:pointer;">Cancelar</button>
          <button type="button" data-iluminacao-api-test-submit="true" style="padding:6px 10px;border:0;border-radius:4px;background:#94a3b8;color:#fff;font-weight:700;cursor:pointer;">Enviar teste</button>
        </div>
        ${consultaLinkHtml}
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
    contatoPais: 'BR',
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

  document.addEventListener('input', event => {
    if (!(event.target instanceof Element)) return;

    const consultaProtocolo = event.target.closest('#iluminacao-consulta-protocolo');
    if (consultaProtocolo) {
      consultaProtocolo.value = formatIluminacaoProtocoloInput(consultaProtocolo.value);
      return;
    }

    const consultaConfirmacao = event.target.closest('#iluminacao-consulta-confirmacao');
    if (consultaConfirmacao) {
      consultaConfirmacao.value = normalizeIluminacaoConsultaConfirmacao(consultaConfirmacao.value);
      return;
    }

    const input = event.target.closest('[data-iluminacao-phone-input="true"]');
    if (!input) return;

    const modal = input.closest('.iluminacao-api-test-modal');
    const country = modal?.querySelector('#iluminacao-api-contato-pais')?.value || 'BR';
    input.value = formatIluminacaoPhone(country, input.value);
  });

  document.addEventListener('change', event => {
    if (!(event.target instanceof Element)) return;

    const countrySelect = event.target.closest('[data-iluminacao-phone-country="true"]');
    if (!countrySelect) return;

    const modal = countrySelect.closest('.iluminacao-api-test-modal');
    const input = modal?.querySelector('#iluminacao-api-contato');
    if (input) {
      input.value = formatIluminacaoPhone(countrySelect.value, input.value);
      input.placeholder = getIluminacaoPhonePlaceholder(countrySelect.value);
    }
  });

  document.addEventListener('click', async event => {
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

    if (event.target.closest('[data-iluminacao-payload-preview-close="true"]')) {
      event.preventDefault();
      closeIluminacaoPayloadPreview();
      return;
    }

    if (event.target.closest('[data-iluminacao-submit-result-close="true"]')) {
      event.preventDefault();
      closeIluminacaoSubmitResult();
      return;
    }

    const copyProtocolButton = event.target.closest('[data-iluminacao-copy-protocolo]');
    if (copyProtocolButton) {
      event.preventDefault();
      const copied = await copyTextToClipboard(copyProtocolButton.dataset.iluminacaoCopyProtocolo || '');
      if (copied) {
        showCopyProtocolFeedback(copyProtocolButton);
      }
      return;
    }

    if (event.target.closest('[data-iluminacao-consulta-close="true"]')) {
      event.preventDefault();
      closeIluminacaoConsultaModal();
      return;
    }

    if (event.target.classList.contains('iluminacao-payload-preview-overlay')) {
      closeIluminacaoPayloadPreview();
      return;
    }

    if (event.target.classList.contains('iluminacao-submit-result-overlay')) {
      closeIluminacaoSubmitResult();
      return;
    }

    if (event.target.classList.contains('iluminacao-consulta-overlay')) {
      closeIluminacaoConsultaModal();
      return;
    }

    if (event.target.classList.contains('iluminacao-api-test-overlay')) {
      closeIluminacaoApiTestModal();
      return;
    }

    if (event.target.closest('[data-iluminacao-consulta-open="true"]')) {
      event.preventDefault();
      openIluminacaoConsultaModal();
      return;
    }

    const consultaSubmitButton = event.target.closest('[data-iluminacao-consulta-submit="true"]');
    if (consultaSubmitButton) {
      event.preventDefault();
      if (!ILUMINACAO_API_TEST_CONFIG.consultaEnabled) return;

      const payload = buildIluminacaoConsultaPayloadFromModal();
      const errors = validateIluminacaoConsultaPayload(payload);
      if (errors.length) {
        showIluminacaoConsultaErrors(errors);
        return;
      }

      clearIluminacaoConsultaErrors();
      clearIluminacaoConsultaResult();
      const originalText = consultaSubmitButton.textContent;
      consultaSubmitButton.disabled = true;
      consultaSubmitButton.textContent = 'Consultando...';
      consultaSubmitButton.style.cursor = 'wait';

      await submitIluminacaoConsultaPayload(payload);

      consultaSubmitButton.disabled = false;
      consultaSubmitButton.textContent = originalText;
      consultaSubmitButton.style.cursor = 'pointer';
      return;
    }

    const submitButton = event.target.closest('[data-iluminacao-api-test-submit="true"]');
    if (submitButton) {
      event.preventDefault();
      const payload = buildIluminacaoApiTestPayloadFromModal();
      const errors = validateIluminacaoApiTestPayload(payload);
      if (errors.length) {
        showIluminacaoFormValidationErrors(errors, getIluminacaoInvalidFieldIds(payload));
        return;
      }

      if (!ILUMINACAO_API_TEST_CONFIG.submitEnabled) {
        clearIluminacaoFormValidationErrors();
        showIluminacaoPayloadPreview(payload);
        return;
      }

      clearIluminacaoFormValidationErrors();
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando...';
      submitButton.style.cursor = 'wait';

      const success = await submitIluminacaoApiTestPayload(payload);
      if (success) {
        closeIluminacaoApiTestModal();
      } else {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        submitButton.style.cursor = 'pointer';
      }
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
