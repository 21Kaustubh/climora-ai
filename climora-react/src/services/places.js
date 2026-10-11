import { ensureGoogleMapsLoaded } from '../lib/googleMap.js';

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
  car: {label:'Car', emoji:'🚗', notice:'Car: Google traffic-aware road routes and predicted ETA when available; AWS road estimates are fallback. Stops excluded.',googleMode:'driving'},
  bicycle: {label:'Bicycle', emoji:'🚲', notice:'Bicycle: estimated cycling route from AWS/OpenRouteService. Not a live traffic ETA.',googleMode:'bicycling'},
  walking: {label:'Walking', emoji:'🚶', notice:'Walking: estimated footpaths and pedestrian routes, not live traffic.',googleMode:'walking'},
  ebike: {label:'E-bike', emoji:'⚡', notice:'E-bike: assisted-cycling route estimate, not a motorcycle or current-traffic ETA.',googleMode:'bicycling'},
};

export function isCoords(coords) {
  return Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite) &&
    coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90;
}
export function formatMinutes(value) {
  const minutes=Number(value);
  if(!Number.isFinite(minutes))return '—';
  if(minutes>=60){const total=Math.round(minutes);return `${Math.floor(total/60)} hr ${total%60} min`;}
  return `${Math.round(minutes*10)/10} min`;
}
export function formatCoords(coords) {return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;}

const sessions = new Map();

/** Search individual buildings, landmarks, businesses, roads and neighborhoods.
 * Suggestions do NOT contain verified coordinates until a user selects a Place.
 * Their Google session token is kept on the prediction for correct billing.
 */
export async function searchPlaces(query, signal, field='start') {
  const trimmed=String(query||'').trim();
  if(trimmed.length<3)throw new Error('Type at least 3 characters for an area, building or landmark.');
  try {
    await ensureGoogleMapsLoaded();
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const {AutocompleteSessionToken,AutocompleteSuggestion}=await google.maps.importLibrary('places');
  let session=sessions.get(field);
  if(!session){session=new AutocompleteSessionToken();sessions.set(field,session);}
  const {suggestions}=await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input:trimmed,
    includedRegionCodes:['in'],
    language:'en',
    region:'in',
    sessionToken:session,
  });
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    return (suggestions||[]).filter(s=>s.placePrediction).slice(0,8).map(s=>({
      name:s.placePrediction.text?.toString()||'Google Place',
      placePrediction:s.placePrediction,
      coords:null,
      source:'google_places_new',
    }));
  } catch(err) {
    if(signal?.aborted || err?.name==='AbortError')throw err;
    // Preserve original city/town search if the user's Google Cloud project has
    // not yet enabled Places API (New). This fallback cannot find buildings.
    console.warn('Places API (New) unavailable; city/town geocoder fallback used:',err);
    const qs=new URLSearchParams({name:trimmed,count:'8',language:'en',countryCode:'IN',format:'json'});
    const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?${qs}`,{signal});
    if(!response.ok)throw new Error('Google Places is not enabled and the city fallback is unavailable. Enable Places API (New).');
    const data=await response.json();
    return (data.results||[]).filter(p=>Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)).map(p=>({
      name:[...new Set([p.name,p.admin2,p.admin1,p.country].filter(Boolean))].join(', '),
      coords:[p.longitude,p.latitude],source:'town_fallback',
    }));
  }
}

/** Fetch only what our route planner needs, on deliberate user selection. */
export async function resolvePlaceSuggestion(suggestion,field='start') {
  if(isCoords(suggestion?.coords)) return suggestion;
  if(!suggestion?.placePrediction)throw new Error('Choose one of the suggested Google places.');
  const place=suggestion.placePrediction.toPlace();
  await place.fetchFields({fields:['displayName','formattedAddress','location']});
  const lat=Number(typeof place.location?.lat==='function'?place.location.lat():place.location?.lat);
  const lng=Number(typeof place.location?.lng==='function'?place.location.lng():place.location?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('No location coordinates for this place. Pick its entrance on the map.');
  sessions.delete(field);
  return {
    name:[place.displayName,place.formattedAddress].filter(Boolean).join(' · ') || suggestion.name,
    coords:[lng,lat],
    placeId:place.id || null,
    source:'google_places_new',
  };
}
