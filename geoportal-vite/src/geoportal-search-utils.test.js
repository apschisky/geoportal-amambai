import { describe, expect, it } from 'vitest';
import {
  buildEnderecoCqlFilter,
  buildRuaCandidatesCqlFilter,
  extractNumeroFromEndereco,
  parseEnderecoQuery
} from './geoportal-search-utils.js';

describe('parseEnderecoQuery', () => {
  it('processa entrada vazia', () => {
    expect(parseEnderecoQuery('')).toEqual({
      streetTokens: [],
      streetText: '',
      targetNumber: null,
      hasNumber: false
    });
  });

  it('processa endereco com rua e numero', () => {
    expect(parseEnderecoQuery('Pedro Manvailer 9999')).toEqual({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: 'Pedro Manvailer',
      targetNumber: 9999,
      hasNumber: true
    });
  });

  it('remove prefixo Rua', () => {
    expect(parseEnderecoQuery('Rua Pedro Manvailer 9999').streetText)
      .toBe('Pedro Manvailer');
  });

  it('processa endereco com virgula', () => {
    expect(parseEnderecoQuery('Pedro Manvailer, 9999')).toEqual({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: 'Pedro Manvailer',
      targetNumber: 9999,
      hasNumber: true
    });
  });

  it('processa endereco com numero indicado por n', () => {
    expect(parseEnderecoQuery('Rua Pedro Manvailer n 9999')).toEqual({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: 'Pedro Manvailer',
      targetNumber: 9999,
      hasNumber: true
    });
  });

  it('processa endereco com numero indicado por numero ordinal', () => {
    expect(parseEnderecoQuery('Rua Pedro Manvailer nº 9999')).toEqual({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: 'Pedro Manvailer',
      targetNumber: 9999,
      hasNumber: true
    });
  });

  it('usa o ultimo numero quando houver numero antes e depois', () => {
    expect(parseEnderecoQuery('7 de Setembro 123')).toEqual({
      streetTokens: ['Setembro'],
      streetText: 'Setembro',
      targetNumber: 123,
      hasNumber: true
    });
  });

  it('preserva tokens de rua conforme a logica atual', () => {
    expect(parseEnderecoQuery('Avenida da Republica Pedro II 45')).toEqual({
      streetTokens: ['Republica', 'Pedro'],
      streetText: 'Republica Pedro',
      targetNumber: 45,
      hasNumber: true
    });
  });
});

describe('buildRuaCandidatesCqlFilter', () => {
  it('retorna vazio quando nao ha tokens', () => {
    expect(buildRuaCandidatesCqlFilter({ streetTokens: [], streetText: '' })).toBe('');
  });

  it('monta filtro com ILIKE', () => {
    expect(buildRuaCandidatesCqlFilter({
      streetTokens: ['Pedro'],
      streetText: 'Pedro'
    })).toBe("(endereco ILIKE '%Pedro%' OR (endereco ILIKE '%Pedro%'))");
  });

  it('combina tokens corretamente', () => {
    expect(buildRuaCandidatesCqlFilter({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: 'Pedro Manvailer'
    })).toBe("(endereco ILIKE '%Pedro Manvailer%' OR (endereco ILIKE '%Pedro%' AND endereco ILIKE '%Manvailer%'))");
  });

  it('escapa aspas simples', () => {
    expect(buildRuaCandidatesCqlFilter({
      streetTokens: ["D'Avila"],
      streetText: "D'Avila"
    })).toBe("(endereco ILIKE '%D''Avila%' OR (endereco ILIKE '%D''Avila%'))");
  });

  it('retorna tokenFilter quando streetText esta vazio', () => {
    expect(buildRuaCandidatesCqlFilter({
      streetTokens: ['Pedro', 'Manvailer'],
      streetText: ''
    })).toBe("endereco ILIKE '%Pedro%' AND endereco ILIKE '%Manvailer%'");
  });
});

describe('buildEnderecoCqlFilter', () => {
  it('compoe parse e filtro para consulta com rua e numero', () => {
    expect(buildEnderecoCqlFilter('Rua Pedro Manvailer, 9999'))
      .toBe("(endereco ILIKE '%Pedro Manvailer%' OR (endereco ILIKE '%Pedro%' AND endereco ILIKE '%Manvailer%'))");
  });

  it('mantem comportamento para entrada parcial', () => {
    expect(buildEnderecoCqlFilter('Pedro'))
      .toBe("(endereco ILIKE '%Pedro%' OR (endereco ILIKE '%Pedro%'))");
  });

  it('retorna vazio quando nao ha token pesquisavel', () => {
    expect(buildEnderecoCqlFilter('12')).toBe('');
  });
});

describe('extractNumeroFromEndereco', () => {
  it('extrai numero simples', () => {
    expect(extractNumeroFromEndereco('Pedro Manvailer 123')).toBe(123);
  });

  it('extrai o ultimo numero quando houver mais de um', () => {
    expect(extractNumeroFromEndereco('7 de Setembro 123')).toBe(123);
  });

  it('retorna null quando nao houver numero', () => {
    expect(extractNumeroFromEndereco('Pedro Manvailer')).toBeNull();
  });

  it('retorna null para valor ausente', () => {
    expect(extractNumeroFromEndereco(null)).toBeNull();
  });
});
