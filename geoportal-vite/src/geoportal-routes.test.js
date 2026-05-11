import { describe, expect, it } from 'vitest';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';

function getRouteParams(routeUrl) {
  const url = new URL(routeUrl);
  return url.searchParams;
}

describe('buildGoogleMapsRouteUrl', () => {
  it('retorna # para destino invalido', () => {
    expect(buildGoogleMapsRouteUrl('invalid', null)).toBe('#');
  });

  it('retorna # para destino null', () => {
    expect(buildGoogleMapsRouteUrl(null, null)).toBe('#');
  });

  it('retorna # para destino undefined', () => {
    expect(buildGoogleMapsRouteUrl(undefined, null)).toBe('#');
  });

  it('retorna # para destino com coordenadas invalidas', () => {
    expect(buildGoogleMapsRouteUrl(['x', -23.105], null)).toBe('#');
  });

  it('gera URL do Google Maps com destino valido sem origem', () => {
    const routeUrl = buildGoogleMapsRouteUrl([-55.2333333, -23.1055555], null);
    const params = getRouteParams(routeUrl);

    expect(routeUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
    expect(params.get('api')).toBe('1');
    expect(params.get('destination')).toBe('-23.105556,-55.233333');
    expect(params.get('origin')).toBeNull();
    expect(params.get('travelmode')).toBe('driving');
  });

  it('gera URL do Google Maps com origem explicita e destino', () => {
    const routeUrl = buildGoogleMapsRouteUrl(
      [-55.2333333, -23.1055555],
      [-55.200001, -23.100001]
    );
    const params = getRouteParams(routeUrl);

    expect(params.get('origin')).toBe('-23.100001,-55.200001');
    expect(params.get('destination')).toBe('-23.105556,-55.233333');
    expect(params.get('travelmode')).toBe('driving');
  });

  it('formata coordenadas como latitude,longitude com 6 casas decimais', () => {
    const routeUrl = buildGoogleMapsRouteUrl([-55.2, -23.1], null);
    const params = getRouteParams(routeUrl);

    expect(params.get('destination')).toBe('-23.100000,-55.200000');
  });
});
