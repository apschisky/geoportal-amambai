// Lógica de atualização e exibição de legendas
import { LEGEND_CONFIG } from '@/geoportal-config.js';

export function atualizarLegendas(layers) {
  const container = document.getElementById('legendas-categorias');
  let html = '';
  Object.keys(LEGEND_CONFIG).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox && checkbox.checked) {
      // Legenda customizada para Farmácias (sem "Single symbol")
      if (layerId === 'layer_farmacias') {
        html += `<div class="farmacia-legend" style="margin-bottom:12px;">
                  <strong>${LEGEND_CONFIG[layerId].titulo}</strong><br>
                  <div class="farmacia-legend-row">
                    <span class="farmacia-legend-marker farmacia-legend-marker-plantao"></span>
                    <span>Farm&aacute;cia de Plant&atilde;o</span>
                  </div>
                  <div class="farmacia-legend-row">
                    <img src="${LEGEND_CONFIG[layerId].url}" alt="Legenda Farm&aacute;cias" style="max-width:220px;">
                  </div>
               </div>`;
      } else {
        html += `<div style="margin-bottom:12px;">
                  <strong>${LEGEND_CONFIG[layerId].titulo}</strong><br>`;
        // Adiciona subtítulo específico para a camada de coleta
        if (layerId === 'layer_coleta') {
          html += `<div style="font-size:12px;color:#333;margin-top:4px;margin-bottom:6px;">Setores</div>`;
        }
        html += `                  <img src="${LEGEND_CONFIG[layerId].url}" alt="Legenda ${LEGEND_CONFIG[layerId].titulo}" style="max-width:220px;">
                 </div>`;
      }
    }
  });
  container.innerHTML = html;
  container.style.display = html ? 'inline-block' : 'none';
}
