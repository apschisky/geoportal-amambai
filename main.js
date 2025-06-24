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

const layers = {
    'layer1': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:Perímetro de Amambai'
    ),
    'layer2': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:EixoDeAdensamento',
        'EPSG:32721'
    ),
    'layer3': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:area_urbana',
        'EPSG:3857'
    ),
    'layer_aeia': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AEIA',
        'EPSG:3857'
    ),
    'layer_aeie': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AEIE',
        'EPSG:3857'
    ),
    'layer_aeis1': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AEIS1',
        'EPSG:32721'
    ),
    'layer_aeis2': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AEIS2',
        'EPSG:32721'
    ),
    'layer4': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:ZoneamentoUrbano_PD_novo',
        'EPSG:3857'
    ),
    'layer5': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:Aldeias'
    ),
    'layer6': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:bacia_rio_parana'
    ),
    'layer7': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:Rios e Córregos de Amambai',
        'EPSG:31981'
    ),
    'layer_aeiu': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AEIU',
        'EPSG:32721'
    ),
    'layer_apc': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AreaExpansaoUrbana',
        'EPSG:32721'
    ),
    'layer_area_protecao_cultural': createLayer(
        'http://187.86.62.26:5433/geoserver/ne/wms',
        'ne:AreaDeProtecaoCultural',
        'EPSG:32721'
    )
};

