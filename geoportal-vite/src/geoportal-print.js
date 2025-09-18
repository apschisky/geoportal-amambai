// Backup da versão de impressão somente do mapa
export function setupPrint(map, layers) {
  const printBtn = document.getElementById('print-btn');
  if (!printBtn) return;
  printBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    document.querySelectorAll('.measurement-box, .search-box, .layer-controls-box').forEach(box => {
      box.classList.remove('expanded');
    });
    // Só cria e insere o bloco de informações imediatamente antes do print
  let printPopupDiv = null;
  // Referência à legenda
  const legend = document.getElementById('legendas-categorias');
  let legendPrevDisplay = null;
  let legendPrevClass = null;
  let legendPrevParent = null;
  let legendPrevNext = null;
    const popupHtml = window.__geoportalUltimoPopupHtml || '';
    // Controle robusto: mostra a legenda só na primeira página usando eventos de impressão
    let legendRestored = false;
    function beforePrintHandler() {
      // Só insere a legenda no DOM se NÃO houver tabela de informações (ou seja, só na primeira página)
      if (!popupHtml && legend) {
        legendPrevDisplay = legend.style.display;
        legendPrevClass = legend.className;
        legendPrevParent = legend.parentNode;
        legendPrevNext = legend.nextSibling;
        legend.style.display = 'block';
        legend.classList.remove('hidden');
        legend.classList.remove('collapsed');
        legend.classList.remove('invisible');
        legend.removeAttribute('style');
        legend.style.position = 'fixed';
        legend.style.right = '0';
        legend.style.bottom = '0';
        legend.style.left = 'auto';
        legend.style.top = 'auto';
        legend.style.transform = 'none';
        legend.style.zIndex = '1002';
        legend.style.width = 'auto';
        legend.style.maxWidth = '8cm';
        legend.style.minWidth = '3cm';
        legend.style.maxHeight = '32mm';
        legend.style.overflowY = 'auto';
        legend.style.background = '#fff';
        legend.style.boxShadow = '0 2px 8px #0002';
        legend.style.borderRadius = '8px';
        legend.style.padding = '4px 8px';
        legend.style.fontSize = '1.1em';
        legend.style.margin = '0';
        legend.style.border = '1px solid #ccc';
        legend.setAttribute('data-print-moved', '1');
        document.body.appendChild(legend);
      }
    }
    function afterPrintHandler() {
      if (legend && legend.getAttribute('data-print-moved') === '1' && !legendRestored) {
        legend.style.display = legendPrevDisplay;
        legend.className = legendPrevClass;
        legend.removeAttribute('data-print-moved');
        legend.removeAttribute('style');
        if (legendPrevParent) {
          if (legendPrevNext) {
            legendPrevParent.insertBefore(legend, legendPrevNext);
          } else {
            legendPrevParent.appendChild(legend);
          }
        }
        legendRestored = true;
      }
    }
    window.addEventListener('beforeprint', beforePrintHandler);
    window.addEventListener('afterprint', afterPrintHandler);
    if (popupHtml) {
      printPopupDiv = document.createElement('div');
      printPopupDiv.id = 'print-popup-table-page';
      printPopupDiv.className = 'print-popup-table-page';
      // Se houver múltiplas tabelas, separa e centraliza cada uma
      let tablesHtml = popupHtml;
      if (/<table[\s>]/i.test(popupHtml)) {
        // Divide em múltiplas tabelas se houver mais de uma
        const tables = popupHtml.match(/<table[\s\S]*?<\/table>/gi);
        if (tables && tables.length > 1) {
          tablesHtml = tables.map(tb => `<div style='width: 18cm; max-width: 100%; display: flex; justify-content: center; margin-bottom: 18px;'>${tb}</div>`).join('');
        } else if (tables && tables.length === 1) {
          tablesHtml = `<div style='width: 18cm; max-width: 100%; display: flex; justify-content: center;'>${tables[0]}</div>`;
        }
      }
      printPopupDiv.innerHTML = `
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 100%; height: 100%; gap: 18px; margin-top: 2cm;">
          <h2 style='text-align:center;font-size:1.5rem;margin-bottom:18px;margin-top:0;width: 100%;'>Informações Detalhadas</h2>
          ${tablesHtml}
        </div>
      `;
      printPopupDiv.style.display = 'block';
      printPopupDiv.style.pageBreakBefore = 'always';
      printPopupDiv.style.breakBefore = 'page';
      const mapContainer = document.getElementById('map-container');
      if (mapContainer && mapContainer.parentNode) {
        mapContainer.parentNode.insertBefore(printPopupDiv, mapContainer.nextSibling);
      } else {
        document.body.appendChild(printPopupDiv);
      }
    }
    setTimeout(() => {
      if (map && typeof map.updateSize === 'function') map.updateSize();
      if (map && map.renderSync) map.renderSync();
      setTimeout(() => {
        window.print();
        // Remove o bloco de informações do DOM após imprimir
        if (printPopupDiv && printPopupDiv.parentNode) {
          printPopupDiv.parentNode.removeChild(printPopupDiv);
        }
        // Remove listeners para evitar duplicidade
        window.removeEventListener('beforeprint', beforePrintHandler);
        window.removeEventListener('afterprint', afterPrintHandler);
      }, 200);
    }, 500);
  });
}
