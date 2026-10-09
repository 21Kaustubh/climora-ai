/* Climora GPS mode-aware navigation assistant.
   This is an active-browser GPS helper, NOT turn-by-turn production-grade vehicle navigation.
   Shows actual device speed only if browser supplies it; no false speed limits or live traffic.
*/
const ClimoraNavigation = (() => {
  let route = null;
  let coordinates = [];
  let cumulative = [];
  let trackingId = null;
  let position = null;
  let lastTurnIndex = null;

  const el = id => document.getElementById(id);
  const km = (a, b) => {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b[1] - a[1]);
    const dLon = rad(b[0] - a[0]);
    const h = Math.sin(dLat/2)**2 +
      Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLon/2)**2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.max(0,h))));
  };
  const minutesText = value => {
    const mins = Math.max(0, Math.round(value));
    return mins >= 60 ? `${Math.floor(mins/60)} hr ${mins % 60} min` : `${mins} min`;
  };
  const htmlSafe = v => String(v || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

  function init() {
    el('startGpsBtn').addEventListener('click', start);
    el('stopGpsBtn').addEventListener('click', stop);
    el('rerouteBtn').addEventListener('click', reroute);
  }
  function stop() {
    if (trackingId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(trackingId);
    }
    trackingId = null;
    el('startGpsBtn').disabled = !route;
    el('stopGpsBtn').disabled = true;
    el('rerouteBtn').disabled = !position;
    el('gpsStatus').textContent = route ? 'GPS tracking stopped' : 'No route calculated';
  }
  function reset() {
    stop();
    route = null;
    position = null;
    coordinates = [];
    cumulative = [];
    lastTurnIndex = null;
    el('gpsRouteName').textContent = 'Analyze and select a route first';
    el('gpsSpeed').textContent = '— km/h';
    el('gpsRemaining').textContent = '— km';
    el('gpsEta').textContent = '—';
    el('gpsArrival').textContent = '—';
    el('nextManeuver').textContent = 'Select a route to see turn instructions.';
    el('nextManeuverDistance').textContent = 'No navigation active';
    el('directionsList').innerHTML = '<li>Analyze a route to load directions.</li>';
    el('gpsWarning').textContent = 'GPS speeds depend on device hardware. No live traffic or road speed-limit feed is connected.';
    el('rerouteBtn').disabled = true;
  }
  function setRoute(nextRoute) {
    stop();
    route = nextRoute && nextRoute.geometry?.type === 'LineString' ? nextRoute : null;
    position = null;
    lastTurnIndex = null;
    coordinates = route?.geometry?.coordinates || [];
    cumulative = [0];
    for (let i=1; i<coordinates.length; i++) {
      cumulative.push(cumulative[i-1] + km(coordinates[i-1], coordinates[i]));
    }
    el('gpsRouteName').textContent = route ? `${MODE_META[state.travelMode]?.label || "Journey"} directions: ${route.name}` : 'Analyze and select a route first';
    el('startGpsBtn').disabled = !route;
    el('rerouteBtn').disabled = true;
    el('gpsStatus').textContent = route ? 'Directions ready. Start GPS when travelling.' : 'No road route calculated';
    el('gpsSpeed').textContent = '— km/h';
    el('gpsRemaining').textContent = route ? `${Number(route.distance_km).toFixed(1)} km` : '— km';
    el('gpsEta').textContent = route ? minutesText(route.duration_minutes) : '—';
    el('gpsArrival').textContent = '—';
    const steps = route?.directions_preview || [];
    el('directionsList').replaceChildren();
    steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.id = `gps-instruction-${index}`;
      li.textContent = String(step.instruction || 'Continue');
      const small = document.createElement('small');
      small.textContent = ` · ${Number(step.distance_km || 0).toFixed(2)} km`;
      li.appendChild(small);
      el('directionsList').appendChild(li);
    });
    if (!steps.length) el('directionsList').innerHTML = '<li>No detailed directions in this response. Redeploy included Lambda code.</li>';
    el('nextManeuver').textContent = steps[0]?.instruction || 'Detailed instructions unavailable';
    el('nextManeuverDistance').textContent = 'Start GPS to track turn distance';
  }

  function closestSegment(gps) {
    if (coordinates.length < 2) return null;
    let best = {distanceKm: Infinity, travelledKm: 0, segment: 0};
    const latScale = Math.cos(gps[1]*Math.PI/180);
    for (let i=0; i<coordinates.length-1; i++) {
      const a = coordinates[i]; const b = coordinates[i+1];
      const ax = (a[0]-gps[0])*latScale; const ay = a[1]-gps[1];
      const bx = (b[0]-gps[0])*latScale; const by = b[1]-gps[1];
      const vx = bx-ax; const vy = by-ay;
      const denom = vx*vx+vy*vy;
      const t = denom ? Math.max(0,Math.min(1,-(ax*vx+ay*vy)/denom)) : 0;
      const projected = [a[0] + t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])];
      const distanceKm = km(gps,projected);
      if (distanceKm < best.distanceKm) best = {
        distanceKm, travelledKm:cumulative[i]+t*(cumulative[i+1]-cumulative[i]), segment:i
      };
    }
    return best;
  }
  function currentTurn(travelled) {
    const steps = route?.directions_preview || [];
    if (!steps.length) return null;
    let idx = steps.findIndex(s => Number.isInteger(s.start_index) &&
      cumulative[s.start_index] !== undefined && cumulative[s.start_index] > travelled + 0.03);
    if (idx === -1) idx = steps.length - 1;
    const step = steps[idx];
    const distanceKm = Number.isInteger(step.start_index) && cumulative[step.start_index] !== undefined
      ? Math.max(0, cumulative[step.start_index]-travelled) : null;
    return {step, idx, distanceKm};
  }

  function onPosition(result) {
    if (!route || trackingId === null) return;
    const c = result.coords;
    const gps = [c.longitude,c.latitude];
    if (![...gps].every(Number.isFinite)) return;
    position = gps;
    const speedKmh = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed * 3.6 : null;
    const accuracy = Number.isFinite(c.accuracy) ? c.accuracy : null;
    ClimoraMap.updateUserLocation(gps, accuracy, true);
    el('gpsSpeed').textContent = speedKmh === null ? '— km/h' : `${speedKmh.toFixed(0)} km/h`;
    el('rerouteBtn').disabled = false;
    const nearest = closestSegment(gps);
    if (!nearest) return;
    const totalKm = cumulative.at(-1) || route.distance_km;
    // Geometry uses straight segment chord approximations. Use it only for
    // traveled fraction; display provider-reported road/path distance.
    const fractionRemaining = totalKm > 0 ? Math.max(0, Math.min(1, (totalKm-nearest.travelledKm)/totalKm)) : 1;
    const remaining = Number(route.distance_km) * fractionRemaining;
    const mins = Number(route.duration_minutes) * fractionRemaining;
    el('gpsRemaining').textContent = remaining.toFixed(1) + ' km';
    el('gpsEta').textContent = minutesText(mins);
    el('gpsArrival').textContent = new Date(Date.now() + mins*60000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const turn = currentTurn(nearest.travelledKm);
    if (turn) {
      el('nextManeuver').textContent = turn.step.instruction;
      el('nextManeuverDistance').textContent = turn.distanceKm === null ? 'Turn distance unavailable' :
        (turn.distanceKm < 1 ? Math.round(turn.distanceKm*1000)+' m ahead' : turn.distanceKm.toFixed(1)+' km ahead');
      if (turn.idx !== lastTurnIndex) {
        const previous = document.getElementById(`gps-instruction-${lastTurnIndex}`);
        if (previous) previous.classList.remove('active-instruction');
        const next = document.getElementById(`gps-instruction-${turn.idx}`);
        if (next) next.classList.add('active-instruction');
        lastTurnIndex = turn.idx;
      }
    }
    el('gpsStatus').textContent = `GPS active · accuracy ${accuracy ? Math.round(accuracy)+' m' : 'unknown'}`;
    if (nearest.distanceKm > 0.2 && (accuracy === null || accuracy < 100)) {
      el('gpsWarning').textContent = 'You appear more than 200 m from the chosen road route. Tap “Recalculate from GPS” when safe to do so.';
    } else if (accuracy !== null && accuracy > 100) {
      el('gpsWarning').textContent = 'GPS accuracy is low. Navigation distances and next-turn estimates may be unreliable.';
    } else {
      el('gpsWarning').textContent = 'GPS position tracked. Remaining distance/time are approximate fractions of the provider route, not traffic-aware predictions. Road speed limits are not supplied.';
    }
  }
  function start() {
    if (!route || !navigator.geolocation) {
      el('gpsWarning').textContent = 'This browser cannot provide GPS location.';
      return;
    }
    if (trackingId !== null) return;
    el('gpsStatus').textContent = 'Requesting device location permission...';
    // Location is used only in this browser; no location is shared with friends.
    trackingId = navigator.geolocation.watchPosition(onPosition, err => {
      el('gpsWarning').textContent = `GPS unavailable: ${err.message}. Check location permission and device settings.`;
      stop();
    }, {enableHighAccuracy:true, maximumAge:2000, timeout:20000});
    el('startGpsBtn').disabled = true;
    el('stopGpsBtn').disabled = false;
  }
  function reroute() {
    if (!position || !route) return;
    stop();
    // Explicit click only, avoiding expensive automatic API loops.
    state.via = null;
    updateLocationUI('via');
    setLocation('start', [...position], 'My current GPS location');
    void analyze();
  }
  return {init, setRoute, reset, stop};
})();
