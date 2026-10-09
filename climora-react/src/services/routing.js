import { MODE_META } from './places.js';

const ENDPOINT = import.meta.env.VITE_CLIMORA_API_URL || 'https://gbxdgy9b09.execute-api.ap-south-1.amazonaws.com/analyze-route';

export function unpackLambdaResponse(raw) {
  if (typeof raw.body === 'string') return JSON.parse(raw.body);
  if (raw.body && typeof raw.body === 'object') return raw.body;
  return raw;
}

export async function requestRoutes({ start, end, travelMode, maxExtraPercent, maxExtraMinutes }, signal) {
  const response = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({
      start, end,
      travel_mode: travelMode,
      max_extra_percent: maxExtraPercent,
      max_extra_minutes: maxExtraMinutes,
      explore_corridors: false,
    }),
  });
  const raw = await response.json();
  const body = unpackLambdaResponse(raw);
  if (!response.ok || (raw.statusCode && Number(raw.statusCode) !== 200)) {
    const extra = body.code === 'ROUTE_QUALITY_FAILED'
      ? ' Climora refused to display an unrealistic detour. Pin exact reachable road points.' : '';
    throw new Error((body.error || 'AWS route request failed') + extra);
  }
  if (body.travel_mode && body.travel_mode !== travelMode) {
    throw new Error('AWS Lambda returned another travel mode. Deploy the latest Python code first.');
  }
  if (body.mode !== 'real_road_routing' || !body.recommended_route) {
    throw new Error('AWS response does not include a real road route.');
  }
  const distinct = new Map();
  for (const r of body.valid_routes || []) distinct.set(String(r.id), { ...r, within_time_limit: true });
  for (const r of body.rejected_routes || []) distinct.set(String(r.id), { ...r, within_time_limit: false });
  const routes = [...distinct.values()].filter(r =>
    r.geometry?.type === 'LineString' && Array.isArray(r.geometry.coordinates) &&
    r.geometry.coordinates.length >= 2 && Number.isFinite(Number(r.distance_km)) &&
    Number.isFinite(Number(r.duration_minutes))
  );
  if (!routes.length) throw new Error('Routing provider returned no valid road geometry.');
  return { body, routes, bestId: String(body.recommended_route.id) };
}

export function googleDirectionsLink(start, end, mode) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${start[1]},${start[0]}`);
  url.searchParams.set('destination', `${end[1]},${end[0]}`);
  url.searchParams.set('travelmode', MODE_META[mode]?.googleMode || 'driving');
  return url.toString();
}
export function nearbySearchLink(kind, destination) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${kind} near ${destination}`);
}
