import { describe, expect, it } from 'vitest';
import { escapeHtml, getGeoServerErrorMessage } from './geoportal-utils.js';

describe('escapeHtml', () => {
  it('retorna string vazia para null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('retorna string vazia para undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converte numero para string', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('escapa &', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapa <', () => {
    expect(escapeHtml('<tag')).toBe('&lt;tag');
  });

  it('escapa >', () => {
    expect(escapeHtml('tag>')).toBe('tag&gt;');
  });

  it('escapa aspas duplas', () => {
    expect(escapeHtml('"texto"')).toBe('&quot;texto&quot;');
  });

  it('escapa aspas simples', () => {
    expect(escapeHtml("'texto'")).toBe('&#039;texto&#039;');
  });

  it('escapa string combinada com HTML perigoso', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`))
      .toBe('&lt;img src=&quot;x&quot; onerror=&#039;alert(1)&#039;&gt;&amp;');
  });
});

describe('getGeoServerErrorMessage', () => {
  it('retorna mensagem amigavel de timeout', () => {
    expect(getGeoServerErrorMessage(new Error('TIMEOUT')))
      .toBe('A consulta demorou mais que o esperado. Tente novamente.');
  });

  it('retorna mensagem amigavel generica para erro generico', () => {
    expect(getGeoServerErrorMessage(new Error('HTTP 500')))
      .toContain('consultar os dados no momento');
  });

  it('retorna mensagem amigavel generica para erro ausente', () => {
    expect(getGeoServerErrorMessage(null))
      .toContain('consultar os dados no momento');
  });
});
