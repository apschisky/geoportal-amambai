const osmLayer = new ol.layer.Tile({
    source: new ol.source.OSM()
});
const satelliteLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }),
    visible: false
});
const map = new ol.Map({
    target: 'map',
    layers: [osmLayer, satelliteLayer],
    view: new ol.View({
        center: ol.proj.fromLonLat([-55.2333, -23.1050]),
        zoom: 12
    })
});

const scaleLineControl = new ol.control.ScaleLine({
    units: 'metric',
    bar: false,
    steps: 4,
    text: true,
    minWidth: 100
});
map.addControl(scaleLineControl);

function createLayer(url, layerName, crs = 'EPSG:32721') {
    return new ol.layer.Tile({
        source: new ol.source.TileWMS({
            url: url,
            params: {
                'LAYERS': layerName,
                'FORMAT': 'image/png',
                'CRS': crs,
                'TILED': true
            },
            serverType: 'geoserver'
        }),
        visible: false
    });
}

// Remove temporariamente measurement-box e geolocate-box do DOM durante impressão

let removedPrintElements = [];
let removedPrintLayers = [];
let removedPrintGeoMarker = null;
let removedPrintLoteSelecionadoLayer = null;
let removedPrintVectorLayer = null;
window.addEventListener('beforeprint', function() {
  removedPrintElements = [];
  document.querySelectorAll('.measurement-box, .geolocate-box').forEach(el => {
    removedPrintElements.push({el, parent: el.parentNode, next: el.nextSibling});
    el.parentNode.removeChild(el);
  });
  // Remove TODOS os overlays (popups) do mapa e do DOM antes do print
  if (map && typeof map.getOverlays === 'function') {
    const overlays = map.getOverlays().getArray().slice();
    overlays.forEach(overlay => {
      map.removeOverlay(overlay);
      if (overlay.getElement && overlay.getElement()) {
        const el = overlay.getElement();
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }
    });
  }
  // Remove todos os ol.layer.Vector do mapa e limpa todas as features dos sources
  removedPrintLayers = [];
  removedPrintGeoMarker = null;
  removedPrintLoteSelecionadoLayer = null;
  removedPrintVectorLayer = null;
  const allLayers = map.getLayers().getArray().slice();
  allLayers.forEach(layer => {
    if (layer instanceof ol.layer.Vector) {
      // Limpa todas as features do source
      if (layer.getSource && layer.getSource()) {
        layer.getSource().clear();
      }
      removedPrintLayers.push(layer);
      map.removeLayer(layer);
    }
  });
  // Remove geoMarker if present
  if (typeof geoMarker !== 'undefined' && geoMarker && map.getLayers().getArray().includes(geoMarker)) {
    removedPrintGeoMarker = geoMarker;
    map.removeLayer(geoMarker);
  }
  // Remove loteSelecionadoLayer if present
  if (typeof loteSelecionadoLayer !== 'undefined' && loteSelecionadoLayer && map.getLayers().getArray().includes(loteSelecionadoLayer)) {
    removedPrintLoteSelecionadoLayer = loteSelecionadoLayer;
    map.removeLayer(loteSelecionadoLayer);
  }
  // Força o mapa a atualizar antes de imprimir
  if (map && typeof map.updateSize === 'function') {
    setTimeout(() => {
      map.updateSize();
      if (map && map.renderSync) map.renderSync();
    }, 150);
  }
});
window.addEventListener('afterprint', function() {
  removedPrintElements.forEach(({el, parent, next}) => {
    if (next) {
      parent.insertBefore(el, next);
    } else {
      parent.appendChild(el);
    }
  });
  removedPrintElements = [];
  // Restaura todos os ol.layer.Vector removidos
  if (removedPrintLayers && removedPrintLayers.length) {
    removedPrintLayers.forEach(layer => {
      if (!map.getLayers().getArray().includes(layer)) {
        map.addLayer(layer);
      }
    });
    removedPrintLayers = [];
  }
  // Restore geoMarker after print
  if (removedPrintGeoMarker && !map.getLayers().getArray().includes(removedPrintGeoMarker)) {
    map.addLayer(removedPrintGeoMarker);
    removedPrintGeoMarker = null;
  }
  // Restore loteSelecionadoLayer after print
  if (removedPrintLoteSelecionadoLayer && !map.getLayers().getArray().includes(removedPrintLoteSelecionadoLayer)) {
    map.addLayer(removedPrintLoteSelecionadoLayer);
    removedPrintLoteSelecionadoLayer = null;
  }
  // Força o mapa a atualizar após impressão
  if (map && typeof map.updateSize === 'function') {
    setTimeout(() => map.updateSize(), 100);
  }
});

const layers = {
    'layer1': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:Perímetro de Amambai'
    ),
    'layer2': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:EixoDeAdensamento',
        'EPSG:32721'
    ),
    'layer3': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:area_urbana',
        'EPSG:3857'
    ),
    'layer_aeia': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AEIA',
        'EPSG:3857'
    ),
    'layer_aeie': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AEIE',
        'EPSG:3857'
    ),
    'layer_aeis1': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AEIS1',
        'EPSG:32721'
    ),
    'layer_aeis2': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AEIS2',
        'EPSG:32721'
    ),
    'layer_macrozoneamento': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:Macrozoneamento_web',
        'EPSG:32721'
    ),
    'layer4': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:ZoneamentoUrbano_PD_novo',
        'EPSG:32721'
    ),
    'layer5': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:Aldeias'
    ),
    'layer6': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:bacia_rio_parana'
    ),
    'layer7': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:Rios e Córregos de Amambai',
        'EPSG:31981'
    ),
    'layer_aeiu': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AEIU',
        'EPSG:32721'
    ),
    'layer_apc': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AreaExpansaoUrbana',
        'EPSG:32721'
    ),
    'layer_area_protecao_cultural': createLayer(
        'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
        'ne:AreaDeProtecaoCultural',
        'EPSG:32721'
    )
};

// Adiciona as camadas na nova ordem correta de sobreposição
[layers['layer7'], layers['layer6'], layers['layer_area_protecao_cultural'], layers['layer5'], layers['layer_macrozoneamento'], layers['layer4'], layers['layer_aeiu'], layers['layer_apc'], layers['layer_aeis2'], layers['layer_aeis1'], layers['layer_aeie'], layers['layer_aeia'], layers['layer3'], layers['layer2'], layers['layer1']].forEach(layer => map.addLayer(layer));

