import { afterEach, describe, expect, it } from 'vitest';
import { ILUMINACAO_API_TEST_CONFIG, POSTE_FORM_CONFIG } from './geoportal-config.js';
import { buildPosteRepairFormUrl, calculateDistance, createPostePopupHTML, getIluminacaoConsultaApiUrl } from './geoportal-postes-reparo.js';

const FORM_BASE_URL = 'https://docs.google.com/forms/d/e/test-form/viewform?usp=pp_url';
const FORM_FIELDS = {
  identificacaoPoste: 'entry.1055006444',
  coordenadas: 'entry.2043543033'
};

const originalPosteFormEnabled = POSTE_FORM_CONFIG.enabled;
const originalApiEnabled = ILUMINACAO_API_TEST_CONFIG.enabled;
const originalConsultaEnabled = ILUMINACAO_API_TEST_CONFIG.consultaEnabled;

afterEach(() => {
  POSTE_FORM_CONFIG.enabled = originalPosteFormEnabled;
  ILUMINACAO_API_TEST_CONFIG.enabled = originalApiEnabled;
  ILUMINACAO_API_TEST_CONFIG.consultaEnabled = originalConsultaEnabled;
});

function parseFormUrl(formUrl) {
  const url = new URL(formUrl);
  return {
    url,
    params: url.searchParams
  };
}

describe('buildPosteRepairFormUrl', () => {
  it('preserva a base URL do formulario', () => {
    const { url, params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: 'P-123', coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(url.origin).toBe('https://docs.google.com');
    expect(url.pathname).toBe('/forms/d/e/test-form/viewform');
    expect(params.get('usp')).toBe('pp_url');
  });

  it('inclui identificacao do poste quando preenchida', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: 'P-123', coordenadas: null },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.get(FORM_FIELDS.identificacaoPoste)).toBe('P-123');
  });

  it('omite identificacao vazia', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: '   ', coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.has(FORM_FIELDS.identificacaoPoste)).toBe(false);
  });

  it('omite identificacao null', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: null, coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.has(FORM_FIELDS.identificacaoPoste)).toBe(false);
  });

  it('omite identificacao undefined', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: undefined, coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.has(FORM_FIELDS.identificacaoPoste)).toBe(false);
  });

  it('inclui coordenadas quando presentes', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: null, coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.get(FORM_FIELDS.coordenadas)).toBe('-23.100000, -55.200000');
  });

  it('omite coordenadas quando ausentes', () => {
    const { params } = parseFormUrl(buildPosteRepairFormUrl(
      { identificacaoPoste: 'P-123', coordenadas: '' },
      FORM_BASE_URL,
      FORM_FIELDS
    ));

    expect(params.has(FORM_FIELDS.coordenadas)).toBe(false);
  });

  it('aplica encoding correto com URLSearchParams', () => {
    const formUrl = buildPosteRepairFormUrl(
      { identificacaoPoste: 'Poste 12 & 13', coordenadas: '-23.100000, -55.200000' },
      FORM_BASE_URL,
      FORM_FIELDS
    );
    const { params } = parseFormUrl(formUrl);

    expect(formUrl).toContain('Poste+12+%26+13');
    expect(formUrl).toContain('-23.100000%2C+-55.200000');
    expect(params.get(FORM_FIELDS.identificacaoPoste)).toBe('Poste 12 & 13');
    expect(params.get(FORM_FIELDS.coordenadas)).toBe('-23.100000, -55.200000');
  });
});

describe('calculateDistance', () => {
  it('retorna zero para o mesmo ponto', () => {
    expect(calculateDistance([10, 20], [10, 20])).toBe(0);
  });

  it('calcula distancia horizontal', () => {
    expect(calculateDistance([0, 0], [5, 0])).toBe(5);
  });

  it('calcula distancia vertical', () => {
    expect(calculateDistance([0, 0], [0, 7])).toBe(7);
  });

  it('calcula distancia diagonal 3-4-5', () => {
    expect(calculateDistance([0, 0], [3, 4])).toBe(5);
  });

  it('calcula distancia com coordenadas negativas', () => {
    expect(calculateDistance([-5, -5], [-1, -2])).toBe(5);
  });
});

describe('createPostePopupHTML', () => {
  it('oculta o botao do Google Forms quando a flag estiver desabilitada', () => {
    POSTE_FORM_CONFIG.enabled = false;

    const html = createPostePopupHTML(
      { IDs_coord: 'P-123' },
      [-6123456.12, -2643210.45],
      FORM_BASE_URL,
      FORM_FIELDS
    );

    expect(html).not.toContain('poste-popup-action-repair');
    expect(html).not.toContain('docs.google.com/forms');
  });

  it('exibe o botao do Google Forms quando a flag estiver habilitada', () => {
    POSTE_FORM_CONFIG.enabled = true;

    const html = createPostePopupHTML(
      { IDs_coord: 'P-123' },
      [-6123456.12, -2643210.45],
      FORM_BASE_URL,
      FORM_FIELDS
    );

    expect(html).toContain('poste-popup-action-repair');
    expect(html).toContain('docs.google.com/forms');
  });


  it('remove o texto longo e exibe as acoes iniciais de localizacao e consulta', () => {
    POSTE_FORM_CONFIG.enabled = true;
    ILUMINACAO_API_TEST_CONFIG.enabled = true;
    ILUMINACAO_API_TEST_CONFIG.consultaEnabled = true;

    const html = createPostePopupHTML(
      { IDs_coord: 'P-123' },
      [-6123456.12, -2643210.45],
      FORM_BASE_URL,
      FORM_FIELDS
    );

    expect(html).not.toContain('N?o encontrou o poste correto?');
    expect(html).not.toContain('N??o encontrou o poste correto?');
    expect(html).toContain('LOCALIZA\u00c7\u00c3O');
    expect(html).toContain('data-iluminacao-api-manual-location="true"');
    expect(html).toContain('Selecionar local manualmente');
    expect(html).toContain('J\u00c1 POSSUI UMA SOLICITA\u00c7\u00c3O?');
    expect(html).toContain('data-iluminacao-consulta-open="true"');
    expect(html).toContain('Consultar andamento da solicita\u00e7\u00e3o');
  });
});


describe('getIluminacaoConsultaApiUrl', () => {
  it('usa rota relativa no Vite local para passar pelo proxy', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { location: { hostname: 'localhost' } };

    try {
      expect(getIluminacaoConsultaApiUrl()).toBe('/api/public/iluminacao/consulta');
    } finally {
      globalThis.window = previousWindow;
    }
  });

  it('mantem URL configurada fora do localhost', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { location: { hostname: 'geoportal.amambai.ms.gov.br' } };

    try {
      expect(getIluminacaoConsultaApiUrl()).toBe(ILUMINACAO_API_TEST_CONFIG.consultaApiUrl);
    } finally {
      globalThis.window = previousWindow;
    }
  });
});
