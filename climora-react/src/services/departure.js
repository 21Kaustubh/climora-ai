/**
 * Climora Smart Departure Advisor
 * Compares departure times for ONE existing AWS/ORS route only.
 * Both provider ETA and geometry remain unchanged; forecast values are modeled.
 * No live traffic prediction, health-risk claims, or street-level certainty.
 * Coordinates follow GeoJSON [longitude, latitude].
 */
import { sampleRoute } from './routeAir.js';

const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const DEPARTURE_OFFSETS_HOURS = Object.freeze([0, 1, 2, 3, 6]);

const finite = v => typeof v === 'number' && Number.isFinite(v);
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** UTC epoch times from Open-Meteo, optionally interpolate sub-hourly travel progress. */
export function hourlyValue(record, key, atMs) {
  const hourly = record?.hourly;
  const times = hourly?.time;
  const values = hourly?.[key];
  if (!Array.isArray(times) || !Array.isArray(values) || times.length !== values.length || !times.length) return null;
  const target = atMs / 1000;
  if (!finite(target) || target < times[0] || target > times[times.length - 1]) return null;
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (Number(times[mid]) <= target) lo = mid;
    else hi = mid - 1;
  }
  const a = values[lo];
  if (!finite(a)) return null;
  if (lo === times.length - 1 || times[lo] === target) return a;
  const b = values[lo + 1];
  const span = times[lo + 1] - times[lo];
  if (!finite(b) || !finite(span) || span <= 0) return null;
  return a + (b - a) * (target - times[lo]) / span;
}

/** Take all real geometry samples, not simply start/end pollution. */
export function routeSamplingPoints(geometry) {
  return sampleRoute(geometry, 5);
}

async function fetchGridRecords(endpoint, variables, samples, signal, fetcher, extra = {}) {
  const url = new URL(endpoint);
  url.searchParams.set('latitude', samples.map(s => s.coords[1].toFixed(5)).join(','));
  url.searchParams.set('longitude', samples.map(s => s.coords[0].toFixed(5)).join(','));
  url.searchParams.set('hourly', variables);
  url.searchParams.set('timezone', 'GMT');
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('forecast_days', '3');
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  const response = await fetcher(url.toString(), { signal });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const result = await response.json();
  const records = Array.isArray(result) ? result : [result];
  if (records.length !== samples.length || records.some(r => !Array.isArray(r?.hourly?.time))) {
    throw new Error('Hourly forecast grid returned incomplete location data.');
  }
  return records;
}

export function calculateDepartureSlots(route, samples, airRecords, weatherRecords, nowMs, offsets = DEPARTURE_OFFSETS_HOURS) {
  const durationMinutes = Number(route?.duration_minutes);
  if (!(durationMinutes > 0) || !Number.isFinite(durationMinutes)) throw new Error('Route duration is invalid.');
  return offsets.map(offsetHours => {
    const departureMs = nowMs + offsetHours * 3_600_000;
    const etaMs = departureMs + durationMinutes * 60_000;
    const pm = [], aqi = [], rain = [], temperatures = [], wind = [];
    for (let i = 0; i < samples.length; i++) {
      const atMs = departureMs + samples[i].fraction * durationMinutes * 60_000;
      if (airRecords) {
        const p = hourlyValue(airRecords[i], 'pm2_5', atMs);
        const a = hourlyValue(airRecords[i], 'us_aqi', atMs);
        if (finite(p) && p >= 0) pm.push(p);
        if (finite(a) && a >= 0) aqi.push(a);
      }
      if (weatherRecords) {
        const r = hourlyValue(weatherRecords[i], 'precipitation', atMs);
        const t = hourlyValue(weatherRecords[i], 'temperature_2m', atMs);
        const w = hourlyValue(weatherRecords[i], 'wind_speed_10m', atMs);
        if (finite(r) && r >= 0) rain.push(r);
        if (finite(t)) temperatures.push(t);
        if (finite(w) && w >= 0) wind.push(w);
      }
    }
    const airComplete = Boolean(airRecords) && pm.length === samples.length;
    const weatherComplete = Boolean(weatherRecords) && rain.length === samples.length && temperatures.length === samples.length;
    const avgPm25 = airComplete ? mean(pm) : null;
    return {
      offsetHours,
      departureMs,
      arrivalMs: etaMs,
      durationMinutes,
      availableAir: airComplete,
      availableWeather: weatherComplete,
      avgPm25,
      maxUsAqi: airComplete && aqi.length === samples.length ? Math.max(...aqi) : null,
      pmTimeProxy: airComplete ? avgPm25 * durationMinutes / 60 : null,
      peakRainMmPerHour: weatherComplete ? Math.max(...rain) : null,
      avgTemperatureC: weatherComplete ? mean(temperatures) : null,
      peakWindKmH: weatherComplete && wind.length === samples.length ? Math.max(...wind) : null,
    };
  });
}

