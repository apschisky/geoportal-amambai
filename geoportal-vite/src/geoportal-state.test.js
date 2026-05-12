import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearActivePopupRefreshCoord,
  clearActivePopupSource,
  clearGeoportalStateValue,
  clearNextPopupRefreshCoord,
  clearNextPopupSource,
  getActivePopupRefreshCoord,
  getActivePopupSource,
  getGeoportalStateValue,
  getNextPopupRefreshCoord,
  getNextPopupSource,
  setActivePopupRefreshCoord,
  setActivePopupSource,
  setGeoportalStateValue,
  setNextPopupRefreshCoord,
  setNextPopupSource
} from './geoportal-state.js';

function resetTestState() {
  clearGeoportalStateValue('testKey');
  clearGeoportalStateValue('missingKey');
  clearActivePopupSource();
  clearNextPopupSource();
  clearActivePopupRefreshCoord();
  clearNextPopupRefreshCoord();
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

describe('activePopupRefreshCoord', () => {
  it('inicia limpo', () => {
    expect(getActivePopupRefreshCoord()).toBeNull();
  });

  it('aceita valor e depois limpa', () => {
    const coord = [123, 456];

    expect(setActivePopupRefreshCoord(coord)).toBe(coord);
    expect(getActivePopupRefreshCoord()).toBe(coord);

    clearActivePopupRefreshCoord();

    expect(getActivePopupRefreshCoord()).toBeNull();
  });
});

describe('nextPopupRefreshCoord', () => {
  it('inicia limpo', () => {
    expect(getNextPopupRefreshCoord()).toBeNull();
  });

  it('aceita valor e depois limpa', () => {
    const coord = [789, 101];

    expect(setNextPopupRefreshCoord(coord)).toBe(coord);
    expect(getNextPopupRefreshCoord()).toBe(coord);

    clearNextPopupRefreshCoord();

    expect(getNextPopupRefreshCoord()).toBeNull();
  });
});

describe('popup refresh coord isolation', () => {
  it('activePopupRefreshCoord e nextPopupRefreshCoord nao interferem um no outro', () => {
    const activeCoord = [1, 2];
    const nextCoord = [3, 4];

    setActivePopupRefreshCoord(activeCoord);
    setNextPopupRefreshCoord(nextCoord);

    expect(getActivePopupRefreshCoord()).toBe(activeCoord);
    expect(getNextPopupRefreshCoord()).toBe(nextCoord);

    clearActivePopupRefreshCoord();

    expect(getActivePopupRefreshCoord()).toBeNull();
    expect(getNextPopupRefreshCoord()).toBe(nextCoord);

    clearNextPopupRefreshCoord();

    expect(getActivePopupRefreshCoord()).toBeNull();
    expect(getNextPopupRefreshCoord()).toBeNull();
  });
});