// Adiciona as camadas na nova ordem correta de sobreposição
[layers['layer7'], layers['layer6'], layers['layer_area_protecao_cultural'], layers['layer5'], layers['layer4'], layers['layer_aeiu'], layers['layer_apc'], layers['layer_aeis2'], layers['layer_aeis1'], layers['layer_aeie'], layers['layer_aeia'], layers['layer3'], layers['layer2'], layers['layer1']].forEach(layer => map.addLayer(layer));

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
    if (!query) {
        alert('Digite um endereço ou número BIC para buscar.');
        return;
    }
    // Se for um número (BIC), busca na camada de lotes urbanos
    if (/^\d{4,}$/.test(query)) { // Exemplo: BIC com 4 ou mais dígitos
        const bicField = 'bic'; // Substitua pelo nome correto do atributo se necessário
        // Garante que a camada de lotes urbanos está visível
        if (layers['layer3']) {
            layers['layer3'].setVisible(true);
            const checkbox = document.getElementById('layer3');
            if (checkbox) checkbox.checked = true;
            atualizarLegendas && atualizarLegendas();
        }
        const wfsUrl = `http://187.86.62.26:5433/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${bicField}='${query}'`;
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
                if (loteSelecionadoLayer) map.removeLayer(loteSelecionadoLayer);
                loteSelecionadoLayer = new ol.layer.Vector({
                    source: new ol.source.Vector({ features: [olFeature] }),
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
                        fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
                    })
                });
                map.addLayer(loteSelecionadoLayer);
                const extent = olFeature.getGeometry().getExtent();
                map.getView().fit(extent, { maxZoom: 18, duration: 800, padding: [60, 60, 60, 60] });
                let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (BIC: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
                for (const key in feature.properties) {
                    html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
                }
                html += '</table></div>';
                setTimeout(() => {
                    let geometry = olFeature.getGeometry();
                    let popupCoord = geometry.getType() === 'Point'
                        ? geometry.getCoordinates()
                        : ol.extent.getCenter(extent);
                    showLotesPopup(popupCoord, html);
                }, 900);
            } else {
                alert('Lote com este número BIC não encontrado.');
            }
        } catch (e) {
            alert('Erro ao buscar lote pelo número BIC.');
        }
        return;
    }
    // Se não for número, tenta buscar pelo endereço na camada de lotes urbanos
    const enderecoField = 'endereco'; // Substitua pelo nome correto do atributo se necessário
    const wfsEnderecoUrl = `http://187.86.62.26:5433/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne:area_urbana&outputFormat=application/json&CQL_FILTER=${enderecoField} ILIKE '%25${encodeURIComponent(query)}%25'`;
    try {
        const response = await fetch(wfsEnderecoUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const format = new ol.format.GeoJSON();
            const olFeature = format.readFeature(feature, {
                dataProjection: 'EPSG:32721',
                featureProjection: map.getView().getProjection()
            });
            if (loteSelecionadoLayer) map.removeLayer(loteSelecionadoLayer);
            loteSelecionadoLayer = new ol.layer.Vector({
                source: new ol.source.Vector({ features: [olFeature] }),
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
                    fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
                })
            });
            map.addLayer(loteSelecionadoLayer);
            if (layers['layer3']) {
                layers['layer3'].setVisible(true);
                const checkbox = document.getElementById('layer3');
                if (checkbox) checkbox.checked = true;
                atualizarLegendas && atualizarLegendas();
            }
            const extent = olFeature.getGeometry().getExtent();
            map.getView().fit(extent, { maxZoom: 18, duration: 800, padding: [60, 60, 60, 60] });
            let html = `<div style='font-size:14px;max-width:320px;'><strong>Lote encontrado (Endereço: ${query})</strong><br><table style='border-collapse:collapse;width:100%'>`;
            for (const key in feature.properties) {
                html += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}</b></td><td style='border:1px solid #ccc;padding:4px 8px;'>${feature.properties[key]}</td></tr>`;
            }
            html += '</table></div>';
            setTimeout(() => {
                let geometry = olFeature.getGeometry();
                let popupCoord = geometry.getType() === 'Point'
                    ? geometry.getCoordinates()
                    : ol.extent.getCenter(extent);
                showLotesPopup(popupCoord, html);
            }, 900);
            return;
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
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
});

const legendasWMS = {
    'layer5': {
        titulo: 'Terras Indígenas',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Aldeias'
    },
    'layer6': {
        titulo: 'Sub-bacias do Rio Paraná',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:bacia_rio_parana'
    },
    'layer4': {
        titulo: 'Zoneamento Urbano',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:ZoneamentoUrbano_PD_novo'
    },
    'layer_aeia': {
        titulo: 'AEIA',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIA'
    },
    'layer_aeie': {
        titulo: 'AEIE',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIE'
    },
    'layer_aeis1': {
        titulo: 'AEIS1',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS1'
    },
    'layer_aeis2': {
        titulo: 'AEIS2',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS2'
    },
    'layer_aeiu': {
        titulo: 'AEIU',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIU'
    },
    'layer_apc': {
        titulo: 'Área de Expansão Urbana',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaExpansaoUrbana'
    },
    'layer_area_protecao_cultural': {
        titulo: 'Área de Proteção Cultural',
        url: 'http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaDeProtecaoCultural'
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
    container.style.display = html ? 'block' : 'none';
}

function toggleExpandBox(selector) {
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
toggleExpandBox('.fullscreen-box');
toggleExpandBox('.print-box');
toggleExpandBox('.layer-controls-box');
document.addEventListener('click', function(e) {
    const selectors = [
        '.measurement-box',
        '.search-box',
        '.fullscreen-box',
        '.print-box',
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
function showLotesPopup(coord, html) {
    if (popupOverlayLotes) {
        map.removeOverlay(popupOverlayLotes);
    }
    const container = document.createElement('div');
    container.style.background = 'rgba(255,255,255,0.97)';
    container.style.padding = '12px 18px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '2px 2px 10px rgba(0,0,0,0.15)';
    container.style.fontSize = '14px';
    container.style.zIndex = 9999;
    container.innerHTML = html;
    popupOverlayLotes = new ol.Overlay({
        element: container,
        positioning: 'top-right', // faz o popup aparecer à direita do ponto
        stopEvent: true,
        offset: [400, 0] // desloca 400px para a direita
    });
    map.addOverlay(popupOverlayLotes);
    popupOverlayLotes.setPosition(coord);
    setTimeout(() => {
        document.addEventListener('mousedown', closeLotesPopupOnClick, { once: true });
    }, 100);
}
function closeLotesPopupOnClick(e) {
    if (popupOverlayLotes && !popupOverlayLotes.getElement().contains(e.target)) {
        map.removeOverlay(popupOverlayLotes);
        popupOverlayLotes = null;
    }
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
    const edificacoesAtivo = edificacoesLayer && edificacoesLayer.getVisible();
    const view = map.getView();
    let html = '';
    let algumResultado = false;
    let loteGeojson = null;
    let loteEncontrado = false;

    async function fetchFeatureInfo(layer, epsg, query, titulo, highlight) {
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
                    for (const key in props) {
                        bloco += `<tr><td style='border:1px solid #ccc;padding:4px 8px;background:#f7f7f7;'><b>${key}<\/b><\/td><td style='border:1px solid #ccc;padding:4px 8px;'>${props[key]}<\/td><\/tr>`;
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
    let htmlLote = '', htmlZoneamento = '', htmlEdif = '';
    if (lotesAtivo) {
        htmlLote = await fetchFeatureInfo(layers['layer3'], 'EPSG:3857', 'ne:area_urbana', 'Atributos do lote:', true);
    }
    if (zoneamentoAtivo) {
        htmlZoneamento = await fetchFeatureInfo(layers['layer4'], 'EPSG:3857', 'ne:ZoneamentoUrbano_PD_novo', 'Atributos do zoneamento:');
    }
    if (edificacoesAtivo) {
        htmlEdif = await fetchFeatureInfo(edificacoesLayer, 'EPSG:3857', 'ne:EdificaçõesDB', 'Atributos da edificação:');
    }

    // Monta HTML combinando resultados (ordem: Lote, Zoneamento, Edificações)
    let blocos = [];
    if (htmlLote) blocos.push(htmlLote);
    if (htmlZoneamento) blocos.push(htmlZoneamento);
    if (htmlEdif) blocos.push(htmlEdif);
    html = blocos.join('<hr>');
    console.log('HTML final do popup:', html);

    // Se encontrou lote, destaca e centraliza, senão mostra popup no clique
    if (loteEncontrado && loteGeojson && loteGeojson.geometry) {
        const format = new ol.format.GeoJSON();
        loteSelecionadoFeature = format.readFeature(loteGeojson, {
            dataProjection: 'EPSG:3857',
            featureProjection: map.getView().getProjection()
        });
        loteSelecionadoLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: [loteSelecionadoFeature] }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#1976d2', width: 4 }),
                fill: new ol.style.Fill({ color: 'rgba(25, 118, 210, 0.15)' })
            })
        });
        map.addLayer(loteSelecionadoLayer);

        // Centraliza o lote selecionado antes de mostrar o popup
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
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.pointerEvents = 'none';
            tempDiv.style.width = '340px';
            tempDiv.style.padding = '12px 18px';
            tempDiv.style.fontSize = '14px';
            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv);
            const popupElementWidth = tempDiv.offsetWidth;
            const popupElementHeight = tempDiv.offsetHeight;
            document.body.removeChild(tempDiv);

            let offsetX = 20;
            let offsetY = -popupElementHeight / 2;
            if (pixel[0] + offsetX + popupElementWidth > mapSize[0]) {
                offsetX = -popupElementWidth - 20;
            }
            if (pixel[1] + offsetY < 60) {
                offsetY = 60 - pixel[1];
            }
            if (pixel[1] + offsetY + popupElementHeight > mapSize[1]) {
                offsetY = mapSize[1] - popupElementHeight - pixel[1] - 10;
            }
            pixel[0] += offsetX;
            pixel[1] += offsetY;
            const popupCoordSmart = map.getCoordinateFromPixel(pixel);
            if (html && algumResultado) {
                showLotesPopup(popupCoordSmart, html);
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
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Pavimentação" alt="Legenda Pavimentação">
  </div>
`;

