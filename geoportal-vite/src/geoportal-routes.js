import { getGeoportalStateValue } from './geoportal-state.js';

function formatMapCoordinateParam(lonLat) {
  if (!Array.isArray(lonLat) || lonLat.length < 2) return null;

  const lon = Number(lonLat[0]);
  const lat = Number(lonLat[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function buildGoogleMapsRouteUrl(
  destinationLonLat,
  originLonLat = getGeoportalStateValue('userLonLat')
) {
  const destination = formatMapCoordinateParam(destinationLonLat);
  if (!destination) return '#';

  const origin = formatMapCoordinateParam(originLonLat);
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
