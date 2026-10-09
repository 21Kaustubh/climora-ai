export const PRESETS = {
  'bandra-juhu': [
    { name: 'Bandra, Mumbai', coords: [72.8347, 19.0544] },
    { name: 'Juhu, Mumbai', coords: [72.8267, 19.1075] },
  ],
  'andheri-powai': [
    { name: 'Andheri East, Mumbai', coords: [72.8697, 19.1136] },
    { name: 'Powai, Mumbai', coords: [72.9052, 19.1176] },
  ],
  'dadar-cst': [
    { name: 'Dadar, Mumbai', coords: [72.8428, 19.0178] },
    { name: 'CSMT, Mumbai', coords: [72.8355, 18.9398] },
  ],
};

export const MODE_META = {
  car: { label: 'Car', emoji: '🚗', notice: 'Car: road distance and modeled driving time. Live traffic and stops excluded.', googleMode: 'driving' },
  bicycle: { label: 'Bicycle', emoji: '🚲', notice: 'Bicycle: cycle-accessible routes and estimated ride times. Road safety must be checked in person.', googleMode: 'bicycling' },
  walking: { label: 'Walking', emoji: '🚶', notice: 'Walking: footpaths and pedestrian-accessible routes with estimated walking time.', googleMode: 'walking' },
  ebike: { label: 'E-bike', emoji: '⚡', notice: 'E-bike: electric-assist cycling route. Not a motorcycle or scooter route.', googleMode: 'bicycling' },
};

export function isCoords(coords) {
  return Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite) &&
    coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90;
}

export function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes >= 60) {
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)} hr ${rounded % 60} min`;
  }
  return `${Math.round(minutes * 10) / 10} min`;
}

export function formatCoords(coords) {
  return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
}

const GOA_CHOICES = [
  { name: 'Panaji, Goa (state capital)', coords: [73.8278, 15.4909] },
  { name: 'Margao, South Goa', coords: [73.9581, 15.2832] },
  { name: 'Calangute, North Goa', coords: [73.762, 15.544] },
  { name: 'Mapusa, North Goa', coords: [73.8089, 15.5915] },
];

export async function searchPlaces(query, signal) {
  const trimmed = String(query).trim();
  if (trimmed.length < 2) throw new Error('Enter at least two characters to search for a place.');
  if (trimmed.toLowerCase() === 'goa') return GOA_CHOICES;
  const qs = new URLSearchParams({ name: trimmed, count: '8', language: 'en', countryCode: 'IN', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${qs}`, { signal });
  if (!response.ok) throw new Error('Location provider unavailable. Try picking a point on the map.');
  const data = await response.json();
  return (data.results || [])
    .filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude))
    .map(p => ({
      name: [...new Set([p.name, p.admin2, p.admin1, p.country].filter(Boolean))].join(', '),
      coords: [Number(p.longitude), Number(p.latitude)],
    }));
}