document.querySelectorAll('.layer-controls-content input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        if (layers[this.id]) {
            layers[this.id].setVisible(this.checked);
            atualizarLegendas();
        }
        // As camadas que não estão em 'layers' já têm listeners próprios abaixo
    });
});

document.querySelectorAll('.layer-controls-content input[name="basemap"]').forEach(radio => {
    radio.addEventListener('change', function () {
        osmLayer.setVisible(this.value === 'osm');
        satelliteLayer.setVisible(this.value === 'satellite');
    });
});

let draw;
const source = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({
    source: source,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: 'red', width: 2 })
    })
});
map.addLayer(vectorLayer);

function formatMeasurement(feature, type) {
    const geometry = feature.getGeometry();
    let output = "";
    if (type === 'LineString') {
        const length = ol.sphere.getLength(geometry);
        output = length > 100000 ? (length / 1000).toFixed(2) + ' km' : length.toFixed(2) + ' m';
    } else {
        const area = ol.sphere.getArea(geometry);
        output = area > 100000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(2) + ' m²';
    }
    const resultSpan = document.getElementById('measurement-result');
    resultSpan.innerText = output;
    resultSpan.style.display = "inline-block";
}

function addInteraction(type) {
    map.removeInteraction(draw);
    draw = new ol.interaction.Draw({ source: source, type: type });
    draw.on('drawend', (event) => formatMeasurement(event.feature, type));
    map.addInteraction(draw);
}

document.getElementById('measure-distance').addEventListener('click', () => {
    addInteraction('LineString');
});

document.getElementById('measure-area').addEventListener('click', () => {
    addInteraction('Polygon');
});

document.getElementById('clear-measurement').addEventListener('click', () => {
    source.clear();
    map.removeInteraction(draw);
    const resultSpan = document.getElementById('measurement-result');
    resultSpan.innerText = "";
    resultSpan.style.display = "none";
});

map.on('pointermove', function(evt) {
    const coord = ol.proj.toLonLat(evt.coordinate);
    document.getElementById('mouse-coordinates').innerText = `Lon: ${coord[0].toFixed(5)}, Lat: ${coord[1].toFixed(5)}`;
});

