// Impede que o clique/foco em elementos interativos da search-box feche a caixa
  document.querySelectorAll('.search-box select, .search-box input, .search-box button, .search-box label').forEach(el => {
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('click', e => e.stopPropagation());
    el.addEventListener('focus', e => e.stopPropagation());
  });

export function setupUIHandlers() {
  // Caixa de ferramentas (medição, busca, camadas): comportamento de expandir/recolher
  function toggleExpandBox(selector) {
    if(selector === '.print-box') return;
    document.querySelectorAll(selector).forEach(box => {
      box.classList.remove('expanded'); // inicia recolhido
      box.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
        document.querySelectorAll(selector).forEach(other => {
          if (other !== box) other.classList.remove('expanded');
        });
        box.classList.toggle('expanded');
      });
    });
  }
  toggleExpandBox('.measurement-box');
  toggleExpandBox('.search-box');
  toggleExpandBox('.layer-controls-box');


  // Fecha caixas ao clicar fora, mas ignora interações em elementos interativos da search-box
  document.addEventListener('click', function(e) {
    const selectors = ['.measurement-box','.search-box','.layer-controls-box'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(box => {
        // Não fecha a search-box se clicar em select/input/button dentro dela
        if (selector === '.search-box' && box.contains(e.target)) {
          if (['SELECT','INPUT','BUTTON','LABEL'].includes(e.target.tagName)) return;
        }
        if (!box.contains(e.target)) {
          box.classList.remove('expanded');
        }
      });
    });
  });

  // Grupos de camadas: inicia todos recolhidos, expande só um por vez
  document.querySelectorAll('.theme-layers').forEach(group => {
    group.style.display = 'none';
  });
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      const allGroups = document.querySelectorAll('.theme-layers');
      const thisGroup = btn.nextElementSibling;
      allGroups.forEach(g => {
        if (g !== thisGroup) g.style.display = 'none';
      });
      thisGroup.style.display = (thisGroup.style.display === 'block') ? 'none' : 'block';
    });
  });

  // Botão tela cheia
  const btn = document.getElementById('fullscreen-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 180);
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }
}

import { fromLonLat } from 'ol/proj.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Icon from 'ol/style/Icon.js';
import { showGeoportalNotice } from './geoportal-notice.js';
import { setGeoportalStateValue } from './geoportal-state.js';

export function setupGeolocation(map) {
  const geoBtn = document.getElementById('geolocate-btn');
  if (!geoBtn) return;
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showGeoportalNotice({ type: 'warning', message: 'Geolocalização não suportada pelo navegador.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLonLat = [pos.coords.longitude, pos.coords.latitude];
        setGeoportalStateValue('userLonLat', userLonLat);
        const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
        // Zoom automático ao ativar geolocalização (nível 18 para mais proximidade)
        map.getView().animate({ center: coords, zoom: 18, duration: 800 });
        // Remove marcador anterior
        if (map.getLayers().getArray().some(l => l.get('geolocateLayer'))) {
          const toRemove = map.getLayers().getArray().filter(l => l.get('geolocateLayer'));
          toRemove.forEach(l => map.removeLayer(l));
        }
        // Adiciona marcador com ícone de localização vermelho
        const marker = new Feature({ geometry: new Point(coords) });
        marker.setStyle(new Style({
          image: new Icon({
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff6b6b" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12c0 7 10 13 10 13s10-6 10-13c0-5.52-4.48-10-10-10zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
            scale: 1.5
          })
        }));
        const vectorSource = new VectorSource({ features: [marker] });
        const vectorLayer = new VectorLayer({ source: vectorSource });
        vectorLayer.set('geolocateLayer', true);
        map.addLayer(vectorLayer);
      },
      err => {
        showGeoportalNotice({ type: 'error', message: 'Não foi possível obter sua localização.' });
      }
    );
  });
}
