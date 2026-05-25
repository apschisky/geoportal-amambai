import Overlay from 'ol/Overlay.js';
import {
  clearActivePopupRefreshCoord,
  clearActivePopupSource,
  clearNextPopupRefreshCoord,
  clearNextPopupSource,
  getNextPopupRefreshCoord,
  getNextPopupSource,
  setActivePopupRefreshCoord,
  setActivePopupSource,
  setGeoportalStateValue
} from './geoportal-state.js';

// Criação e gerenciamento de popups usando ES Modules do OpenLayers
//
function getPopupSafeArea() {
  const margin = 12;
  const isMobile = window.innerWidth <= 600;
  const headerRect = document.querySelector('.header')?.getBoundingClientRect();
  const publicNavRect = document.querySelector('.geoportal-public-nav')?.getBoundingClientRect();
  const footerRect = document.querySelector('.footer')?.getBoundingClientRect();
  const toolboxRect = isMobile
    ? document.querySelector('.toolbox')?.getBoundingClientRect()
    : null;
  const topFromDom = Math.max(
    headerRect?.bottom || 0,
    publicNavRect?.bottom || 0
  );
  const bottomLimit = Math.min(
    footerRect?.top || window.innerHeight,
    toolboxRect?.top || window.innerHeight
  );

  return {
    top: Math.max(topFromDom + margin, isMobile ? 96 : 120),
    left: margin,
    right: window.innerWidth - margin,
    bottom: Math.min(bottomLimit - margin, window.innerHeight - (isMobile ? 86 : 52))
  };
}

function calculatePopupOverflow(rect, safeArea) {
  const isMobile = window.innerWidth <= 600;
  const maxDelta = isMobile ? 200 : 280;
  const overflowTop = Math.max(0, safeArea.top - rect.top);
  const overflowBottom = Math.max(0, rect.bottom - safeArea.bottom);
  const overflowLeft = Math.max(0, safeArea.left - rect.left);
  const overflowRight = Math.max(0, rect.right - safeArea.right);
  const rawShiftX = overflowLeft || -overflowRight;
  const rawShiftY = overflowTop || -overflowBottom;

  return {
    shiftX: Math.max(-maxDelta, Math.min(maxDelta, rawShiftX)),
    shiftY: Math.max(-maxDelta, Math.min(maxDelta, rawShiftY)),
    hasOverflow: Boolean(overflowTop || overflowBottom || overflowLeft || overflowRight)
  };
}

function panMapByPopupOverflow(map, shiftX, shiftY, duration = 160) {
  const view = map.getView();
  const currentCenter = view.getCenter();
  if (!currentCenter) return false;

  const centerPixel = map.getPixelFromCoordinate(currentCenter);
  if (!centerPixel) return false;

  const newCenter = map.getCoordinateFromPixel([
    centerPixel[0] - shiftX,
    centerPixel[1] - shiftY
  ]);
  if (!newCenter) return false;

  view.animate({
    center: newCenter,
    duration
  });
  return true;
}

function afterPopupRender(callback) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

function ensurePointPopupFullyVisible(map, popupElement, options = {}) {
  if (!map || !popupElement || typeof window === 'undefined') return;

  const attempt = options.attempt || 0;
  afterPopupRender(() => {
    const rect = popupElement.getBoundingClientRect();
    const overflow = calculatePopupOverflow(rect, getPopupSafeArea());
    if (!overflow.hasOverflow) return;

    const duration = attempt === 0 ? 160 : 0;
    const didPan = panMapByPopupOverflow(map, overflow.shiftX, overflow.shiftY, duration);
    if (!didPan || attempt >= 1) return;

    setTimeout(() => {
      ensurePointPopupFullyVisible(map, popupElement, { attempt: attempt + 1 });
    }, duration + 40);
  });
}

export function closeLotesPopup(map) {
  if (!map) return false;

  const popupOverlayLotes = map.getOverlays().getArray().find(ov => ov.get('popupLotes'));
  if (!popupOverlayLotes) {
    clearActivePopupSource();
    clearActivePopupRefreshCoord();
    return false;
  }

  map.removeOverlay(popupOverlayLotes);
  setGeoportalStateValue('ultimoPopupHtml', '');
  clearActivePopupSource();
  clearActivePopupRefreshCoord();
  return true;
}

