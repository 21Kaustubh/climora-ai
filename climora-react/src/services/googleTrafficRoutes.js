/**
 * Google Maps JavaScript Routes library (current-traffic aware car routes).
 * Coordinates throughout Climora remain GeoJSON [longitude, latitude].
 * This module NEVER overlays a Google ETA onto an unrelated ORS geometry.
 */
import { ensureGoogleMapsLoaded } from '../lib/googleMap.js';

const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
const isPoint = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/** Transform one consistent provider response to Climora's existing route shape. */
export function normalizeTrafficRoutes(googleRoutes, fetchedAt = new Date().toISOString()) {
  if (!Array.isArray(googleRoutes)) throw new Error('Google Routes returned no route array.');
  const routes = googleRoutes.map((route, index) => {
    const path = Array.isArray(route?.path) ? route.path : [];
    const geometry = path.filter(isPoint).map(point => [Number(point.lng), Number(point.lat)]);
    const duration = Number(route?.durationMillis) / 60000;
    const distance = Number(route?.distanceMeters) / 1000;
    if (geometry.length < 2 || !finitePositive(duration) || !finitePositive(distance)) return null;
    const staticMinutes = finitePositive(route.staticDurationMillis)
      ? Number(route.staticDurationMillis) / 60000 : null;
    const steps = (Array.isArray(route.legs) ? route.legs : []).flatMap(leg => Array.isArray(leg.steps) ? leg.steps : []);
    const directions = steps.map(step => ({
      instruction: String(step.instructions || '').replace(/<[^>]*>/g, '').trim(),
      distance_km: Number.isFinite(Number(step.distanceMeters)) ? Number(step.distanceMeters) / 1000 : 0,
    })).filter(step => step.instruction);
    return {
      id: `google-${index}`,
      name: index === 0 ? 'Google traffic-aware route' : `Traffic-aware alternative ${index}`,
      distance_km: distance,
      duration_minutes: duration,
      static_duration_minutes: staticMinutes,
      geometry: { type: 'LineString', coordinates: geometry },
      directions_preview: directions,
      route_preference: index === 0 ? 'default' : 'alternative',
      within_time_limit: true,
      eta_provider: 'google_routes_traffic_aware',
      traffic_aware: true,
      eta_updated_at: fetchedAt,
    };
  }).filter(Boolean);
  if (!routes.length) throw new Error('Google Routes response had no valid road geometry or travel duration.');
  routes.sort((a,b)=> a.duration_minutes-b.duration_minutes || a.distance_km-b.distance_km);
  return routes;
}

export async function requestGoogleTrafficRoutes({ start, end }, signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await ensureGoogleMapsLoaded();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { Route } = await google.maps.importLibrary('routes');
  if (!Route?.computeRoutes) throw new Error('Google Routes library not supported with the current API key.');
  const {routes} = await Route.computeRoutes({
    origin: {lat:start[1], lng:start[0]},
    destination: {lat:end[1], lng:end[0]},
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: true,
    fields: [
      'distanceMeters', 'durationMillis', 'staticDurationMillis',
      'path', 'description', 'routeLabels', 'legs',
    ],
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const fetchedAt = new Date().toISOString();
  const cleaned = normalizeTrafficRoutes(routes, fetchedAt);
  return {
    body: {
      project:'Climora', travel_mode:'car', mode:'real_road_routing', source:'google_maps_routes_js',
      route_quality:{status:'not_reported'},
      time_estimate_note: 'Google Maps traffic-aware prediction at request time; not a guarantee or continuously updating live navigation.',
    },
    routes: cleaned,
    bestId: cleaned[0].id,
    provider: 'Google Maps Routes',
    trafficAware: true,
    etaUpdatedAt: fetchedAt,
  };
}
