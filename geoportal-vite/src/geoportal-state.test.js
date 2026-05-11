import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearActivePopupSource,
  clearGeoportalStateValue,
  clearNextPopupSource,
  getActivePopupSource,
  getGeoportalStateValue,
  getNextPopupSource,
  setActivePopupSource,
  setGeoportalStateValue,
  setNextPopupSource
} from './geoportal-state.js';

function resetTestState() {
  clearGeoportalStateValue('testKey');
  clearGeoportalStateValue('missingKey');
  clearActivePopupSource();
  clearNextPopupSource();
}

beforeEach(() => {
  resetTestState();
});

afterEach(() => {
  resetTestState();
});

describe('geoportal state generic helpers', () => {
  it('retorna undefined para chave inexistente', () => {
    expect(getGeoportalStateValue('missingKey')).toBeNull();
    expect(getGeoportalStateValue('neverCreatedKey')).toBeUndefined();
  });

  it('setGeoportalStateValue define valor e retorna o valor definido', () => {
    expect(setGeoportalStateValue('testKey', 'valor')).toBe('valor');
    expect(getGeoportalStateValue('testKey')).toBe('valor');
  });

  it('clearGeoportalStateValue limpa valor para null', () => {
    setGeoportalStateValue('testKey', 'valor');
    clearGeoportalStateValue('testKey');

    expect(getGeoportalStateValue('testKey')).toBeNull();
  });
});

describe('activePopupSource', () => {
  it('inicia limpo', () => {
    expect(getActivePopupSource()).toBeNull();
  });

  it('aceita valor e depois limpa', () => {
    expect(setActivePopupSource('mapclick')).toBe('mapclick');
    expect(getActivePopupSource()).toBe('mapclick');

    clearActivePopupSource();

    expect(getActivePopupSource()).toBeNull();
  });
});

describe('nextPopupSource', () => {
  it('inicia limpo', () => {
    expect(getNextPopupSource()).toBeNull();
  });

  it('aceita valor e depois limpa', () => {
    expect(setNextPopupSource('mapclick')).toBe('mapclick');
    expect(getNextPopupSource()).toBe('mapclick');

    clearNextPopupSource();

    expect(getNextPopupSource()).toBeNull();
  });
});

describe('popup source isolation', () => {
  it('activePopupSource e nextPopupSource nao interferem um no outro', () => {
    setActivePopupSource('active');
    setNextPopupSource('next');

    expect(getActivePopupSource()).toBe('active');
    expect(getNextPopupSource()).toBe('next');

    clearActivePopupSource();

    expect(getActivePopupSource()).toBeNull();
    expect(getNextPopupSource()).toBe('next');

    clearNextPopupSource();

    expect(getActivePopupSource()).toBeNull();
    expect(getNextPopupSource()).toBeNull();
  });
});
