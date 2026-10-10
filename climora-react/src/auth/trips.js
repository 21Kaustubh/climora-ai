/** Per-account (or guest) local-device itinerary bookmarks.
 *  This is not a cloud database or account-protected storage.
 */
const PREFIX = 'climora.savedTrips.v1.';
const MAX_TRIPS = 30;

export function savedTripsKey(profile) {
  return PREFIX + (profile?.id ? `cognito.${profile.id}` : 'guest');
}

export function readTrips(profile) {
  try {
    const result = JSON.parse(localStorage.getItem(savedTripsKey(profile)) || '[]');
    return Array.isArray(result) ? result.filter(isSavedTrip).slice(0, MAX_TRIPS) : [];
  } catch { return []; }
}

function isSavedTrip(value) {
  return value && typeof value.id === 'string' && typeof value.mode === 'string' &&
    typeof value.start?.name === 'string' && typeof value.end?.name === 'string' &&
    validCoords(value.start.coords) && validCoords(value.end.coords);
}

function validCoords(coords) {
  return Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite) &&
    coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90;
}

export function makeTrip(start, end, mode, route) {
  if (!validCoords(start?.coords) || !validCoords(end?.coords) || !route) throw new Error('Calculate a valid road route before saving.');
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    savedAt: new Date().toISOString(),
    start: { name: start.name, coords: [...start.coords] },
    end: { name: end.name, coords: [...end.coords] },
    mode,
    distanceKm: Number.isFinite(Number(route.distance_km)) ? Number(route.distance_km) : null,
    durationMin: Number.isFinite(Number(route.duration_minutes)) ? Number(route.duration_minutes) : null,
  };
}

export function saveTrip(profile, trip) {
  const saved = readTrips(profile).filter(existing => !(existing.mode === trip.mode &&
    existing.start.name === trip.start.name && existing.end.name === trip.end.name &&
    existing.start.coords.every((n,i) => n === trip.start.coords[i]) &&
    existing.end.coords.every((n,i) => n === trip.end.coords[i])));
  const updated = [trip, ...saved].slice(0, MAX_TRIPS);
  localStorage.setItem(savedTripsKey(profile), JSON.stringify(updated));
  return updated;
}

export function deleteTrip(profile, id) {
  const updated = readTrips(profile).filter(t => t.id !== id);
  localStorage.setItem(savedTripsKey(profile), JSON.stringify(updated));
  return updated;
}
