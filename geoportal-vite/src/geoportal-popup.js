import Overlay from 'ol/Overlay.js';

// Criação e gerenciamento de popups usando ES Modules do OpenLayers
//
export function showLotesPopup(map, coord, html, isPrint = false) {
  // Salva o HTML do popup para uso na impressão
  window.__geoportalUltimoPopupHtml = html;
  let popupOverlayLotes = map.getOverlays().getArray().find(ov => ov.get('popupLotes'));
  if (popupOverlayLotes) {
    map.removeOverlay(popupOverlayLotes);
  }
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
    if (popupOverlayLotes) {
      map.removeOverlay(popupOverlayLotes);
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
    positioning: 'top-right',
    stopEvent: true,
    offset: [400, 0]
  });
  popupOverlayLotes.set('popupLotes', true);
  map.addOverlay(popupOverlayLotes);
  popupOverlayLotes.setPosition(coord);
}