document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value.trim();
    const searchType = document.getElementById('search-type').value;
    if (!query) {
        alert('Digite um valor para buscar.');
        return;
    }
    if (searchType === 'bic') {
        // Busca por BIC (mantém lógica atual)
        const bicField = 'bic';
        if (layers['layer3']) {
            layers['layer3'].setVisible(true);
            const checkbox = document.getElementById('layer3');
            if (checkbox) checkbox.checked = true;
            atualizarLegendas && atualizarLegendas();
        }
        const wfsUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${bicField}='${query}'`;
        try {
            const response = await fetch(wfsUrl);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                const format = new ol.format.GeoJSON();
                const olFeature = format.readFeature(feature, {
                    dataProjection: 'EPSG:32721',
                    featureProjection: map.getView().getProjection()
                });
                // Formatação amigável dos campos igual ao clique
                let fieldMap = {
                    'quadra': 'Quadra',
                    'vila': 'Vila',
                    'lote': 'Lote',
                    'bic': 'BIC',
                    'area_lote': 'Área do Lote',
                    'construcao': 'Construído',
                    'endereco': 'Endereço',
                    'desc_uso': 'Descrição de Uso',
                    'cep': 'CEP'
                };
                let hideFields = ['id'];
                let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (BIC: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
                for (const key in feature.properties) {
                    if (key === 'geometry' || hideFields.includes(key)) continue;
                    const label = fieldMap[key] || key;
                    html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${label}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
                }
                html += '</table></div>';
                selecionarLoteComoClique(olFeature, html);
            } else {
                alert('Lote com este número BIC não encontrado.');
            }
        } catch (e) {
            alert('Erro ao buscar lote pelo número BIC.');
        }
        return;
    }
    if (searchType === 'endereco') {
        // Busca por Endereço (mantém lógica atual)
        const enderecoField = 'endereco';
        const wfsEnderecoUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${enderecoField} ILIKE '%25${encodeURIComponent(query)}%25'`;
        try {
            const response = await fetch(wfsEnderecoUrl);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                // Ativa camada de lotes e marca checkbox
                if (layers['layer3']) {
                    layers['layer3'].setVisible(true);
                    const checkbox = document.getElementById('layer3');
                    if (checkbox) checkbox.checked = true;
                    atualizarLegendas && atualizarLegendas();
                }
                const feature = data.features[0];
                const format = new ol.format.GeoJSON();
                const olFeature = format.readFeature(feature, {
                    dataProjection: 'EPSG:32721',
                    featureProjection: map.getView().getProjection()
                });
                // Formatação amigável dos campos igual ao clique
                let fieldMap = {
                    'quadra': 'Quadra',
                    'vila': 'Vila',
                    'lote': 'Lote',
                    'bic': 'BIC',
                    'area_lote': 'Área do Lote',
                    'construcao': 'Construído',
                    'endereco': 'Endereço',
                    'desc_uso': 'Descrição de Uso',
                    'cep': 'CEP'
                };
                let hideFields = ['id'];
                let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (Endereço: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
                for (const key in feature.properties) {
                    if (key === 'geometry' || hideFields.includes(key)) continue;
                    const label = fieldMap[key] || key;
                    html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${label}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
                }
                html += '</table></div>';
                selecionarLoteComoClique(olFeature, html);
                return; // <-- Corrige: não faz busca Nominatim se achou na camada de lotes
            }
        } catch (e) {
            // Se erro, ignora e segue para busca Nominatim
        }
        // Busca padrão por endereço
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        fetch(url)
            .then(async response => {
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Resposta inesperada:', text);
                    alert('Erro ao buscar endereço. Resposta inesperada do servidor.');
                    return;
                }
                return response.json();
            })
            .then(data => {
                if (!data) return;
                if (data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    map.getView().animate({
                        center: ol.proj.fromLonLat([lon, lat]),
                        zoom: 16,
                        duration: 1500
                    });
                } else {
                    alert('Endereço não encontrado.');
                }
            })
            .catch(error => {
                console.error('Erro na busca:', error);
                alert('Erro ao buscar endereço.');
            });
        return;
    }
    if (searchType === 'fazenda') {
        // Busca por imóveis rurais nas camadas SIGEF e SNCI
        if (typeof imoveisSigefLayer !== 'undefined') imoveisSigefLayer.setVisible(true);
        if (typeof imoveisSnciLayer !== 'undefined') imoveisSnciLayer.setVisible(true);
        // Corrigido: campo correto para cada camada
        const sigefUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:Imóveis SIGEF 05_25&outputFormat=application/json&CQL_FILTER=nome_area ILIKE '%25${encodeURIComponent(query)}%25'`;
        const snciUrl = `https://geoserver.amambai.ms.gov.br/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:Imóveis SNCI 05_25&outputFormat=application/json&CQL_FILTER=nome_imove ILIKE '%25${encodeURIComponent(query)}%25'`;
        let foundFeatures = [];
        try {
            const [sigefResp, snciResp] = await Promise.all([
                fetch(sigefUrl).then(r => r.json()),
                fetch(snciUrl).then(r => r.json())
            ]);
            if (sigefResp.features) foundFeatures = foundFeatures.concat(sigefResp.features.map(f => ({...f, origem: 'SIGEF', nome_fazenda: f.properties.nome_area})));
            if (snciResp.features) foundFeatures = foundFeatures.concat(snciResp.features.map(f => ({...f, origem: 'SNCI', nome_fazenda: f.properties.nome_imove})));
        } catch (e) {
            alert('Erro ao buscar imóveis rurais.');
            return;
        }
        if (foundFeatures.length === 0) {
            alert('Nenhum imóvel rural encontrado com esse nome.');
            return;
        }
        // Destaca e aproxima no mapa
        const format = new ol.format.GeoJSON();
        const olFeatures = foundFeatures.map(f => format.readFeature(f, {
            dataProjection: 'EPSG:32721', 
            featureProjection: map.getView().getProjection()
        }));
        // Seleciona todas as feições encontradas
        let html = `<div style='font-size:14px;max-width:320px;'><strong>Imóveis Rurais encontrados</strong><br><table style='border-collapse:collapse;width:100%'>`;
        foundFeatures.forEach(f => {
            html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${f.nome_fazenda || 'Sem nome'}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${f.origem}</td></tr>`;
        });
        html += '</table></div>';
        // Cria camada de destaque para todas as feições
        if (loteSelecionadoLayer) {
            map.removeLayer(loteSelecionadoLayer);
            loteSelecionadoLayer = null;
        }
        loteSelecionadoFeature = olFeatures[0]; // Mantém referência à primeira
        loteSelecionadoLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: olFeatures }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
                fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
            })
        });
        map.getLayers().push(loteSelecionadoLayer);
        // Calcula extent total
        let totalExtent = ol.extent.createEmpty();
        olFeatures.forEach(f => ol.extent.extend(totalExtent, f.getGeometry().getExtent()));
        map.getView().fit(totalExtent, { maxZoom: 16, minResolution: 0.5, duration: 800, padding: [40, 40, 40, 40] });
        // Exibe popup centralizado no centro do extent combinado
        const popupCoord = ol.extent.getCenter(totalExtent);
        showLotesPopup(popupCoord, html);
        return;
    }
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    const btn = document.getElementById('fullscreen-btn');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 180);
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// Evento para o botão de impressão
const printBtn = document.getElementById('print-btn');
if (printBtn) {
    printBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        // 1. Fechar toolboxes/menus abertos
        document.querySelectorAll('.measurement-box, .search-box, .layer-controls-box').forEach(box => {
            box.classList.remove('expanded');
        });
        // 2. Definir área de impressão (classe temporária)
        const mapContainer = document.getElementById('map');
        let centerToUse = null;
        let popupHtml = '';
        // Remove popup do mapa antes de imprimir
        if (popupOverlayLotes) {
            // Remove overlay do mapa
            map.removeOverlay(popupOverlayLotes);
            // Remove elemento do popup do DOM completamente
            if (popupOverlayLotes.getElement && popupOverlayLotes.getElement()) {
                const popupEl = popupOverlayLotes.getElement();
                if (popupEl && popupEl.parentNode) {
                    popupEl.parentNode.removeChild(popupEl);
                }
            }
            popupOverlayLotes = null;
        }
        // 3. Centralizar feição selecionada (se houver), agora com área de impressão definida
        let extent = null;
        if (loteSelecionadoFeature) {
            extent = loteSelecionadoFeature.getGeometry().getExtent();
            // Aplica o mesmo maxZoom da seleção, mas mantém o padding customizado para impressão
            const leftPad = 0; // bem pequeno para empurrar para a esquerda
            const rightPad = Math.round(mapContainer.getBoundingClientRect().width * 0.70); // maior para dar mais espaço à direita
            const topPad = 20; // pequeno para empurrar para o topo
            const bottomPad = Math.round(mapContainer.getBoundingClientRect().height * 0.22); // igual ao anterior
            map.getView().fit(extent, { maxZoom: 18, duration: 0, padding: [topPad, rightPad, bottomPad, leftPad] });
            let popupSections = [];
            // Atributos da feição selecionada
            if (typeof loteSelecionadoFeature.getProperties === 'function') {
                const props = loteSelecionadoFeature.getProperties();
                let loteHtml = '<div style="font-size:14px;max-width:320px;"><strong>Feição selecionada</strong><br><table style="border-collapse:collapse;width:100%">';
                for (const key in props) {
                    if (key !== 'geometry') {
                        loteHtml += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
                    }
                }
                loteHtml += '</table></div>';
                popupSections.push(loteHtml);
            }
            // Atributos do zoneamento se ativo
            if (layers['layer4'] && layers['layer4'].getVisible()) {
                // Busca atributos do zoneamento via GetFeatureInfo na feição selecionada
                const view = map.getView();
                const zoneamentoLayer = layers['layer4'];
                const zoneamentoUrl = zoneamentoLayer.getSource().getFeatureInfoUrl(
                    ol.extent.getCenter(extent),
                    view.getResolution(),
                    'EPSG:3857',
                    {
                        'INFO_FORMAT': 'application/json',
                        'QUERY_LAYERS': 'ne:ZoneamentoUrbano_PD_novo'
                    }
                );
                if (zoneamentoUrl) {
                    try {
                        const response = await fetch(zoneamentoUrl);
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            const data = await response.json();
                            if (data.features && data.features.length > 0) {
                                const props = data.features[0].properties;
                                let zoneamentoHtml = '<div style="font-size:14px;max-width:320px;"><strong>Zoneamento</strong><br><table style="border-collapse:collapse;width:100%">';
                                for (const key in props) {
                                    if (key !== 'geometry' && key !== 'id' && key !== 'areas') {
                                        zoneamentoHtml += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#e3f2fd;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
                                    }
                                }
                                zoneamentoHtml += '</table></div>';
                                popupSections.push(zoneamentoHtml);
                            }
                        }
                    } catch (e) {
                        // ignora erro, não mostra zoneamento
                    }
                }
            }
            popupHtml = popupSections.join('<hr>');
        }
        // 4. Move legenda e popups para a segunda página de impressão (sempre cria a área, mesmo sem feição)
        let printPopupDiv = document.getElementById('print-popup-table-page');
        if (!printPopupDiv) {
            printPopupDiv = document.createElement('div');
            printPopupDiv.id = 'print-popup-table-page';
            printPopupDiv.className = 'print-popup-table-page';
            document.body.appendChild(printPopupDiv);
        }
        const legendas = document.getElementById('legendas-categorias');
        let legendasHtml = legendas && legendas.innerHTML.trim() ? `<div class='legend-content' style="float:left;width:50%;max-height:420px;overflow-y:auto;box-sizing:border-box;padding-right:12px;">${legendas.innerHTML}</div>` : '';
        let popupContentHtml = typeof popupHtml === 'string' && popupHtml.trim() ? `<div class='popup-table-content'>${popupHtml}</div>` : '';
        if (!legendasHtml && !popupContentHtml) {
            printPopupDiv.innerHTML = '<div style="font-size:16px;padding:40px;text-align:center;">Nenhuma informação de legenda ou popup disponível para impressão.</div>';
        } else {
            printPopupDiv.innerHTML = legendasHtml + popupContentHtml;
        }
        // Não força display na tela, apenas deixa visível para impressão
        // Do not force display:none here; CSS handles visibility for print
        // 5. Delay maior e renderização forçada antes do print
        setTimeout(() => {
            if (map && typeof map.updateSize === 'function') {
                map.updateSize();
            }
            if (map && map.renderSync) {
                map.renderSync();
            }
            setTimeout(() => {
                window.print();
                setTimeout(() => {
                    mapContainer.classList.remove('print-area');
                    if (printPopupDiv) printPopupDiv.style.display = 'none';
                }, 800);
            }, 400); // delay extra para garantir renderização
        }, 500); // delay maior para garantir que tudo foi removido/renderizado
    });
}

const legendasWMS = {
    'layer_macrozoneamento': {
        titulo: 'Macrozoneamento',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Macrozoneamento_web'
    },
    'layer5': {
        titulo: 'Terras Indígenas',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Aldeias'
    },
    'layer6': {
        titulo: 'Sub-bacias do Rio Paraná',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:bacia_rio_parana'
    },
    'layer4': {
        titulo: 'Zoneamento Urbano',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:ZoneamentoUrbano_PD_novo'
    },
    'layer_aeia': {
        titulo: 'AEIA',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIA'
    },
    'layer_aeie': {
        titulo: 'AEIE',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIE'
    },
    'layer_aeis1': {
        titulo: 'AEIS1',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS1'
    },
    'layer_aeis2': {
        titulo: 'AEIS2',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS2'
    },
    'layer_aeiu': {
        titulo: 'AEIU',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIU'
    },
    'layer_apc': {
        titulo: 'Área de Expansão Urbana',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaExpansaoUrbana'
    },
    'layer_area_protecao_cultural': {
        titulo: 'Área de Proteção Cultural',
        url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaDeProtecaoCultural'
    }
};

function atualizarLegendas() {
    const container = document.getElementById('legendas-categorias');
    let html = '';
    Object.keys(legendasWMS).forEach(layerId => {
        const checkbox = document.getElementById(layerId);
        if (checkbox && checkbox.checked) {
            html += `<div style="margin-bottom:12px;">
                        <strong>${legendasWMS[layerId].titulo}</strong><br>
                        <img src="${legendasWMS[layerId].url}" alt="Legenda ${legendasWMS[layerId].titulo}" style="max-width:220px;">
                     </div>`;
        }
    });
    container.innerHTML = html;
    container.style.display = html ? 'inline-block' : 'none';
}

function toggleExpandBox(selector) {
    if(selector === '.print-box') return; // Não expande print-box
    document.querySelectorAll(selector).forEach(box => {
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
//toggleExpandBox('.print-box'); // Removido para não expandir
toggleExpandBox('.layer-controls-box');
document.addEventListener('click', function(e) {
    const selectors = [
        '.measurement-box',
        '.search-box',
        //'.print-box', // Removido para não expandir
        '.layer-controls-box'
    ];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(box => {
            if (!box.contains(e.target)) {
                box.classList.remove('expanded');
            }
        });
    });
});
let popupOverlayLotes;
function showLotesPopup(coord, html, isPrint = false) {
    if (popupOverlayLotes) {
        map.removeOverlay(popupOverlayLotes);
    }
    // Cria container do popup
    const container = document.createElement('div');
    container.className = 'ol-popup draggable-popup';
    // Adiciona barra superior com botão fechar
    const bar = document.createElement('div');
    bar.className = 'ol-popup-bar';
    bar.style.cssText = 'cursor:move; background:#1976d2; color:#fff; padding:6px 12px; font-weight:bold; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center;';
    bar.innerHTML = `<span>Informações</span><button class='ol-popup-close' style='background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 8px;' title='Fechar'>&times;</button>`;
    container.appendChild(bar);
    // Adiciona conteúdo
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ol-popup-content';
    contentDiv.innerHTML = html;
    container.appendChild(contentDiv);
    // Evento de fechar
    bar.querySelector('.ol-popup-close').onclick = function() {
        if (popupOverlayLotes) {
            map.removeOverlay(popupOverlayLotes);
            popupOverlayLotes = null;
        }
    };
    // Drag & drop
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
    // Cria overlay
    popupOverlayLotes = new ol.Overlay({
        element: container,
        positioning: 'top-right',
        stopEvent: true,
        offset: [400, 0]
    });
    map.addOverlay(popupOverlayLotes);
    popupOverlayLotes.setPosition(coord);
}

let loteSelecionadoFeature = null;
let loteSelecionadoLayer = null;

map.on('singleclick', async function(evt) {
    console.log('Clicou no mapa', evt.coordinate);
    // Remove destaque anterior
    if (loteSelecionadoLayer) {
        map.removeLayer(loteSelecionadoLayer);
        loteSelecionadoLayer = null;
        loteSelecionadoFeature = null;
    }
    // Checa visibilidade
    const lotesAtivo = layers['layer3'] && layers['layer3'].getVisible();
    const zoneamentoAtivo = layers['layer4'] && layers['layer4'].getVisible();
    const edificacoesAtivo = typeof edificacoesLayer !== 'undefined' && edificacoesLayer.getVisible();
    const sigefAtivo = typeof imoveisSigefLayer !== 'undefined' && imoveisSigefLayer.getVisible();
    const snciAtivo = typeof imoveisSnciLayer !== 'undefined' && imoveisSnciLayer.getVisible();
    const view = map.getView();
    let html = '';
    let algumResultado = false;
    let loteGeojson = null;
    let loteEncontrado = false;

    async function fetchFeatureInfo(layer, epsg, query, titulo, highlight) {
        let hideFields = [];
        const url = layer.getSource().getFeatureInfoUrl(
            evt.coordinate,
            view.getResolution(),
            epsg,
            {
                'INFO_FORMAT': 'application/json',
                'QUERY_LAYERS': query
            }
        );
        console.log('GetFeatureInfo URL:', url);
        if (url) {
            try {
                const response = await fetch(url);
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Resposta inesperada (feature info):', text);
                    return `<div style=\"color:red;\">Erro ao buscar ${titulo.toLowerCase()}.<\/div>`;
                }
                const data = await response.json();
                console.log('FeatureInfo data:', data);
                if (data.features && data.features.length > 0) {
                    algumResultado = true;
                    if (highlight && data.features[0].geometry) {
                        loteGeojson = data.features[0];
                        loteEncontrado = true;
                    }
                    const props = data.features[0].properties;
                    let bloco = `<div style=\"font-size:14px;max-width:320px;\"><strong>${titulo}<\/strong><br>`;
                    bloco += '<table style=\"border-collapse:collapse;width:100%\">';
                    // Mapeamento de campos para nomes amigáveis
                    let fieldMap = {};
                    if (query === 'ne:ZoneamentoUrbano_PD_novo') {
                        fieldMap = {
                            'zona': 'Zoneamento',
                            'ca_bas': 'Coef. de Aprov. Básico',
                            'ca_min': 'Coef. de Aprov. Mínimo',
                            'ca_max': 'Coef. de Aprov. Máximo',
                            'to_max': 'Tx. de Ocup. Máxima',
                            'tp_min': 'Tx. de Permeabilidade Mínima',
                            'pavimentos_max': 'Quantidade Máx. de Pavimentos'
                        };
                        hideFields = ['id', 'areas'];
                    } else if (query === 'ne:area_urbana') {
                        fieldMap = {
                            'quadra': 'Quadra',
                            'vila': 'Vila',
                            'lote': 'Lote',
                            'bic': 'BIC',
                            'area_lote': 'Área do Lote',
                            'construcao': 'Construído',
                            'endereco': 'Endereço',
                            'desc_uso': 'Descrição de Uso',
                            'cep': 'CEP'
                        };
                        hideFields = ['id'];
                    } else if (query === 'ne:EdificaçõesDB') {
                        fieldMap = {
                            'bic': 'BIC',
                            'area_edif': 'Área Edificada',
                            'lote': 'Lote',
                            'quadra': 'Quadra',
                            'vila': 'Vila'
                        };
                        hideFields = ['id', 'Imagens'];
                    } else if (query === 'ne:Imóveis SIGEF 05_25') {
                        fieldMap = {
                            'nome_area': 'Nome da Fazenda',
                            'matricula': 'Matrícula',
                            'area_ha': 'Área (ha)',
                            'municipio': 'Município',
                            'uf': 'UF',
                            'codigo_imovel': 'Código Imóvel',
                            'nirf': 'NIRF',
                            'ccir': 'CCIR',
                            'proprietario': 'Proprietário',
                            'car': 'CAR'
                        };
                        hideFields = ['id', 'geometry'];
                    } else if (query === 'ne:Imóveis SNCI 05_25') {
                        fieldMap = {
                            'nome_imove': 'Nome da Fazenda',
                            'matricula': 'Matrícula',
                            'area_ha': 'Área (ha)',
                            'municipio': 'Município',
                            'uf': 'UF',
                            'codigo_imovel': 'Código Imóvel',
                            'nirf': 'NIRF',
                            'ccir': 'CCIR',
                            'proprietario': 'Proprietário',
                            'car': 'CAR'
                        };
                        hideFields = ['id', 'geometry'];
                    }
                    for (const key in props) {
                        if (key === 'geometry' || hideFields.includes(key)) continue;
                        const label = fieldMap[key] || key;
                        bloco += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${label}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}</td></tr>`;
                    }
                    bloco += '<\/table><\/div>';
                    console.log('Bloco HTML gerado:', bloco);
                    return bloco;
                } else {
                    console.warn('Nenhuma feature retornada para', titulo);
                }
            } catch (e) {
                console.error('Erro ao buscar info:', e);
                return `<div style=\"color:red;\">Erro ao buscar ${titulo.toLowerCase()}.<\/div>`;
            }
        }
        return '';
    }

    // Busca paralela conforme camadas visíveis
    let htmlLote = '', htmlZoneamento = '', htmlEdif = '', htmlSigef = '', htmlSnci = '';
    if (lotesAtivo) {
        htmlLote = await fetchFeatureInfo(layers['layer3'], 'EPSG:3857', 'ne:area_urbana', 'Atributos do lote:', true);
    }
    if (zoneamentoAtivo) {
        htmlZoneamento = await fetchFeatureInfo(layers['layer4'], 'EPSG:3857', 'ne:ZoneamentoUrbano_PD_novo', 'Atributos do zoneamento:');
    }
    if (edificacoesAtivo) {
        htmlEdif = await fetchFeatureInfo(edificacoesLayer, 'EPSG:3857', 'ne:EdificaçõesDB', 'Atributos da edificação:');
    }
    // Adiciona busca para SIGEF
    if (sigefAtivo) {
        htmlSigef = await fetchFeatureInfo(imoveisSigefLayer, 'EPSG:3857', 'ne:Imóveis SIGEF 05_25', 'Imóvel SIGEF:', true);
    }
    // Adiciona busca para SNCI
    if (snciAtivo) {
        htmlSnci = await fetchFeatureInfo(imoveisSnciLayer, 'EPSG:3857', 'ne:Imóveis SNCI 05_25', 'Imóvel SNCI:', true);
    }
    // Monta HTML combinando resultados (ordem: Lote, Zoneamento, Edificações, SIGEF, SNCI)
    let blocos = [];
    if (htmlLote) blocos.push(htmlLote);
    if (htmlZoneamento) blocos.push(htmlZoneamento);
    if (htmlEdif) blocos.push(htmlEdif);
    if (htmlSigef) blocos.push(htmlSigef);
    if (htmlSnci) blocos.push(htmlSnci);
    html = blocos.join('<hr>');
    console.log('HTML final do popup:', html);

    // Se encontrou lote, destaca e centraliza, senão mostra popup no clique
    if (loteEncontrado && loteGeojson && loteGeojson.geometry) {
        const format = new ol.format.GeoJSON();
        let dataProj = 'EPSG:3857';
        // Remove camada de destaque anterior se existir
        if (loteSelecionadoLayer) {
            map.removeLayer(loteSelecionadoLayer);
            loteSelecionadoLayer = null;
        }
        loteSelecionadoFeature = format.readFeature(loteGeojson, {
            dataProjection: dataProj,
            featureProjection: map.getView().getProjection()
        });
        loteSelecionadoLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: [loteSelecionadoFeature] }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
                fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
            })
        });
        // Adiciona a camada de destaque sempre no topo
        map.getLayers().push(loteSelecionadoLayer);
        // Centraliza e aproxima a feição selecionada
        const extent = loteSelecionadoFeature.getGeometry().getExtent();
        map.getView().fit(extent, { maxZoom: 18, duration: 800, padding: [60, 60, 60, 60] });

        setTimeout(() => {
            let geometry = loteSelecionadoFeature.getGeometry();
            let popupCoord = geometry.getType() === 'Point'
                ? geometry.getCoordinates()
                : ol.extent.getCenter(extent);

            const mapSize = map.getSize();
            let pixel = map.getPixelFromCoordinate(popupCoord);

            // Cria popup invisível para medir altura real
            const tempDiv = document.createElement('div'); // Elemento temporário para medir tamanho do popup
            // Define estilos iguais ao popup real para medir corretamente
            tempDiv.style.position = 'absolute'; // Não afeta layout
            tempDiv.style.visibility = 'hidden'; // Invisível
            tempDiv.style.pointerEvents = 'none'; // Não interativo
            tempDiv.style.width = '340px'; // Largura igual ao popup real
            tempDiv.style.padding = '12px 18px'; // Padding igual ao popup real
            tempDiv.style.fontSize = '14px'; // Fonte igual ao popup real
            tempDiv.innerHTML = html; // Conteúdo do popup
            // Adiciona ao DOM para medir
            document.body.appendChild(tempDiv);
            const popupElementWidth = tempDiv.offsetWidth; // Mede largura real
            const popupElementHeight = tempDiv.offsetHeight; // Mede altura real do popup
            document.body.removeChild(tempDiv); // Remove elemento temporário

            // Ajuste: popup mais próximo da feição e centralizado verticalmente
            let offsetX = -30; // Agora sem afastamento lateral, popup "grudado" na feição
            let offsetY = -popupElementHeight / 2 + 300; // Centraliza verticalmente e desce 20px
            // Se o popup ultrapassar a borda direita do mapa, move para a esquerda da feição
            if (pixel[0] + offsetX + popupElementWidth > mapSize[0]) {
                offsetX = -popupElementWidth - 0; // Move para a esquerda da feição
            }
            // Se o popup ficar acima do topo do mapa, ajusta para não cortar
            if (pixel[1] + offsetY < 20) {
                offsetY = 150 - pixel[1]; // Garante pelo menos 20px do topo
            }
            // Se o popup ultrapassar a borda inferior, ajusta para não cortar
            if (pixel[1] + offsetY + popupElementHeight > mapSize[1]) {
                offsetY = mapSize[1] - popupElementHeight - pixel[1] - 10; // Garante 10px da borda inferior
            }
            pixel[0] += offsetX; // Aplica deslocamento horizontal calculado
            pixel[1] += offsetY; // Aplica deslocamento vertical calculado
            const popupCoordSmart = map.getCoordinateFromPixel(pixel); // Converte pixel ajustado para coordenada do mapa
            if (html && algumResultado) {
                showLotesPopup(popupCoordSmart, html); // Exibe o popup na posição ajustada
            }
        }, 900);
    } else if (html && algumResultado) {
        // fallback: mostra popup no local do clique
        showLotesPopup(evt.coordinate, html);
    }
});

