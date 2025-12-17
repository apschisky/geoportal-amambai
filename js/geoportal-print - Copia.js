export function setupPrint(map, layers) {
  const printBtn = document.getElementById('print-btn');
  if (!printBtn) return;
  printBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    document.querySelectorAll('.measurement-box, .search-box, .layer-controls-box').forEach(box => {
      box.classList.remove('expanded');
    });
    let extent = null;
    if (window.loteSelecionadoFeature && typeof window.loteSelecionadoFeature.getGeometry === 'function') {
      extent = window.loteSelecionadoFeature.getGeometry().getExtent();
      map.getView().fit(extent, { maxZoom: 18, duration: 0, padding: [20, 200, 60, 20] });
    }

    let printPopupDiv = document.getElementById('print-popup-table-page');
    if (!printPopupDiv) {
      printPopupDiv = document.createElement('div');
      printPopupDiv.id = 'print-popup-table-page';
      printPopupDiv.className = 'print-popup-table-page';
      document.body.appendChild(printPopupDiv);
    }

    const legendas = document.getElementById('legendas-categorias');
    let legendasHtml = legendas && legendas.innerHTML.trim() ? 
      `<div class='legend-content' style="float:left;width:50%;max-height:420px;overflow-y:auto;box-sizing:border-box;padding-right:12px;">${legendas.innerHTML}</div>` : '';

    let popupContentHtml = '';
    if (window.loteSelecionadoFeature && typeof window.loteSelecionadoFeature.getProperties === 'function') {
      const props = window.loteSelecionadoFeature.getProperties();
      let loteHtml = '<div style="font-size:14px;max-width:320px;"><strong>Feição selecionada</strong><br><table style="border-collapse:collapse;width:100%">';
      for (const key in props) {
        if (key !== 'geometry') {
          loteHtml += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
        }
      }
      loteHtml += '</table></div>';
      popupContentHtml = `<div class='popup-table-content'>${loteHtml}</div>`;
    }

    printPopupDiv.innerHTML = legendasHtml + popupContentHtml;
    setTimeout(() => {
      if (map && typeof map.updateSize === 'function') map.updateSize();
      if (map && map.renderSync) map.renderSync();
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          if (printPopupDiv) printPopupDiv.style.display = 'none';
        }, 800);
      }, 400);
    }, 500);
  });
}
