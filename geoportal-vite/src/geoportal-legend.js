// Lógica de atualização e exibição de legendas
import { LEGEND_CONFIG } from '@/geoportal-config.js';
import { atualizarLegendaBotaoPonta } from '@/geoportal-farmacias.js';

export function atualizarLegendas(layers) {
  const container = document.getElementById('legendas-categorias');
  let html = '';
  Object.keys(LEGEND_CONFIG).forEach(layerId => {
    const checkbox = document.getElementById(layerId);
    if (checkbox && checkbox.checked) {
      // Legenda customizada para Farmácias (sem "Single symbol")
      if (layerId === 'layer_farmacias') {
        html += `<div style="margin-bottom:12px;">
                  <strong>${LEGEND_CONFIG[layerId].titulo}</strong><br>
                  <div style="display:flex;align-items:center;margin-top:8px;">
                    <div style="width:24px;height:24px;background-color:red;border-radius:50%;border:2px solid darkred;margin-right:8px;"></div>
                    <span style="font-size:12px;color:#333;">Farmácia de Plantão</span>
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
  
  // Atualizar legenda de farmácias de plantão se a camada está ativa
  const farmaciasCheckbox = document.getElementById('layer_farmacias');
  if (farmaciasCheckbox && farmaciasCheckbox.checked) {
    atualizarLegendaBotaoPonta(container);
  }
}
