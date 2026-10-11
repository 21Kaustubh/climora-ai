/*
 * Climora Phase A — hard distance/time caps, followed by conservative AQI-first ranking.
 * Client-side presentation only; never changes OpenRouteService distance or ETA.
 * Averages are modeled US AQI screening, NOT measured road-level air quality.
 */
export const ROUTE_POLICY = Object.freeze({
  maxExtraDistancePct: 15,
  maxExtraTimePct: 15,
  maxExtraMinutes: 10,
  minimumAqiImprovement: 10,
  minimumAqiImprovementPct: 10,
});

const number = value => Number(value);
const safeRoute = route => route && Number.isFinite(number(route.distance_km)) && number(route.distance_km) > 0 &&
  Number.isFinite(number(route.duration_minutes)) && number(route.duration_minutes) > 0 &&
  Array.isArray(route.geometry?.coordinates) && route.geometry.coordinates.length >= 2;

/**
 * Two independent baselines prevent extremely long routes from being labeled "clean".
 * Shortest distance and fastest ETA may come from different provider routes.
 * Rejecting every route is preferable to falsely endorsing a large detour.
 */
export function applyRouteGuardrails(routes, requestedPercent = 15, requestedMinutes = 10, policy = ROUTE_POLICY) {
  const providerValid = (Array.isArray(routes) ? routes : []).filter(safeRoute);
  const candidates = providerValid.filter(r => r.within_time_limit !== false);
  const excludedByProvider = providerValid.filter(r => r.within_time_limit === false);
  if (!candidates.length) return {
    eligible: [], excluded: excludedByProvider.map(route => ({ route, reason: 'Provider time limit' })),
    fastestId: null, shortestDistanceKm: null, maxDistanceKm: null, maxDurationMinutes: null,
    explanation: 'The provider returned no routes within the existing time constraint.',
  };

  // Include provider-rejected but geometrically valid roads in the baselines.
  // Otherwise a 65 km 'fast' road could appear acceptable when the provider
  // rejected a real 30 km road for time alone.
  const shortest = Math.min(...providerValid.map(r => number(r.distance_km)));
  const fastest = Math.min(...providerValid.map(r => number(r.duration_minutes)));
  const timePct = Math.min(policy.maxExtraTimePct, Math.max(0, number(requestedPercent) || 0));
  const extraMinutes = Math.min(policy.maxExtraMinutes, Math.max(0, number(requestedMinutes) || 0));
  const maxDistanceKm = shortest * (1 + policy.maxExtraDistancePct / 100);
  const maxDurationMinutes = fastest + Math.min(fastest * timePct / 100, extraMinutes);
  const eligible = [];
  const excluded = excludedByProvider.map(route => ({ route, reason: 'Provider time limit' }));
  for (const route of candidates) {
    if (number(route.distance_km) > maxDistanceKm + 1e-7) {
      excluded.push({ route, reason: 'Distance detour' });
    } else if (number(route.duration_minutes) > maxDurationMinutes + 1e-7) {
      excluded.push({ route, reason: 'Time detour' });
    } else {
      eligible.push(route);
    }
  }
  eligible.sort((a,b)=>number(a.duration_minutes)-number(b.duration_minutes) || number(a.distance_km)-number(b.distance_km));
  const fastestId = eligible.length ? String(eligible[0].id) : null;
  const explanation = eligible.length
    ? `Routes beyond ${maxDistanceKm.toFixed(1)} km or ${maxDurationMinutes.toFixed(1)} min were excluded before AQI screening.`
    : 'No returned road route meets both the distance and time limits. Choose more precise road pins or retry; Climora will not recommend an extreme detour.';
  return {
    eligible, excluded, fastestId,
    shortestDistanceKm: shortest,
    maxDistanceKm,
    maxDurationMinutes,
    explanation,
  };
}

/** Lower-AQI choice only after forecast comparability checks in routeAir.js. */
export function prioritizeRoutes(eligibleRoutes, fallbackId, airResult) {
  const available = Array.isArray(eligibleRoutes) ? eligibleRoutes : [];
  const valid = new Set(available.map(r=>String(r.id)));
  const proposed = String(airResult?.recommendationId || '');
  const usingAqi = airResult?.status === 'lower-modelled-aqi' && valid.has(proposed);
  const primaryId = usingAqi ? proposed : (valid.has(String(fallbackId)) ? String(fallbackId) : String(available[0]?.id || ''));
  const ordered = [...available].sort((a,b)=>{
    if(String(a.id)===primaryId) return -1;
    if(String(b.id)===primaryId) return 1;
    // Do not pretend minuscule modeled AQI differences rank local streets.
    return number(a.duration_minutes)-number(b.duration_minutes) || number(a.distance_km)-number(b.distance_km);
  });
  return { routes: ordered, primaryId, usingAqi };
}