let geoMarker;
document.querySelector('.geolocate-box').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const coords = ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]);
            map.getView().animate({ center: coords, zoom: 16, duration: 1200 });
            if (geoMarker) {
                map.removeLayer(geoMarker);
            }
            geoMarker = new ol.layer.Vector({
                source: new ol.source.Vector({
                    features: [
                        new ol.Feature({
                            geometry: new ol.geom.Point(coords)
                        })
                    ]
                }),
                style: new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 8,
                        fill: new ol.style.Fill({ color: '#1976d2' }),
                        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                    })
                })
            });
            map.addLayer(geoMarker);
        }, function() {
            alert('Não foi possível obter sua localização.');
        });
    } else {
        alert('Geolocalização não suportada neste navegador.');
    }
});

// --- Código transferido do index.html ---
// Camada Pavimentação
const pavimentacaoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Pavimentação',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(pavimentacaoLayer);

const legendasCategorias = document.getElementById('legendas-categorias');
const pavimentacaoLegendHTML = `
  <div id="legenda-pavimentacao">
    <strong>Pavimentação</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Pavimentação" alt="Legenda Pavimentação">
  </div>
`

const pavCheckbox = document.getElementById('layer_pavimentacao');
if (pavCheckbox) pavCheckbox.addEventListener('change', function() {
  pavimentacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-pavimentacao')) {
      legendasCategorias.innerHTML += pavimentacaoLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const pavLegend = document.getElementById('legenda-pavimentacao');
    if (pavLegend) pavLegend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Trechos de RDA
const trechosRdaLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Trechos de RDA',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(trechosRdaLayer);

const trechosRdaLegendHTML = `
  <div id="legenda-trechosrda">
    <strong>Trechos de RDA</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Trechos%20de%20RDA" alt="Legenda Trechos de RDA">
  </div>
`;

const trechosRdaCheckbox = document.getElementById('layer_trechosrda');
if (trechosRdaCheckbox) trechosRdaCheckbox.addEventListener('change', function() {
  trechosRdaLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-trechosrda')) {
      legendasCategorias.innerHTML += trechosRdaLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const rdaLegend = document.getElementById('legenda-trechosrda');
    if (rdaLegend) rdaLegend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Rede de esgoto
const redeEsgotoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:rede_esgoto_2025_at',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(redeEsgotoLayer);

const redeEsgotoLegendHTML = `
  <div id="legenda-redeesgoto">
    <strong>Rede de esgoto</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:rede_esgoto_2025_at" alt="Legenda Rede de esgoto">
  </div>
`;

const redeEsgotoCheckbox = document.getElementById('layer_redeesgoto');
if (redeEsgotoCheckbox) redeEsgotoCheckbox.addEventListener('change', function() {
  redeEsgotoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-redeesgoto')) {
      legendasCategorias.innerHTML += redeEsgotoLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const esgotoLegend = document.getElementById('legenda-redeesgoto');
    if (esgotoLegend) esgotoLegend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Assistência Social
const assistenciaSocialLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Assistência social',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(assistenciaSocialLayer);

const assistenciaSocialLegendHTML = `
  <div id="legenda-assistencia-social">
    <strong>Assistência Social</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Assistência%20social" alt="Legenda Assistência Social">
  </div>
`;

const assistenciaSocialCheckbox = document.getElementById('layer_assistencia_social');
if (assistenciaSocialCheckbox) assistenciaSocialCheckbox.addEventListener('change', function() {
  assistenciaSocialLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-assistencia-social')) {
      legendasCategorias.innerHTML += assistenciaSocialLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-assistencia-social');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Educação
const educacaoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Educação_at',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(educacaoLayer);

const educacaoLegendHTML = `
  <div id="legenda-educacao">
    <strong>Educação</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Educação_at" alt="Legenda Educação">
  </div>
`;

const educacaoCheckbox = document.getElementById('layer_educacao');
if (educacaoCheckbox) educacaoCheckbox.addEventListener('change', function() {
  educacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-educacao')) {
      legendasCategorias.innerHTML += educacaoLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-educacao');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Prefeitura
const prefeituraLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Prefeitura',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(prefeituraLayer);

const prefeituraLegendHTML = `
  <div id="legenda-prefeitura">
    <strong>Prefeitura</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Prefeitura" alt="Legenda Prefeitura">
  </div>
`;

const prefeituraCheckbox = document.getElementById('layer_prefeitura');
if (prefeituraCheckbox) prefeituraCheckbox.addEventListener('change', function() {
  prefeituraLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-prefeitura')) {
      legendasCategorias.innerHTML += prefeituraLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-prefeitura');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Saúde
const saudeLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Saúde_atu',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(saudeLayer);

const saudeLegendHTML = `
  <div id="legenda-saude">
    <strong>Saúde</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Saúde_atu" alt="Legenda Saúde">
  </div>
`;

const saudeCheckbox = document.getElementById('layer_saude');
if (saudeCheckbox) saudeCheckbox.addEventListener('change', function() {
  saudeLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-saude')) {
      legendasCategorias.innerHTML += saudeLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-saude');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Tipos de vegetação
const tiposVegetacaoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:veg_dissolvido', // corrigido para o nome correto do layer
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(tiposVegetacaoLayer);

const tiposVegetacaoLegendHTML = `
  <div id="legenda-tipos-vegetacao">
    <strong>Tipos de vegetação</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:veg_dissolvido" alt="Legenda Tipos de vegetação">
  </div>
`;

const tiposVegetacaoCheckbox = document.getElementById('layer_tipos_vegetacao');
if (tiposVegetacaoCheckbox) tiposVegetacaoCheckbox.addEventListener('change', function() {
  tiposVegetacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-tipos-vegetacao')) {
      legendasCategorias.innerHTML += tiposVegetacaoLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-tipos-vegetacao');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Imóveis SIGEF
const imoveisSigefLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Imóveis SIGEF 05_25',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(imoveisSigefLayer);

const imoveisSigefLegendHTML = `
  <div id="legenda-imoveis-sigef">
    <strong>Imóveis SIGEF</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SIGEF%2005_25" alt="Legenda Imóveis SIGEF">
  </div>
`;

const imoveisSigefCheckbox = document.getElementById('layer_imoveis_sigef');
if (imoveisSigefCheckbox) imoveisSigefCheckbox.addEventListener('change', function() {
  imoveisSigefLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-imoveis-sigef')) {
      legendasCategorias.innerHTML += imoveisSigefLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-imoveis-sigef');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Imóveis SNCI
const imoveisSnciLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:Imóveis SNCI 05_25',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(imoveisSnciLayer);

const imoveisSnciLegendHTML = `
  <div id="legenda-imoveis-snci">
    <strong>Imóveis SNCI</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SNCI%2005_25" alt="Legenda Imóveis SNCI">
  </div>
`;

const imoveisSnciCheckbox = document.getElementById('layer_imoveis_snci');
if (imoveisSnciCheckbox) imoveisSnciCheckbox.addEventListener('change', function() {
  imoveisSnciLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-imoveis-snci')) {
      legendasCategorias.innerHTML += imoveisSnciLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-imoveis-snci');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Edificações
const edificacoesLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    params: {
      'LAYERS': 'ne:EdificaçõesDB',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    ratio: 1,
    serverType: 'geoserver'
  }),
  visible: false
});
map.addLayer(edificacoesLayer);

const edificacoesLegendHTML = `
  <div id="legenda-edificacoes">
    <strong>Edificações</strong><br>
    <img src="https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:EdificaçõesDB" alt="Legenda Edificações">
  </div>
`;

const edificacoesCheckbox = document.getElementById('layer_edificacoes');
if (edificacoesCheckbox) edificacoesCheckbox.addEventListener('change', function() {
  edificacoesLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-edificacoes')) {
      legendasCategorias.innerHTML += edificacoesLegendHTML;
    }
    if (legendasCategorias) legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-edificacoes');
    if (legend) legend.remove();
    if (legendasCategorias && legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Expansão/retração dos grupos de camadas
const themeToggles = document.querySelectorAll('.theme-toggle');
themeToggles.forEach(btn => {
  btn.addEventListener('click', function() {
    // Fecha todos os grupos
    document.querySelectorAll('.theme-layers').forEach(group => {
      if (group !== btn.nextElementSibling) {
        group.style.display = 'none';
      }
    });
    // Alterna o grupo clicado
    const layers = btn.nextElementSibling;
    if (layers.style.display === 'block') {
      layers.style.display = 'none';
    } else {
      layers.style.display = 'block';
    }
  });
});
// Ao carregar, todas as theme-layers começam retraídas
window.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.theme-layers').forEach(group => {
    group.style.display = 'none';
  });
});

// Remove a camada se já foi adicionada
map.removeLayer(tiposVegetacaoLayer);
map.removeLayer(edificacoesLayer);
// Adiciona a camada 'Tipos de vegetação' logo abaixo da camada de lotes (layer3)
const lotesIndex = map.getLayers().getArray().indexOf(layers['layer3']);
map.getLayers().insertAt(lotesIndex, tiposVegetacaoLayer);
// Adiciona a camada 'Edificações' logo acima da camada de lotes (layer3)
map.getLayers().insertAt(lotesIndex + 1, edificacoesLayer);

// Adiciona o display do zoom no HTML
const zoomDiv = document.createElement('div');
zoomDiv.id = 'zoom-display';
document.body.appendChild(zoomDiv);

function atualizarZoomDisplay() {
  const zoom = map.getView().getZoom();
  zoomDiv.textContent = 'Zoom: ' + (zoom !== undefined && zoom !== null ? zoom.toFixed(2) : '');
}

// Atualiza ao carregar o mapa
map.once('postrender', atualizarZoomDisplay);
// Atualiza sempre que o zoom mudar
map.getView().on('change:zoom', atualizarZoomDisplay);
// Atualiza também ao trocar de mapa base
map.getView().on('change:center', atualizarZoomDisplay);

// Defina o limite máximo de zoom permitido para o layer satélite
const SATELLITE_MAX_ZOOM = 18; // ajuste conforme o limite do provedor

// Ao trocar para o satélite, limite o zoom máximo
map.getView().on('change:resolution', function() {
  if (satelliteLayer.getVisible()) {
    const zoom = map.getView().getZoom();
    if (zoom > SATELLITE_MAX_ZOOM) {
      map.getView().setZoom(SATELLITE_MAX_ZOOM);
    }
  }
});

// Também limite ao ativar o satélite
const satelliteRadio = document.querySelector('input[name="basemap"][value="satellite"]');
if (satelliteRadio) {
  satelliteRadio.addEventListener('change', function() {
    if (this.checked) {
      const zoom = map.getView().getZoom();
      if (zoom > SATELLITE_MAX_ZOOM) {
        map.getView().setZoom(SATELLITE_MAX_ZOOM);
      }
    }
  });
}

// Impede que o clique no select ou input da busca feche a caixa de busca, permitindo ao usuário escolher a forma de busca sem fechar o menu.
document.querySelectorAll('.search-box select, .search-box input, .search-box button').forEach(el => {
    el.addEventListener('mousedown', function(e) {
        e.stopPropagation();
    });
    el.addEventListener('click', function(e) {
        e.stopPropagation();
    });
});

// --- Busca: garantir seleção da feição como no clique ---
async function selecionarLoteComoClique(olFeature, html) {
    // Remove destaque anterior
    if (loteSelecionadoLayer) {
        map.removeLayer(loteSelecionadoLayer);
        loteSelecionadoLayer = null;
    }
    loteSelecionadoFeature = olFeature;
    // Log para depuração
    console.log('Selecionando feição:', olFeature);
    const geom = olFeature.getGeometry();
    if (!geom) {
        console.warn('A feição não possui geometria.');
        return;
    }
    const extent = geom.getExtent();
    console.log('Extent da feição selecionada:', extent);
    // Verifica se o extent é válido
    if (
        !extent ||
        extent[0] === Infinity || extent[1] === Infinity ||
        extent[2] === -Infinity || extent[3] === -Infinity
    ) {
        console.warn('Extent inválido, não será possível destacar/centralizar.');
        return;
    }
    loteSelecionadoLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [olFeature] }),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
            fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
        })
    });
    // Adiciona a camada de destaque sempre no topo
    map.getLayers().push(loteSelecionadoLayer);
    // Centraliza e aproxima a feição selecionada
    map.getView().fit(extent, { maxZoom: 18, duration: 800, padding: [60, 60, 60, 60] });
    // Exibe o popup na posição central da feição
    setTimeout(() => {
        let geometry = olFeature.getGeometry();
        let popupCoord = geometry.getType() === 'Point'
            ? geometry.getCoordinates()
            : ol.extent.getCenter(extent);
        showLotesPopup(popupCoord, html);
    }, 900);
}

// Limpa o campo de busca ao trocar o tipo de busca
const searchTypeSelect = document.getElementById('search-type');
if (searchTypeSelect) {
  searchTypeSelect.addEventListener('change', function() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    });
}
