import { toLonLat } from 'ol/proj.js';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';
import { escapeHtml } from './geoportal-utils.js';

function isEmptyValue(value) {
  return value === undefined || value === null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'N/A';
}

function getFirstProperty(properties, names) {
  if (!properties) return '';

  for (const name of names) {
    if (!isEmptyValue(properties[name])) {
      return properties[name];
    }
  }

  const propertyKey = Object.keys(properties).find(key =>
    names.some(name => key.toLowerCase() === name.toLowerCase())
  );

  return propertyKey && !isEmptyValue(properties[propertyKey]) ? properties[propertyKey] : '';
}

function formatPhone(value) {
  if (isEmptyValue(value)) return '';

  const rawNumber = String(value).trim();
  const cleanNumber = rawNumber.replace(/\D/g, '');
  if (cleanNumber.length < 10) return rawNumber;

  const last11 = cleanNumber.slice(-11);
  const ddd = last11.slice(0, 2);
  const first = last11.length === 11 ? last11.slice(2, 7) : last11.slice(2, 6);
  const last = last11.length === 11 ? last11.slice(7) : last11.slice(6);
  return `(${ddd}) ${first}-${last}`;
}

function buildWhatsappUrl(value) {
  if (isEmptyValue(value)) return null;

  const cleanNumber = String(value).replace(/\D/g, '');
  if (cleanNumber.length < 10) return null;

  return `https://wa.me/55${cleanNumber.slice(-11)}`;
}

export function getLocalInteresseCoordinate(feature) {
  if (!feature) return null;

  const geometry = feature.getGeometry?.();
  if (!geometry) return null;

  const type = geometry.getType?.();
  if (type === 'Point') return geometry.getCoordinates();
  if (type === 'MultiPoint') return geometry.getCoordinates()[0];

  const extent = geometry.getExtent?.();
  if (!extent) return null;

  return [
    (extent[0] + extent[2]) / 2,
    (extent[1] + extent[3]) / 2
  ];
}

export function getLocalInteresseLonLatFromFeature(feature) {
  const coord = getLocalInteresseCoordinate(feature);
  return coord ? toLonLat(coord) : null;
}

export function createLocalInteressePopupHTML(properties, options = {}) {
  const category = options.category || 'Local de Interesse';
  const destinationLonLat = options.destinationLonLat || null;
  const nome = getFirstProperty(properties, ['nome', 'Nome', 'NOME', 'unidade', 'Unidade', 'descricao', 'Descrição', 'name']) || category;
  const endereco = getFirstProperty(properties, ['endereco', 'Endereço', 'ENDERECO', 'logradouro', 'Logradouro', 'address']);
  const telefone = getFirstProperty(properties, ['telefone', 'Telefone', 'TELEFONE', 'fone', 'Fone', 'contato', 'Contato']);
  const whatsapp = getFirstProperty(properties, ['whatsapp', 'WhatsApp', 'Whatsapp', 'WHATSAPP', 'celular', 'Celular']);
  const whatsappUrl = buildWhatsappUrl(whatsapp);
  const routeUrl = buildGoogleMapsRouteUrl(destinationLonLat);
  const routeData = destinationLonLat
    ? `data-destination-lon="${Number(destinationLonLat[0])}" data-destination-lat="${Number(destinationLonLat[1])}"`
    : '';

  const infoItems = [
    endereco ? { label: 'Endereço', value: endereco } : null,
    telefone ? { label: 'Telefone', value: formatPhone(telefone) } : null,
    whatsapp ? { label: 'WhatsApp', value: formatPhone(whatsapp), link: whatsappUrl } : null
  ].filter(Boolean);

  return `
    <div class="popup-block local-interesse-popup local-interesse-popup-modern">
      <div class="local-interesse-popup-header">
        <span class="local-interesse-popup-kicker">Local de Interesse</span>
        <h3 class="local-interesse-popup-title">${escapeHtml(nome)}</h3>
        <span class="local-interesse-popup-badge">${escapeHtml(category)}</span>
      </div>

      ${infoItems.length ? `
        <div class="local-interesse-popup-info">
          ${infoItems.map(item => `
            <div class="local-interesse-info-item">
              <span>${escapeHtml(item.label)}</span>
              ${item.link
                ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.value)}</a>`
                : `<strong>${escapeHtml(item.value)}</strong>`
              }
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="local-interesse-popup-actions">
        ${whatsappUrl
          ? `<a class="local-interesse-action local-interesse-action-whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>`
          : ''
        }
        <a class="local-interesse-action local-interesse-action-route" href="${routeUrl}" ${routeData} data-google-route="true" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-route" aria-hidden="true"></i> Traçar rota</a>
      </div>
    </div>
  `;
}
