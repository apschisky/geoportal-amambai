// Lógica de atualização e exibição de legendas
import { LEGEND_CONFIG } from './geoportal-config.js';

export function atualizarLegendas(layers) {
  const container = document.getElementById('legendas-categorias');
  let html = '';
  Object.keys(LEGEND_CONFIG).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox && checkbox.checked) {
      html += `<div style="margin-bottom:12px;">
                  <strong>${LEGEND_CONFIG[layerId].titulo}</strong><br>
                  <img src="${LEGEND_CONFIG[layerId].url}" alt="Legenda ${LEGEND_CONFIG[layerId].titulo}" style="max-width:220px;">
               </div>`;
    }
  });
  container.innerHTML = html;
  container.style.display = html ? 'inline-block' : 'none';
}
