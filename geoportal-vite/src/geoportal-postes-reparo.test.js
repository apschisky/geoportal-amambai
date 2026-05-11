import { describe, expect, it } from 'vitest';
import { buildPosteRepairFormUrl, calculateDistance } from './geoportal-postes-reparo.js';

const FORM_BASE_URL = 'https://docs.google.com/forms/d/e/test-form/viewform?usp=pp_url';
const FORM_FIELDS = {
  identificacaoPoste: 'entry.1055006444',
  coordenadas: 'entry.2043543033'
};

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
