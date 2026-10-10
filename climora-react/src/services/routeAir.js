/*
 * Climora Phase 5 — modeled route air-quality screening.
 * No changes to ORS road geometry, distance, ETA or AWS route ranking.
 * Coordinates are [longitude, latitude] (GeoJSON convention).
 * This is a coarse environmental comparison, NOT street-level pollution
 * measurement or an inhaled-dose/medical exposure calculation.
 */

const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MAX_ROUTES = 4;
const BATCH_SIZE = 24;

function validCoordinate(point) {
  return Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const p1 = a[1] * rad, p2 = b[1] * rad;
  const deltaP = (b[1] - a[1]) * rad;
  const deltaL = (b[0] - a[0]) * rad;
  const h = Math.sin(deltaP / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(deltaL / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Evenly spaced by road polyline length. Endpoints get half weight later. */
export function sampleRoute(geometry, count = 5) {
  const points = geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2 || !points.every(validCoordinate)) {
    throw new Error('Route geometry is missing or invalid.');
  }
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + distanceKm(points[i - 1], points[i]));
  }
  const total = cum[cum.length - 1];
  if (total < 0.02) throw new Error('Route is too short to sample air quality.');
  return Array.from({ length: count }, (_, i) => {
    const fraction = i / (count - 1);
    const target = total * fraction;
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (cum[mid] < target) lo = mid + 1; else hi = mid;
    }
    const segment = lo;
    const segmentLength = cum[segment] - cum[segment - 1];
    const weight = segmentLength > 0 ? (target - cum[segment - 1]) / segmentLength : 0;
    const p = points[segment - 1], q = points[segment];
    return {
      fraction,
      coords: [p[0] + (q[0] - p[0]) * weight, p[1] + (q[1] - p[1]) * weight],
    };
  });
}

function sampleCount(route) {
  const length = Number(route.distance_km);
  return length <= 30 ? 5 : length <= 200 ? 7 : 9;
}

function sampleKey(coords) {
  // Coordinate-level deduplication of common endpoints and overlap;
  // never use this rounding as a simulated model resolution.
  return `${coords[1].toFixed(4)},${coords[0].toFixed(4)}`;
}

function sampleAtUTC(data, variable, millis) {
  const times = data?.hourly?.time;
  const values = data?.hourly?.[variable];
  if (!Array.isArray(times) || !Array.isArray(values) || times.length !== values.length || !times.length) {
    return null;
  }
  const timestamp = millis / 1000;
  const first = Number(times[0]), last = Number(times[times.length - 1]);
  // No extrapolating forecasts outside their time range.
  if (!Number.isFinite(first) || !Number.isFinite(last) || timestamp < first || timestamp > last) return null;
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (Number(times[mid]) <= timestamp) lo = mid; else hi = mid - 1;
  }
  if (lo === times.length - 1) return Number.isFinite(values[lo]) ? values[lo] : null;
  const a = Number(times[lo]), b = Number(times[lo + 1]);
  const va = values[lo], vb = values[lo + 1];
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a ||
      !Number.isFinite(va) || !Number.isFinite(vb)) return null;
  const fraction = (timestamp - a) / (b - a);
  return va + (vb - va) * fraction;
}

function cellKey(data) {
  // Open-Meteo reports the chosen model grid cell center, not the input location.
  if (!Number.isFinite(data?.latitude) || !Number.isFinite(data?.longitude)) return null;
  return `${data.latitude.toFixed(3)},${data.longitude.toFixed(3)}`;
}

function occupancyDifference(a, b) {
  const fa = new Map(), fb = new Map();
  for (const key of a) fa.set(key, (fa.get(key) || 0) + 1 / a.length);
  for (const key of b) fb.set(key, (fb.get(key) || 0) + 1 / b.length);
  let tv = 0;
  for (const key of new Set([...fa.keys(), ...fb.keys()])) {
    tv += Math.abs((fa.get(key) || 0) - (fb.get(key) || 0));
  }
  return tv / 2;
}

