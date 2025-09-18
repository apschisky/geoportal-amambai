

// Criação e gerenciamento de popups usando o objeto global ol
export function showLotesPopup(map, coord, html, isPrint = false) {
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
  popupOverlayLotes = new ol.Overlay({
    element: container,
    positioning: 'top-right',
    stopEvent: true,
    offset: [400, 0]
  });
  popupOverlayLotes.set('popupLotes', true);
  map.addOverlay(popupOverlayLotes);
  popupOverlayLotes.setPosition(coord);
}
