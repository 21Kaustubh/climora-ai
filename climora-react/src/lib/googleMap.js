/* Google Maps presentation adapter. All route coordinates remain original [longitude, latitude].
 * Roads, travel times, route validation, and environmental data are NOT recalculated here.
 */
const COLORS = ['#36dea2', '#a990fa', '#f2ad57', '#5db8fa', '#ff819d'];
let googleLoaderPromise = null;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleLoaderPromise) return googleLoaderPromise;
  googleLoaderPromise = new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    const callbackName = '__climoraReactGoogleMapsReady';
    const finish = error => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    timer = window.setTimeout(() => finish(new Error('Google Maps timed out. Check network and API restrictions.')), 20000);
    window[callbackName] = () => finish(null);
    window.gm_authFailure = () => finish(new Error('Google Maps authorization failed. Check allowed HTTP referrers and billing.'));
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
      key: apiKey, v: 'weekly', loading: 'async', callback: callbackName,
    });
    script.onerror = () => finish(new Error('Google Maps script could not load.'));
    document.head.appendChild(script);
  });
  return googleLoaderPromise;
}

function validPoint(c) {
  return Array.isArray(c) && c.length === 2 && c.every(Number.isFinite) &&
    Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
const toLatLng = c => ({ lat: c[1], lng: c[0] });
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export function createGoogleMapController({ host, onStatus, onError, onSelect, onPick }) {
  let map;
  let markerLibrary;
  let start = [72.8347, 19.0544];
  let end = [72.8267, 19.1075];
  let startMarker, endMarker, gpsMarker, gpsCircle, trafficLayer;
  let selectionMode = null;
  let selectedId = null;
  let trafficOn = false;
  let satelliteOn = false;
  let destroyed = false;
  let models = [];
  let routes = new Map();
  let cancellers = new Set();
  let pending = null;
  let callbackFns = {onStatus, onError, onSelect, onPick};

  const report = message => callbackFns.onStatus?.(message);
  const clearAnimations = () => { for (const fn of cancellers) fn(); cancellers.clear(); };
  const colorFor = id => {
    const idx = models.findIndex(item => String(item.id) === String(id));
    return COLORS[(idx < 0 ? 0 : idx) % COLORS.length];
  };
  function createMarker(coords, title, color) {
    const pin = new markerLibrary.PinElement({background: color, borderColor: '#f4fbff', glyphColor: '#10202a', scale: 1.16});
    return new markerLibrary.AdvancedMarkerElement({map, position: toLatLng(coords), title, content: pin.element});
  }
  function endpoints() {
    if (!map || !markerLibrary) return;
    if (startMarker) startMarker.map = null;
    if (endMarker) endMarker.map = null;
    if (validPoint(start)) startMarker = createMarker(start, 'Journey start', COLORS[0]);
    if (validPoint(end)) endMarker = createMarker(end, 'Destination', '#f2af55');
  }
  function getPath(route) {
    if (route?.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) return null;
    const clean = route.geometry.coordinates.filter(validPoint);
    return clean.length > 1 ? clean.map(toLatLng) : null;
  }
  function lineStyle(item) {
    item.polyline.setOptions({
      strokeColor: item.color, strokeOpacity: item.id === selectedId ? 1 : 0.9,
      strokeWeight: item.id === selectedId ? 9 : item.id === 'A' ? 8 : 6,
      zIndex: item.id === selectedId ? 100 : item.id === 'A' ? 30 : 10,
    });
  }
  function animatePath(item, index) {
    if (prefersReducedMotion() || item.path.length < 4) return;
    const full = item.path;
    let active = true;
    let rafId;
    let startAt;
    item.polyline.setPath(full.slice(0, 2));
    const duration = 1100 + Math.min(index, 4) * 145;
    const step = now => {
      if (!active || destroyed) return;
      if (startAt === undefined) startAt = now + index * 65;
      const t = Math.max(0, Math.min(1, (now - startAt) / duration));
      const count = Math.max(2, Math.floor((1 - (1 - t) ** 3) * full.length));
      item.polyline.setPath(full.slice(0, count));
      if (t < 1) rafId = requestAnimationFrame(step);
      else { item.polyline.setPath(full); cancellers.delete(cancel); }
    };
    const cancel = () => {
      active = false;
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      item.polyline.setPath(full);
    };
    cancellers.add(cancel);
    rafId = requestAnimationFrame(step);
  }
  function clearRoutes() {
    pending = null;
    clearAnimations();
    for (const r of routes.values()) { r.polyline.setMap(null); }
    routes = new Map(); models = []; selectedId = null;
    report(map ? 'Choose locations and calculate routes' : 'Waiting for Google Maps…');
  }
  function setPoints(a, b) {
    if (validPoint(a)) start = [...a];
    if (validPoint(b)) end = [...b];
    if (!map) return;
    endpoints();
    if (!routes.size) fitMap();
  }
  function drawRoutes(items, bestId) {
    if (!map) { pending = {items, bestId}; models = items; return; }
    clearRoutes();
    models = items.filter(r => getPath(r));
    models.forEach((route, index) => {
      const id = String(route.id);
      const color = COLORS[index % COLORS.length];
      const path = getPath(route);
      const polyline = new google.maps.Polyline({ map, path, clickable: true, geodesic: false });
      const item = {id, color, path, polyline};
      routes.set(id, item);
      lineStyle(item);
      polyline.addListener('click', () => selectRoute(id));
      polyline.addListener('mouseover', () => polyline.setOptions({strokeOpacity: 1, strokeWeight: 11}));
      polyline.addListener('mouseout', () => lineStyle(item));
      animatePath(item, index);
    });
    report(`${routes.size} real road route(s) displayed on Google Maps`);
    fitMap();
  }
  function selectRoute(id) {
    const key = String(id);
    if (!routes.has(key)) return;
    clearAnimations(); selectedId = key;
    routes.forEach((item, routeId) => {
      item.polyline.setMap(routeId === key ? map : null);
      lineStyle(item);
    });
    fitMap();
    callbackFns.onSelect?.(key);
  }
  function showAllRoutes() {
    if (!map) return;
    clearAnimations(); selectedId = null;
    for (const item of routes.values()) {item.polyline.setMap(map); lineStyle(item);}
    report(routes.size ? 'Comparing all road routes' : 'No routes calculated');
    fitMap(); callbackFns.onSelect?.(null);
  }
  function fitMap() {
    if (!map || !window.google?.maps) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    for (const item of routes.values()) {
      if (selectedId && item.id !== selectedId) continue;
      for (const point of item.path) { bounds.extend(point); count++; }
    }
    if (validPoint(start)) {bounds.extend(toLatLng(start)); count++;}
    if (validPoint(end)) {bounds.extend(toLatLng(end)); count++;}
    if (!count) return;
    map.fitBounds(bounds, 54);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if (!destroyed && map?.getZoom() > 15) map.setZoom(15);
    });
  }
  function enablePointPicking(mode) {
    selectionMode = mode === 'start' || mode === 'end' ? mode : null;
    report(selectionMode ? `Click Google Maps to choose ${selectionMode.toUpperCase()}` : 'Map selection disabled');
  }
  function updateUserLocation(coords, accuracyMeters, follow = true) {
    if (!map || !validPoint(coords)) return;
    const position = toLatLng(coords);
    if (!gpsMarker) {
      const content = document.createElement('div');
      content.className = 'climora-gps-marker';
      content.innerHTML = '<span class="gps-pulse-ring gps-pulse-one"></span><span class="gps-pulse-ring gps-pulse-two"></span><span class="gps-pulse-core"></span>';
      gpsMarker = new markerLibrary.AdvancedMarkerElement({map, position, title: 'My GPS location', content});
    } else gpsMarker.position = position;
    const radius = Number.isFinite(accuracyMeters) ? Math.max(1, Math.min(accuracyMeters, 1500)) : 50;
    if (!gpsCircle) {
      gpsCircle = new google.maps.Circle({map, center: position, radius, strokeColor:'#288aff',strokeOpacity: .5,strokeWeight:1,fillColor:'#288aff',fillOpacity:.1,clickable:false});
    } else gpsCircle.setOptions({center:position,radius});
    if (follow) map.panTo(position);
  }
  function toggleSatellite() {
    if (!map) return false;
    satelliteOn = !satelliteOn;
    map.setMapTypeId(satelliteOn ? 'hybrid' : 'roadmap');
    return satelliteOn;
  }
  function toggleTraffic() {
    if (!map) return false;
    if (!trafficLayer) trafficLayer = new google.maps.TrafficLayer();
    trafficOn = !trafficOn;
    trafficLayer.setMap(trafficOn ? map : null);
    report(trafficOn ? 'Google traffic overlay (visual only: ETA still from AWS)' : 'Traffic overlay hidden');
    return trafficOn;
  }
  async function init(apiKey, mapId = 'DEMO_MAP_ID') {
    if (!apiKey || apiKey.startsWith('PASTE_')) {
      const err = new Error('Google Maps key missing. Add VITE_GOOGLE_MAPS_API_KEY to .env.local and restart Vite.');
      callbackFns.onError?.(err.message);
      throw err;
    }
    try {
      report('Loading Google Maps…');
      await loadGoogleMaps(apiKey);
      const [{Map}, marker] = await Promise.all([
        google.maps.importLibrary('maps'), google.maps.importLibrary('marker'),
      ]);
      if (destroyed) return;
      markerLibrary = marker;
      map = new Map(host, {
        center: {lat:19.08,lng:72.84}, zoom:12, mapId, mapTypeId:'roadmap',
        zoomControl:true, mapTypeControl:false, fullscreenControl:true,
        streetViewControl:true, scaleControl:true, clickableIcons:false,
        gestureHandling:'greedy',
      });
      map.addListener('click', ev => {
        if (!selectionMode || !ev.latLng) return;
        const mode = selectionMode; selectionMode = null;
        const coords = [Number(ev.latLng.lng().toFixed(6)), Number(ev.latLng.lat().toFixed(6))];
        callbackFns.onPick?.(mode, coords);
        report('Point selected. Calculate routes.');
      });
      endpoints(); fitMap();
      if (pending) {const p = pending; pending = null; drawRoutes(p.items,p.bestId);}
      report('Google Maps ready · Routing powered by AWS/OpenRouteService');
    } catch (error) {
      if (!destroyed) callbackFns.onError?.(error.message || String(error));
      throw error;
    }
  }
  function destroy() {
    destroyed = true; callbackFns = {}; clearRoutes();
    if (startMarker) startMarker.map = null;
    if (endMarker) endMarker.map = null;
    if (gpsMarker) gpsMarker.map = null;
    if (gpsCircle) gpsCircle.setMap(null);
    if (trafficLayer) trafficLayer.setMap(null);
    if (map) google.maps.event.clearInstanceListeners(map);
    map = null;
  }
  return {
    init, destroy, clearRoutes, setPoints, drawRoutes, selectRoute, showAllRoutes,
    fitMap, enablePointPicking, updateUserLocation, toggleSatellite, toggleTraffic,
    getRouteColor:colorFor,
    updateCallbacks(next) { callbackFns = {...callbackFns, ...next}; },
  };
}