document.getElementById('layer_pavimentacao').addEventListener('change', function() {
  pavimentacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-pavimentacao')) {
      legendasCategorias.innerHTML += pavimentacaoLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const pavLegend = document.getElementById('legenda-pavimentacao');
    if (pavLegend) pavLegend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Trechos de RDA
const trechosRdaLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Trechos%20de%20RDA" alt="Legenda Trechos de RDA">
  </div>
`;

document.getElementById('layer_trechosrda').addEventListener('change', function() {
  trechosRdaLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-trechosrda')) {
      legendasCategorias.innerHTML += trechosRdaLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const rdaLegend = document.getElementById('legenda-trechosrda');
    if (rdaLegend) rdaLegend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Rede de esgoto
const redeEsgotoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:rede_esgoto_2025_at" alt="Legenda Rede de esgoto">
  </div>
`;

document.getElementById('layer_redeesgoto').addEventListener('change', function() {
  redeEsgotoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-redeesgoto')) {
      legendasCategorias.innerHTML += redeEsgotoLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const esgotoLegend = document.getElementById('legenda-redeesgoto');
    if (esgotoLegend) esgotoLegend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Assistência Social
const assistenciaSocialLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Assistência%20social" alt="Legenda Assistência Social">
  </div>
`;

document.getElementById('layer_assistencia_social').addEventListener('change', function() {
  assistenciaSocialLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-assistencia-social')) {
      legendasCategorias.innerHTML += assistenciaSocialLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-assistencia-social');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Educação
const educacaoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Educação_at" alt="Legenda Educação">
  </div>
`;

document.getElementById('layer_educacao').addEventListener('change', function() {
  educacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-educacao')) {
      legendasCategorias.innerHTML += educacaoLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-educacao');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Prefeitura
const prefeituraLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Prefeitura" alt="Legenda Prefeitura">
  </div>
`;

document.getElementById('layer_prefeitura').addEventListener('change', function() {
  prefeituraLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-prefeitura')) {
      legendasCategorias.innerHTML += prefeituraLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-prefeitura');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Saúde
const saudeLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Saúde_atu" alt="Legenda Saúde">
  </div>
`;

document.getElementById('layer_saude').addEventListener('change', function() {
  saudeLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-saude')) {
      legendasCategorias.innerHTML += saudeLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-saude');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Tipos de vegetação
const tiposVegetacaoLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:veg_dissolvido" alt="Legenda Tipos de vegetação">
  </div>
`;

document.getElementById('layer_tipos_vegetacao').addEventListener('change', function() {
  tiposVegetacaoLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-tipos-vegetacao')) {
      legendasCategorias.innerHTML += tiposVegetacaoLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-tipos-vegetacao');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Imóveis SIGEF
const imoveisSigefLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SIGEF%2005_25" alt="Legenda Imóveis SIGEF">
  </div>
`;

document.getElementById('layer_imoveis_sigef').addEventListener('change', function() {
  imoveisSigefLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-imoveis-sigef')) {
      legendasCategorias.innerHTML += imoveisSigefLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-imoveis-sigef');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Imóveis SNCI
const imoveisSnciLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SNCI%2005_25" alt="Legenda Imóveis SNCI">
  </div>
`;

document.getElementById('layer_imoveis_snci').addEventListener('change', function() {
  imoveisSnciLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-imoveis-snci')) {
      legendasCategorias.innerHTML += imoveisSnciLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-imoveis-snci');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Camada Edificações
const edificacoesLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: 'http://187.86.62.26:5433/geoserver/ne/wms',
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
    <img src="http://187.86.62.26:5433/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:EdificaçõesDB" alt="Legenda Edificações">
  </div>
`;

document.getElementById('layer_edificacoes').addEventListener('change', function() {
  edificacoesLayer.setVisible(this.checked);
  if (this.checked) {
    if (!document.getElementById('legenda-edificacoes')) {
      legendasCategorias.innerHTML += edificacoesLegendHTML;
    }
    legendasCategorias.style.display = 'block';
  } else {
    const legend = document.getElementById('legenda-edificacoes');
    if (legend) legend.remove();
    if (legendasCategorias.innerHTML.trim() === '') {
      legendasCategorias.style.display = 'none';
    }
  }
});

// Expansão dos grupos de camadas
document.querySelectorAll('.theme-toggle').forEach(btn => {
  btn.addEventListener('click', function() {
    const layers = this.nextElementSibling;
    layers.style.display = layers.style.display === 'none' ? 'block' : 'none';
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