/** Deliberately conservative. Recommendations require BOTH complete air and weather. */
export function chooseDeparture(slots) {
  const now = slots.find(s => s.offsetHours === 0);
  const candidates = slots.filter(s => s.offsetHours > 0);
  if (!now?.availableAir || !now?.availableWeather) {
    return { status: 'insufficient', offsetHours: null,
      explanation: 'Complete modeled air and weather forecasts are needed before suggesting a time. Route navigation is unchanged.' };
  }
  const complete = candidates.filter(s => s.availableAir && s.availableWeather);
  if (!complete.length) {
    return { status: 'insufficient', offsetHours: null,
      explanation: 'Later-hour forecasts are incomplete. A dependable departure comparison is not available.' };
  }
  const lowerAir = complete.filter(s =>
    now.avgPm25 - s.avgPm25 >= 3 && s.avgPm25 <= now.avgPm25 * 0.85 &&
    s.peakRainMmPerHour <= now.peakRainMmPerHour + 0.5
  ).sort((a,b) => a.offsetHours - b.offsetHours || a.pmTimeProxy - b.pmTimeProxy);
  if (lowerAir.length) {
    return {status:'lower-modeled-pm',offsetHours:lowerAir[0].offsetHours,
      explanation:'A later departure has substantially lower forecast PM2.5 along this same route without a meaningful increase in forecast rain. This is a coarse modeled comparison, not a street-level or health guarantee.'};
  }
  const drier = complete.filter(s =>
    now.peakRainMmPerHour >= 2 && now.peakRainMmPerHour - s.peakRainMmPerHour >= 1.5 &&
    s.peakRainMmPerHour <= 1 && s.avgPm25 <= now.avgPm25 * 1.1
  ).sort((a,b)=>a.offsetHours-b.offsetHours||a.peakRainMmPerHour-b.peakRainMmPerHour);
  if (drier.length) {
    return {status:'potentially-drier',offsetHours:drier[0].offsetHours,
      explanation:'A later departure may avoid an interval of heavier forecast rain without a large increase in modeled PM2.5. Actual conditions can differ.'};
  }
  return {status:'no-clear-benefit',offsetHours:null,
    explanation:'No later option shows a large enough modeled air-quality or rain improvement to recommend waiting. Leaving now remains reasonable based on these limited forecasts.'};
}

/** Air/weather requests fail independently so one bad API won't break route planning. */
export async function getSmartDepartureForecast(route, signal, fetcher = fetch, nowMs = Date.now()) {
  const samples = routeSamplingPoints(route?.geometry);
  const [airResult, weatherResult] = await Promise.allSettled([
    fetchGridRecords(AIR_URL, 'pm2_5,us_aqi', samples, signal, fetcher, {domains:'cams_global'}),
    fetchGridRecords(WEATHER_URL, 'precipitation,temperature_2m,wind_speed_10m', samples, signal, fetcher),
  ]);
  if (signal?.aborted) {
    const error = new Error('Forecast cancelled');
    error.name = 'AbortError';
    throw error;
  }
  if (airResult.status === 'rejected' && weatherResult.status === 'rejected') {
    throw new Error('Both hourly air and weather forecast services are unavailable. Try again later.');
  }
  const airRecords = airResult.status === 'fulfilled' ? airResult.value : null;
  const weatherRecords = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const slots = calculateDepartureSlots(route, samples, airRecords, weatherRecords, nowMs);
  return {
    generatedAt: new Date(nowMs).toISOString(),
    routeId: String(route.id),
    slots,
    decision: chooseDeparture(slots),
    dataStatus: { air: airRecords ? 'available' : 'unavailable', weather: weatherRecords ? 'available' : 'unavailable' },
    sampledPoints: samples.length,
    modelNote: 'Weather and PM2.5 forecasts are modeled grid values; different nearby streets can share identical air forecasts. ETA is based on the original route duration and does not predict future traffic.',
  };
}
