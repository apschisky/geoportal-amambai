import { describe, expect, it } from 'vitest';
import {
  buildEnderecoCqlFilter,
  buildRuaCandidatesCqlFilter,
  extractNumeroFromEndereco,
  findClosestAddressFeature,
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

describe('findClosestAddressFeature', () => {
  const featureWithEndereco = endereco => ({ properties: { endereco } });

  it('retorna null quando nao ha features', () => {
    expect(findClosestAddressFeature([], 100)).toBeNull();
  });

  it('retorna null quando targetNumber esta ausente ou invalido', () => {
    const features = [featureWithEndereco('Rua Pedro Manvailer 100')];

    expect(findClosestAddressFeature(features, undefined)).toBeNull();
    expect(findClosestAddressFeature(features, 'abc')).toBeNull();
  });

  it('mantem o comportamento atual de converter targetNumber null para zero', () => {
    const feature100 = featureWithEndereco('Rua Pedro Manvailer 100');

    expect(findClosestAddressFeature([feature100], null)).toMatchObject({
      feature: feature100,
      numero: 100,
      diff: 100,
      maxDiff: 150
    });
  });

  it('encontra o numero mais proximo abaixo do alvo', () => {
    const feature80 = featureWithEndereco('Rua Pedro Manvailer 80');
    const feature90 = featureWithEndereco('Rua Pedro Manvailer 90');

    expect(findClosestAddressFeature([feature80, feature90], 100)).toMatchObject({
      feature: feature90,
      numero: 90,
      diff: 10,
      maxDiff: 150
    });
  });

  it('encontra o numero mais proximo acima do alvo', () => {
    const feature110 = featureWithEndereco('Rua Pedro Manvailer 110');
    const feature130 = featureWithEndereco('Rua Pedro Manvailer 130');

    expect(findClosestAddressFeature([feature130, feature110], 100)).toMatchObject({
      feature: feature110,
      numero: 110,
      diff: 10,
      maxDiff: 150
    });
  });

  it('respeita a diferenca minima de tolerancia', () => {
    const feature240 = featureWithEndereco('Rua Pedro Manvailer 240');

    expect(findClosestAddressFeature([feature240], 100)).toMatchObject({
      feature: feature240,
      numero: 240,
      diff: 140,
      maxDiff: 150
    });
  });

  it('retorna null quando ultrapassa a diferenca minima de tolerancia', () => {
    const feature251 = featureWithEndereco('Rua Pedro Manvailer 251');

    expect(findClosestAddressFeature([feature251], 100)).toBeNull();
  });

  it('respeita a diferenca maxima de tolerancia', () => {
    const feature10200 = featureWithEndereco('Rua Pedro Manvailer 10200');

    expect(findClosestAddressFeature([feature10200], 10000)).toMatchObject({
      feature: feature10200,
      numero: 10200,
      diff: 200,
      maxDiff: 200
    });
  });

  it('retorna null quando ultrapassa a diferenca maxima de tolerancia', () => {
    const feature10201 = featureWithEndereco('Rua Pedro Manvailer 10201');

    expect(findClosestAddressFeature([feature10201], 10000)).toBeNull();
  });

  it('respeita o percentual de tolerancia quando ele fica entre minimo e maximo', () => {
    const feature3675 = featureWithEndereco('Rua Pedro Manvailer 3675');

    expect(findClosestAddressFeature([feature3675], 3500)).toMatchObject({
      feature: feature3675,
      numero: 3675,
      diff: 175,
      maxDiff: 175
    });
  });

  it('retorna null quando ultrapassa o percentual de tolerancia', () => {
    const feature3676 = featureWithEndereco('Rua Pedro Manvailer 3676');

    expect(findClosestAddressFeature([feature3676], 3500)).toBeNull();
  });

  it('desempata pela menor diferenca', () => {
    const feature90 = featureWithEndereco('Rua Pedro Manvailer 90');
    const feature95 = featureWithEndereco('Rua Pedro Manvailer 95');

    expect(findClosestAddressFeature([feature90, feature95], 100)).toMatchObject({
      feature: feature95,
      numero: 95,
      diff: 5
    });
  });

  it('desempata pelo menor numero quando a diferenca e a paridade sao iguais', () => {
    const feature90 = featureWithEndereco('Rua Pedro Manvailer 90');
    const feature110 = featureWithEndereco('Rua Pedro Manvailer 110');

    expect(findClosestAddressFeature([feature110, feature90], 100)).toMatchObject({
      feature: feature90,
      numero: 90,
      diff: 10
    });
  });

  it('ignora features sem numero extraivel', () => {
    const semNumero = featureWithEndereco('Rua Pedro Manvailer');
    const feature120 = featureWithEndereco('Rua Pedro Manvailer 120');

    expect(findClosestAddressFeature([semNumero, {}, feature120], 100)).toMatchObject({
      feature: feature120,
      numero: 120,
      diff: 20
    });
  });

  it('usa o ultimo numero do endereco conforme extractNumeroFromEndereco', () => {
    const feature123 = featureWithEndereco('Quadra 7 Lote 123');

    expect(findClosestAddressFeature([feature123], 120)).toMatchObject({
      feature: feature123,
      numero: 123,
      diff: 3
    });
  });
});
