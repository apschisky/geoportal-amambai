// Configurações de camadas e legendas do Geoportal
export const LAYER_CONFIG = {
  layer1: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Perímetro de Amambai'
  },
  layer2: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:EixoDeAdensamento',
    crs: 'EPSG:32721'
  },
  layer3: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:area_urbana',
    crs: 'EPSG:3857'
  },
  layer_aeia: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AEIA',
    crs: 'EPSG:3857'
  },
  layer_aeie: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AEIE',
    crs: 'EPSG:3857'
  },
  layer_aeis1: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AEIS1',
    crs: 'EPSG:32721'
  },
  layer_aeis2: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AEIS2',
    crs: 'EPSG:32721'
  },
  layer_macrozoneamento: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Macrozoneamento_web',
    crs: 'EPSG:32721'
  },
  layer4: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:ZoneamentoUrbano_PD_novo',
    crs: 'EPSG:32721'
  },
  layer5: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Aldeias'
  },
  layer6: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:bacia_rio_parana'
  },
  layer7: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Rios e Córregos de Amambai',
    crs: 'EPSG:31981'
  },
  layer_aeiu: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AEIU',
    crs: 'EPSG:32721'
  },
  layer_apc: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AreaExpansaoUrbana',
    crs: 'EPSG:32721'
  },
  layer_area_protecao_cultural: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:AreaDeProtecaoCultural',
    crs: 'EPSG:32721'
  },
  layer_edificacoes: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:EdificacoesDB',
    crs: 'EPSG:3857'
  },
  layer_pavimentacao: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Pavimentação',
    crs: 'EPSG:32721'
  },
  layer_trechosrda: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Trechos de RDA',
    crs: 'EPSG:32721'
  },
  layer_redeesgoto: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:rede_esgoto_2025_at',
    crs: 'EPSG:32721'
  },
  layer_assistencia_social: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Assistência social',
    crs: 'EPSG:32721'
  },
  layer_educacao: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Educação_at',
    crs: 'EPSG:32721'
  },
  layer_prefeitura: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Prefeitura',
    crs: 'EPSG:32721'
  },
  layer_saude: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Saúde_atu',
    crs: 'EPSG:32721'
  },
  layer_tipos_vegetacao: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:veg_dissolvido',
    crs: 'EPSG:32721'
  },
  layer_imoveis_sigef: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Imóveis SIGEF 05_25',
    crs: 'EPSG:32721'
  },
  layer_imoveis_snci: {
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms',
    layerName: 'ne:Imóveis SNCI 05_25',
    crs: 'EPSG:32721'
  }
};

export const LEGEND_CONFIG = {
  layer_macrozoneamento: {
    titulo: 'Macrozoneamento',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Macrozoneamento_web'
  },
  layer5: {
    titulo: 'Terras Indígenas',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Aldeias'
  },
  layer6: {
    titulo: 'Sub-bacias do Rio Paraná',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:bacia_rio_parana'
  },
  layer4: {
    titulo: 'Zoneamento Urbano',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:ZoneamentoUrbano_PD_novo'
  },
  layer_aeia: {
    titulo: 'AEIA',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIA'
  },
  layer_aeie: {
    titulo: 'AEIE',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIE'
  },
  layer_aeis1: {
    titulo: 'AEIS1',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS1'
  },
  layer_aeis2: {
    titulo: 'AEIS2',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIS2'
  },
  layer_aeiu: {
    titulo: 'AEIU',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AEIU'
  },
  layer_apc: {
    titulo: 'Área de Expansão Urbana',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaExpansaoUrbana'
  },
  layer_area_protecao_cultural: {
    titulo: 'Área de Proteção Cultural',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:AreaDeProtecaoCultural'
  },
  layer_edificacoes: {
    titulo: 'Edificações',
  url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:EdificacoesDB'
  },
  layer_pavimentacao: {
    titulo: 'Pavimentação',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Pavimentação'
  },
  layer_trechosrda: {
    titulo: 'Trechos de RDA',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Trechos%20de%20RDA'
  },
  layer_redeesgoto: {
    titulo: 'Rede de esgoto',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:rede_esgoto_2025_at'
  },
  layer_assistencia_social: {
    titulo: 'Assistência Social',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Assistência%20social'
  },
  layer_educacao: {
    titulo: 'Educação',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Educação_at'
  },
  layer_prefeitura: {
    titulo: 'Prefeitura',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Prefeitura'
  },
  layer_saude: {
    titulo: 'Saúde',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Saúde_atu'
  },
  layer_tipos_vegetacao: {
    titulo: 'Tipos de vegetação',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:veg_dissolvido'
  },
  layer_imoveis_sigef: {
    titulo: 'Imóveis SIGEF',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SIGEF%2005_25'
  },
  layer_imoveis_snci: {
    titulo: 'Imóveis SNCI',
    url: 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=ne:Imóveis%20SNCI%2005_25'
  }
};