export function showLotesPopup(map, coord, html, isPrint = false) {
  // Salva o HTML do popup para uso na impressão
  const popupSource = getNextPopupSource() || null;
  const popupRefreshCoord = getNextPopupRefreshCoord() || null;
  clearNextPopupSource();
  clearNextPopupRefreshCoord();
  const popupPixel = map.getPixelFromCoordinate(coord);
  const mapSize = map.getSize() || [0, 0];
  const showOnRightSide = !popupPixel || popupPixel[0] <= mapSize[0] / 2;
  const isFarmaciaPopup = html.includes('farmacia-popup-modern');
  const isPostePopup = html.includes('popup-title">Poste') || html.includes("popup-title'>Poste");
  const isLocalInteressePopup = html.includes('local-interesse-popup-modern');
  const shouldShowAbovePoint = isFarmaciaPopup || isPostePopup || isLocalInteressePopup;
  const popupPositioning = shouldShowAbovePoint
    ? 'bottom-center'
    : showOnRightSide ? 'center-left' : 'center-right';
  const popupOffset = shouldShowAbovePoint
    ? [0, -18]
    : showOnRightSide ? [24, 0] : [-24, 0];
  let popupOverlayLotes = map.getOverlays().getArray().find(ov => ov.get('popupLotes'));
  if (popupOverlayLotes) {
    closeLotesPopup(map);
  }
  setGeoportalStateValue('ultimoPopupHtml', html);
  setActivePopupSource(popupSource);
  setActivePopupRefreshCoord(popupRefreshCoord);
  const container = document.createElement('div');
  container.className = 'ol-popup draggable-popup';
  const bar = document.createElement('div');
  bar.className = 'ol-popup-bar';
  bar.style.cssText = 'cursor:move; background:#1976d2; color:#fff; padding:6px 12px; font-weight:bold; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center;';
  bar.innerHTML = `<span>Informações</span><button class='ol-popup-close' style='background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 8px;' title='Fechar'>&times;</button>`;
  container.appendChild(bar);
  const contentDiv = document.createElement('div');
  contentDiv.className = 'ol-popup-content';
  contentDiv.innerHTML = html;
  container.appendChild(contentDiv);
  bar.querySelector('.ol-popup-close').onclick = function() {
    if (closeLotesPopup(map)) {
      popupOverlayLotes = null;
    }
  };
  let isDragging = false, dragStart = [0,0], overlayStart = [0,0];
  // Movimentação por mouse
  bar.onmousedown = function(e) {
    isDragging = true;
    dragStart = [e.clientX, e.clientY];
    const overlayPos = popupOverlayLotes.getPosition();
    overlayStart = map.getPixelFromCoordinate(overlayPos);
    document.body.style.userSelect = 'none';
  };
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStart[0];
    const dy = e.clientY - dragStart[1];
    const newPixel = [overlayStart[0] + dx, overlayStart[1] + dy];
    const newCoord = map.getCoordinateFromPixel(newPixel);
    popupOverlayLotes.setPosition(newCoord);
  });
  document.addEventListener('mouseup', function(e) {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });
  // Movimentação por toque (touch) para smartphones
  bar.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    isDragging = true;
    dragStart = [e.touches[0].clientX, e.touches[0].clientY];
    const overlayPos = popupOverlayLotes.getPosition();
    overlayStart = map.getPixelFromCoordinate(overlayPos);
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('touchmove', function(e) {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart[0];
    const dy = e.touches[0].clientY - dragStart[1];
    const newPixel = [overlayStart[0] + dx, overlayStart[1] + dy];
    const newCoord = map.getCoordinateFromPixel(newPixel);
    popupOverlayLotes.setPosition(newCoord);
  });
  document.addEventListener('touchend', function(e) {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });
  popupOverlayLotes = new Overlay({
    element: container,
    positioning: popupPositioning,
    stopEvent: true,
    offset: popupOffset
  });
  popupOverlayLotes.set('popupLotes', true);
  map.addOverlay(popupOverlayLotes);
  popupOverlayLotes.setPosition(coord);
  if (shouldShowAbovePoint) {
    setTimeout(() => {
      ensurePointPopupFullyVisible(map, container);
    }, 850);
  }
}
