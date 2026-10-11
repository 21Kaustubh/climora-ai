/** Pure geometry/step helpers for client-side, foreground-only GPS guidance.
 * Geometry positions are [longitude,latitude]. No GPS data is stored/sent.
 */
export function isLonLat(value) {
  return Array.isArray(value) && value.length >= 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function haversineKm(a, b) {
  if (!isLonLat(a) || !isLonLat(b)) return NaN;
  const rad = degrees => degrees * Math.PI / 180;
  const deltaLat = rad(b[1] - a[1]);
  const deltaLng = rad(b[0] - a[0]);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(deltaLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

export function buildRouteGeometry(route) {
  const coordinates = route?.geometry?.type === 'LineString' ? route.geometry.coordinates : null;
  const coords = Array.isArray(coordinates) ? coordinates.filter(isLonLat) : [];
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) cumulative.push(cumulative[i - 1] + haversineKm(coords[i - 1], coords[i]));
  return { coords, cumulative, totalKm: cumulative[cumulative.length - 1] || 0 };
}

/** Project GPS point onto the nearest road-geometry segment (not road snapping). */
export function nearestRoutePosition(routeGeometry, gps) {
  const { coords, cumulative } = routeGeometry || {};
  if (!isLonLat(gps) || !Array.isArray(coords) || coords.length < 2) return null;
  const latScale = Math.cos(gps[1] * Math.PI / 180);
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = (a[0] - gps[0]) * latScale, ay = a[1] - gps[1];
    const dx = (b[0] - a[0]) * latScale, dy = b[1] - a[1];
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / denominator)) : 0;
    const projected = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const distanceKm = haversineKm(gps, projected);
    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, travelledKm: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]),
        segmentIndex: i, projected };
    }
  }
  return best;
}

/** Next maneuvers are approximate if provider supplies distances but no step coordinates.
 * Never pretend this is precise lane-level or street-level guidance.
 */
export function approximateNextInstruction(steps, geometry, travelledKm) {
  if (!Array.isArray(steps) || !steps.length) return {
    instruction: 'Detailed turn instructions unavailable — follow map carefully.',
    distanceKm: null, activeIndex: null, approximate: true,
  };
  const totalRoadKm = Math.max(geometry?.totalKm || 0, 0.001);
  const hasIndices = steps.length > 1 && steps.every((s) =>
    Number.isInteger(s?.start_index) && geometry?.cumulative?.[s.start_index] !== undefined);
  let landmarks;
  if (hasIndices) {
    landmarks = steps.map(s => geometry.cumulative[s.start_index]);
  } else {
    // Distance-based approximation, scaled onto provider road geometry.
    const stepKm = steps.map(s => Number.isFinite(Number(s.distance_km)) && Number(s.distance_km) > 0 ? Number(s.distance_km) : 0);
    const sum = stepKm.reduce((a,b) => a + b, 0);
    if (!sum) return {instruction:steps[0].instruction || 'Continue along route',distanceKm:null,activeIndex:0,approximate:true};
    let cumulativeKm = 0;
    landmarks = stepKm.map((distance,i) => {
      if (i === 0) return 0;
      cumulativeKm += stepKm[i - 1];
      return totalRoadKm * cumulativeKm / sum;
    });
  }
  const beyond = landmarks.findIndex((d,i) => i > 0 && d > travelledKm + 0.01);
  if (beyond !== -1) return {
    instruction:steps[beyond].instruction || 'Continue on route',
    distanceKm:Math.max(0, landmarks[beyond] - travelledKm),
    activeIndex:beyond, approximate:!hasIndices,
  };
  const remaining = Math.max(0, totalRoadKm - travelledKm);
  return {instruction:remaining < 0.08 ? 'You are approaching your destination.' : 'Continue towards your destination.',
    distanceKm:remaining, activeIndex:steps.length - 1, approximate:!hasIndices};
}

export function gpsProgress(route, geometry, nearest) {
  const total = geometry?.totalKm || 0;
  const fraction = total > 0 ? Math.min(1, Math.max(0, nearest.travelledKm / total)) : 0;
  return {
    progressPercent: Math.round(fraction * 100),
    remainingKm: Math.max(0, Number(route.distance_km) * (1 - fraction)),
    remainingMinutes: Math.max(0, Number(route.duration_minutes) * (1 - fraction)),
    fraction,
  };
}