export async function getRouteAirIntelligence(routes, fastestId, signal, fetcher = fetch, nowMs = Date.now()) {
  if (!Array.isArray(routes) || !routes.length) throw new Error('No road routes to compare.');
  const usableRoutes = routes.slice(0, MAX_ROUTES);
  const plans = usableRoutes.map(route => ({
    route,
    samples: sampleRoute(route.geometry, sampleCount(route)),
  }));

  const allPoints = new Map();
  for (const plan of plans) {
    for (const sample of plan.samples) {
      const key = sampleKey(sample.coords);
      if (!allPoints.has(key)) allPoints.set(key, sample.coords);
      sample.key = key;
    }
  }
  const keys = [...allPoints.keys()];
  const dataByPoint = new Map();
  for (let begin = 0; begin < keys.length; begin += BATCH_SIZE) {
    const chunk = keys.slice(begin, begin + BATCH_SIZE);
    const coords = chunk.map(k => allPoints.get(k));
    const url = new URL(AIR_API);
    url.searchParams.set('latitude', coords.map(p => p[1].toFixed(5)).join(','));
    url.searchParams.set('longitude', coords.map(p => p[0].toFixed(5)).join(','));
    url.searchParams.set('hourly', 'pm2_5,us_aqi');
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('domains', 'cams_global');
    const resp = await fetcher(url.toString(), { signal });
    if (!resp.ok) throw new Error(`Air-quality forecast API unavailable (${resp.status}).`);
    const raw = await resp.json();
    const responses = Array.isArray(raw) ? raw : [raw];
    if (responses.length !== chunk.length) throw new Error('Air-quality provider returned an incomplete location batch.');
    for (let i = 0; i < chunk.length; i++) {
      dataByPoint.set(chunk[i], responses[i]);
    }
  }

  const byRoute = {};
  for (const { route, samples } of plans) {
    let concentrationSum = 0, aqiMax = -Infinity, weightSum = 0;
    const cellKeys = [];
    let validCount = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const result = dataByPoint.get(sample.key);
      const when = nowMs + Number(route.duration_minutes) * 60_000 * sample.fraction;
      const pm = sampleAtUTC(result, 'pm2_5', when);
      const aqi = sampleAtUTC(result, 'us_aqi', when);
      const cell = cellKey(result);
      const weight = i === 0 || i === samples.length - 1 ? 0.5 : 1;
      if (cell) cellKeys.push(cell);
      if (Number.isFinite(pm) && pm >= 0) {
        concentrationSum += pm * weight;
        weightSum += weight;
        validCount++;
      }
      if (Number.isFinite(aqi)) aqiMax = Math.max(aqiMax, aqi);
    }
    if (validCount < samples.length || weightSum <= 0) {
      byRoute[String(route.id)] = { available: false, reason: 'Incomplete air-quality forecast along this route.' };
      continue;
    }
    const avgPm25 = concentrationSum / weightSum;
    // Screening proxy only, assuming uniform time across each route segment.
    const pmTimeProxy = avgPm25 * Number(route.duration_minutes) / 60;
    byRoute[String(route.id)] = {
      available: true,
      avgPm25,
      maxSampledUsAqi: Number.isFinite(aqiMax) ? aqiMax : null,
      pmTimeProxy,
      sampledLocations: samples.length,
      gridCells: [...new Set(cellKeys)].length,
      cellSequence: cellKeys,
    };
  }

  const fastest = usableRoutes.find(r => String(r.id) === String(fastestId)) || usableRoutes[0];
  const fastestScore = byRoute[String(fastest.id)];
  const values = Object.values(byRoute).filter(v => v.available);
  const uniqueCells = new Set(values.flatMap(v => v.cellSequence)).size;
  const allValid = usableRoutes.every(r => byRoute[String(r.id)]?.available);
  let status = 'indistinguishable';
  let recommendationId = null;
  let explanation = 'Modeled air-quality grids cannot reliably distinguish cleaner streets for these routes. Use the fastest valid option for time efficiency.';

  if (!allValid || !fastestScore?.available) {
    status = 'unavailable';
    explanation = 'Air-quality forecast coverage is incomplete. Route distances and navigation still work.';
  } else if (usableRoutes.length === 1) {
    status = 'single';
    explanation = 'Only one road route was returned. Modeled values are informational; no cleaner-route comparison is possible.';
  } else if (uniqueCells < 2) {
    explanation = 'All route samples fall in the same coarse air-quality model cell. A street-level cleaner-route claim would be misleading.';
  } else {
    const base = fastestScore;
    const candidates = usableRoutes.filter(r => r.within_time_limit !== false && String(r.id) !== String(fastest.id))
      .map(r => ({ route: r, air: byRoute[String(r.id)] }))
      .filter(({ air }) => air?.available &&
        // Different sampling of model grid cells is necessary for meaningful differences.
        occupancyDifference(base.cellSequence, air.cellSequence) > 0.2 &&
        air.avgPm25 <= base.avgPm25 * 0.9 &&
        base.avgPm25 - air.avgPm25 >= 3 &&
        air.pmTimeProxy <= base.pmTimeProxy * 0.92)
      .sort((a, b) => a.air.pmTimeProxy - b.air.pmTimeProxy);
    if (candidates.length) {
      status = 'lower-modelled-exposure';
      recommendationId = String(candidates[0].route.id);
      explanation = 'One detour has materially lower modeled PM2.5 and cumulative time–concentration proxy within your allowed extra time. Treat this as coarse regional screening, not street-level proof.';
    } else {
      explanation = 'Modeled differences are not strong enough to justify recommending an alternate road. The fastest route remains the time-efficient choice.';
    }
  }
  // Drop internal grid-cell sequences from the UI-facing result.
  const publicByRoute = {};
  for (const [id, v] of Object.entries(byRoute)) {
    if (!v.available) { publicByRoute[id] = v; continue; }
    const { cellSequence, ...publicData } = v;
    publicByRoute[id] = publicData;
  }
  return {
    status, explanation,
    byRoute: publicByRoute,
    fastestId: String(fastest.id),
    recommendationId,
    modelCells: uniqueCells,
    scoredRoutes: usableRoutes.length,
    totalRoutes: routes.length,
    generatedAt: new Date(nowMs).toISOString(),
  };
}
