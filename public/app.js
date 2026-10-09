/* Climora Phase 4 — place search, AWS real routing, modeled air and weather */
const CLIMORA_API = "https://gbxdgy9b09.execute-api.ap-south-1.amazonaws.com/analyze-route";
const $ = id => document.getElementById(id);
const state = {
  start: { name: "Bandra, Mumbai", coords: [72.8347, 19.0544] },
  end: { name: "Juhu, Mumbai", coords: [72.8267, 19.1075] },
  routes: [],
  bestId: null,
  selectedId: null,
  requestId: 0,
  travelMode: "car"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function showError(message) {
  $("errorBox").textContent = message;
  $("errorBox").hidden = false;
}
function hideError() { $("errorBox").hidden = true; $("errorBox").textContent = ""; }
function isCoords(coords) {
  return Array.isArray(coords) && coords.length === 2 &&
    coords.every(Number.isFinite) && coords[0] >= -180 && coords[0] <= 180 &&
    coords[1] >= -90 && coords[1] <= 90;
}
function formatMinutes(value) {
  const mins = Number(value);
  if (mins >= 60) {
    const rounded = Math.round(mins);
    return `${Math.floor(rounded / 60)} hr ${rounded % 60} min`;
  }
  return `${Math.round(mins * 10) / 10} min`;
}
const MODE_META = {
  car: {label:"Car", notice:"Car: road distance and modeled driving time. Live traffic and stops excluded.", gmaps:"driving"},
  bicycle: {label:"Bicycle", notice:"Bicycle: cycle-accessible routes and estimated ride times. Road safety must be checked in person.", gmaps:"bicycling"},
  walking: {label:"Walking", notice:"Walking: footpaths and pedestrian-accessible routes with estimated walking time.", gmaps:"walking"},
  ebike: {label:"E-bike", notice:"E-bike: electric-assist cycling route. Not a motorcycle or scooter route.", gmaps:"bicycling"}
};
function selectedTravelMode() {
  return document.querySelector('input[name="travelMode"]:checked')?.value || "car";
}
function syncTravelMode() {
  const mode = selectedTravelMode();
  if (!MODE_META[mode]) throw new Error("Invalid travel mode selected.");
  state.travelMode = mode;
  $("modeNotice").textContent = MODE_META[mode].notice;
  $("analyzeBtn").querySelector("span").textContent = mode === "walking" ? "🚶" : mode === "bicycle" ? "🚲" : mode === "ebike" ? "⚡" : "✦";
}

function formatCoords(coords) { return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`; }
function setLoading(isLoading, message = "") {
  $("loading").hidden = !isLoading;
  $("analyzeBtn").disabled = isLoading;
  if (message) $("loadingText").textContent = message;
}
function updateLocationUI(mode) {
  const fieldId = mode === "start" ? "from" : "to";
  const data = state[mode];
  $(fieldId).value = data?.name || "";
  $(`${fieldId}Hint`).textContent = isCoords(data?.coords)
    ? `✓ Location selected · ${formatCoords(data.coords)}`
    : "Search and select a location, or pick on the map";
  $(`${fieldId}Results`).replaceChildren();
}
function clearAnalysis() {
  state.requestId += 1;
  setLoading(false);
  state.routes = [];
  state.bestId = null;
  state.selectedId = null;
  ClimoraMap.clearRoutes();
  ClimoraNavigation.reset();
  $("routeCount").textContent = "0 ROUTES";
  $("routingNotice").hidden = true;
  $("routeCards").innerHTML = '<div class="empty-state">Locations changed. Run analysis to calculate roads.</div>';
  $("routeDetails").hidden = true;
  $("startEnvironment").textContent = "Run a route analysis to view modeled conditions.";
  $("endEnvironment").textContent = "Run a route analysis to view modeled conditions.";
  $("startWeatherTitle").textContent = state.start.name;
  $("endWeatherTitle").textContent = state.end.name;
  hideError();
}
function setLocation(mode, coords, name) {
  if (!isCoords(coords)) throw new Error("Invalid coordinates received.");
  state[mode] = { name, coords };
  clearAnalysis();
  updateLocationUI(mode);
  if (isCoords(state.start.coords) && isCoords(state.end.coords)) {
    ClimoraMap.setPoints(state.start.coords, state.end.coords);
  }
}
function applyPreset(preset) {
  const places = {
    "bandra-juhu": [
      { name: "Bandra, Mumbai", coords: [72.8347, 19.0544] },
      { name: "Juhu, Mumbai", coords: [72.8267, 19.1075] }
    ],
    "andheri-powai": [
      { name: "Andheri East, Mumbai", coords: [72.8697, 19.1136] },
      { name: "Powai, Mumbai", coords: [72.9052, 19.1176] }
    ],
    "dadar-cst": [
      { name: "Dadar, Mumbai", coords: [72.8428, 19.0178] },
      { name: "CSMT, Mumbai", coords: [72.8355, 18.9398] }
    ]
  };
  const pair = places[preset];
  if (!pair) return;
  state.start = {...pair[0]};
  state.end = {...pair[1]};
  clearAnalysis();
  for (const mode of ["start", "end"]) updateLocationUI(mode);
  ClimoraMap.setPoints(state.start.coords, state.end.coords);
  document.getElementById("planner").scrollIntoView({behavior:"smooth"});
}

const SPECIAL_GOAL_PLACES = {
  goa: [
    { name: "Panaji, Goa (state capital)", coords: [73.8278,15.4909] },
    { name: "Margao, South Goa", coords: [73.9581,15.2832] },
    { name: "Calangute, North Goa", coords: [73.7620,15.5440] },
    { name: "Mapusa, North Goa", coords: [73.8089,15.5915] }
  ]
};
function appendLocationChoice(output, mode, name, coords) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "place-choice";
  button.textContent = name;
  button.addEventListener("click", () => setLocation(mode, coords, name));
  output.appendChild(button);
}

async function lookupLocations(mode) {
  const fieldId = mode === "start" ? "from" : "to";
  const query = $(fieldId).value.trim();
  const output = $(`${fieldId}Results`);
  output.replaceChildren();
  hideError();
  if (query.length < 2) {
    showError("Enter at least two characters to search for a place.");
    return;
  }
  const normalized = query.toLowerCase();
  if (SPECIAL_GOAL_PLACES[normalized]) {
    output.innerHTML = '<div class="results-message">Goa is a state. Choose a specific destination:</div>';
    SPECIAL_GOAL_PLACES[normalized].forEach(place => {
      appendLocationChoice(output, mode, place.name, place.coords);
    });
    return;
  }
  output.innerHTML = '<div class="results-message">Searching places...</div>';
  try {
    const params = new URLSearchParams({ name: query, count: "8", language: "en", countryCode: "IN", format: "json" });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!response.ok) throw new Error("Location provider unavailable.");
    const data = await response.json();
    // Ignore stale search results after the input has changed.
    if ($(fieldId).value.trim() !== query) return;
    const places = (data.results || []).filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude));
    output.replaceChildren();
    if (!places.length) {
      output.innerHTML = '<div class="results-message">No matches. Try a nearby larger town or pick your point on the map.</div>';
      return;
    }
    places.forEach(place => {
      const label = [place.name, place.admin2, place.admin1, place.country]
        .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ");
      appendLocationChoice(output, mode, label, [Number(place.longitude), Number(place.latitude)]);
    });
  } catch (error) {
    output.replaceChildren();
    showError(`Could not search locations: ${error.message}`);
  }
}

function routeById(id) { return state.routes.find(r => String(r.id) === String(id)); }
function mapLink(route) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${state.start.coords[1]},${state.start.coords[0]}`);
  url.searchParams.set("destination", `${state.end.coords[1]},${state.end.coords[0]}`);
  url.searchParams.set("travelmode", MODE_META[state.travelMode]?.gmaps || "driving");
  return url.toString();
}
function searchNearby(kind) {
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${kind} near ${state.end.name}`);
}
function displayRouteDetails(id) {
  const route = routeById(id);
  const panel = $("routeDetails");
  if (!route) { panel.hidden = true; return; }
  const fastest = String(route.id) === state.bestId;
  const arrive = new Date(Date.now() + Number(route.duration_minutes) * 60000)
    .toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  const within = route.within_time_limit !== false;
  const stepPreview = (route.directions_preview || []).slice(0, 16).map(step => `
    <li>${escapeHtml(step.instruction)} <small>(${Number(step.distance_km).toFixed(2)} km)</small></li>`).join("");
  panel.hidden = false;
  panel.innerHTML = `
    <div class="detail-top"><div><p class="eyebrow">CURRENT ROUTE</p><h3>${escapeHtml(route.name)}</h3></div>
      <span class="chip">${fastest ? "FASTEST ESTIMATE" : "ALTERNATIVE"}</span></div>
    <div class="detail-grid">
      <div><small>Estimated ${escapeHtml(MODE_META[state.travelMode]?.label || "journey")} time</small><strong>${formatMinutes(route.duration_minutes)}</strong></div>
      <div><small>Road distance</small><strong>${Number(route.distance_km).toFixed(2)} km</strong></div>
      <div><small>Arrival if leaving now</small><strong>${escapeHtml(arrive)}</strong></div>
    </div>
    <p class="detail-note">${fastest ? "Fastest returned route estimate." : "Alternative road/path option."}
      ${within ? "Within your selected detour limit." : "Long detour: exceeds your selected limit; not recommended."}
      Distance and duration are from the OpenRouteService ${escapeHtml(MODE_META[state.travelMode]?.label || "selected")} routing profile. Estimated time excludes stops, delays and live traffic; no pollution scoring yet.
    </p>
    <div class="route-actions">
      <a href="${escapeHtml(mapLink(route))}" target="_blank" rel="noopener noreferrer">↗ Open journey in Google Maps</a>
      <a href="${escapeHtml(searchNearby("restaurants and snacks"))}" target="_blank" rel="noopener noreferrer">☕ Food near destination</a>
      <a href="${escapeHtml(searchNearby("hotels and stays"))}" target="_blank" rel="noopener noreferrer">🛏 Stays near destination</a>
    </div>
    ${stepPreview ? `<details class="directions-preview"><summary>Preview road directions (first ${Math.min(16,route.directions_preview.length)} steps)</summary><ol>${stepPreview}</ol></details>` : ""}
    <p class="detail-note">Google Maps may calculate a different route or ETA. Food and stay links open searches; they do not confirm availability.</p>
  `;
}

function displayRouteCards() {
  const wrapper = $("routeCards");
  wrapper.replaceChildren();
  if (!state.routes.length) return;
  state.routes.forEach(route => {
    const id = String(route.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "route-card" + (id === state.selectedId ? " selected" : "");
    card.style.setProperty("--route-color", ClimoraMap.getRouteColor(id));
    card.innerHTML = `
      <span class="route-name"><i></i>${escapeHtml(route.name)}</span>
      <span class="route-time">${formatMinutes(route.duration_minutes)}</span>
      <span class="route-distance">${Number(route.distance_km).toFixed(2)} km</span>
      <span class="route-tag">${id === state.bestId ? "FASTEST" : "ALTERNATIVE"}</span>
      ${route.within_time_limit === false ? '<span class="route-tag late">LONG DETOUR</span>' : ""}
      ${id === state.selectedId ? '<span class="route-tag">SELECTED</span>' : ""}
    `;
    card.addEventListener("click", () => ClimoraMap.selectRoute(id));
    wrapper.appendChild(card);
  });
}
function handleSelection(id) {
  state.selectedId = id === null ? null : String(id);
  displayRouteCards();
  displayRouteDetails(state.selectedId || state.bestId);
  const chosen = state.routes.find(r => String(r.id) === String(state.selectedId || state.bestId));
  ClimoraNavigation.setRoute(chosen || null);
}
function unpackResponse(raw) {
  if (typeof raw.body === "string") return JSON.parse(raw.body);
  if (raw.body && typeof raw.body === "object") return raw.body;
  return raw;
}

async function getEnvironmentalSnapshot(coords) {
  const qs = new URLSearchParams({ latitude: String(coords[1]), longitude: String(coords[0]), timezone: "auto" });
  const weatherQuery = new URLSearchParams(qs);
  weatherQuery.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code");
  const airQuery = new URLSearchParams(qs);
  airQuery.set("current", "us_aqi,pm2_5");
  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${weatherQuery}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airQuery}`)
  ]);
  if (!weatherResponse.ok || !airResponse.ok) throw new Error("Environmental API unavailable");
  const [weather, air] = await Promise.all([weatherResponse.json(), airResponse.json()]);
  if (!weather.current || !air.current) throw new Error("No environmental observations returned");
  return { weather: weather.current, air: air.current };
}
function asMeasure(number, suffix = "") {
  return typeof number === "number" && Number.isFinite(number) ? `${Math.round(number * 10) / 10}${suffix}` : "N/A";
}
function conditionText(code) {
  if (code === 0) return "Clear sky";
  if ([1,2,3].includes(code)) return "Cloudy / partly cloudy";
  if ([45,48].includes(code)) return "Foggy";
  if ([51,53,55,56,57].includes(code)) return "Drizzle";
  if ([61,63,65,66,67,80,81,82].includes(code)) return "Rain";
  if ([71,73,75,77,85,86].includes(code)) return "Snow";
  if ([95,96,99].includes(code)) return "Thunderstorm";
  return "Conditions unavailable";
}
function showEnvironmental(id, result) {
  const parent = $(id);
  if (!result) { parent.textContent = "Data unavailable right now. Route analysis still works."; return; }
  const {weather, air} = result;
  parent.innerHTML = `
    <div class="env-metrics"><div><span>Temperature</span><strong>${asMeasure(weather.temperature_2m, "°C")}</strong></div>
    <div><span>US AQI (modeled)</span><strong>${asMeasure(air.us_aqi)}</strong></div>
    <div><span>PM2.5 (modeled)</span><strong>${asMeasure(air.pm2_5, " µg/m³")}</strong></div>
    <div><span>Wind</span><strong>${asMeasure(weather.wind_speed_10m, " km/h")}</strong></div></div>
    <p class="env-summary">${escapeHtml(conditionText(weather.weather_code))} · ${asMeasure(weather.precipitation, " mm precipitation")} · ${asMeasure(weather.relative_humidity_2m, "% humidity")}</p>
  `;
}
async function updateEnvironment(start, end, requestId) {
  $("startEnvironment").textContent = "Loading modeled local conditions...";
  $("endEnvironment").textContent = "Loading modeled local conditions...";
  const responses = await Promise.allSettled([
    getEnvironmentalSnapshot(start.coords), getEnvironmentalSnapshot(end.coords)
  ]);
  if (requestId !== state.requestId) return;
  showEnvironmental("startEnvironment", responses[0].status === "fulfilled" ? responses[0].value : null);
  showEnvironmental("endEnvironment", responses[1].status === "fulfilled" ? responses[1].value : null);
}

async function analyze(event) {
  event?.preventDefault();
  hideError();
  if (!isCoords(state.start.coords) || !isCoords(state.end.coords)) {
    showError("Please search and select both locations first, or pick them on the map.");
    return;
  }
  if (state.start.coords.every((v, i) => v === state.end.coords[i])) {
    showError("Start and destination cannot be identical.");
    return;
  }
  const maxExtraPercent = Number($("extraPercent").value);
  const maxExtraMinutes = Number($("extraMinutes").value);
  if (![maxExtraPercent, maxExtraMinutes].every(Number.isFinite) || maxExtraPercent < 0 || maxExtraMinutes < 0) {
    showError("Enter valid non-negative detour limits.");
    return;
  }
  const requestId = ++state.requestId;
  const start = { ...state.start, coords: [...state.start.coords] };
  const end = { ...state.end, coords: [...state.end.coords] };
  state.routes = [];
  state.bestId = null;
  state.selectedId = null;
  ClimoraMap.clearRoutes();
  ClimoraNavigation.reset();
  ClimoraMap.setPoints(start.coords, end.coords);
  $("routeCards").innerHTML = '<div class="empty-state">Requesting roads from AWS Lambda...</div>';
  $("routeDetails").hidden = true;
  setLoading(true, "Requesting route geometry from AWS...");
  try {
    const response = await fetch(CLIMORA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: start.coords,
        end: end.coords,
        max_extra_percent: maxExtraPercent,
        max_extra_minutes: maxExtraMinutes,
        travel_mode: state.travelMode,
        explore_corridors: false
      })
    });
    const raw = await response.json();
    const body = unpackResponse(raw);
    if (!response.ok || (raw.statusCode && raw.statusCode !== 200)) throw new Error(body.error || body.details || "Backend route request failed");
    if (body.travel_mode && body.travel_mode !== state.travelMode) throw new Error("AWS Lambda returned another travel mode. Redeploy the included Python code first.");
    if (body.mode !== "real_road_routing" || !body.recommended_route) throw new Error("Unexpected response: real road-routing result missing");
    if (requestId !== state.requestId) return;
    const valid = (body.valid_routes || []).map(r => ({ ...r, within_time_limit: true }));
    const rejected = (body.rejected_routes || []).map(r => ({ ...r, within_time_limit: false }));
    const unique = new Map();
    [...valid, ...rejected].forEach(route => unique.set(String(route.id), route));
    state.routes = [...unique.values()];
    if (!state.routes.length) throw new Error("Provider returned no road routes.");
    state.bestId = String(body.recommended_route.id);
    ClimoraMap.drawRoutes(state.routes, state.bestId);
    $("routeCount").textContent = `${state.routes.length} ROUTE(S)`;
    const notice = $("routingNotice");
    notice.hidden = false;
    notice.textContent = `${MODE_META[state.travelMode].label} mode · Real route distance and estimated time from OpenRouteService. ` +
      `${body.maximum_allowed_minutes ? "Travel-time limit: " + formatMinutes(body.maximum_allowed_minutes) + ". " : ""}` +
      "No live traffic, real-time speed limits or stop durations included.";
    $("awsStatus").textContent = "● AWS route engine connected";
    $("awsStatus").classList.add("connected");
    displayRouteCards();
    displayRouteDetails(state.bestId);
    ClimoraNavigation.setRoute(state.routes.find(r => String(r.id) === state.bestId));
    $("startWeatherTitle").textContent = start.name;
    $("endWeatherTitle").textContent = end.name;
    void updateEnvironment(start, end, requestId);
    $("comparison").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error("Climora routing error", error);
    $("routeCards").innerHTML = '<div class="empty-state">Could not calculate routes. Try the sample journey or nearby locations.</div>';
    showError(error.message === "Failed to fetch" ? "AWS request could not connect. Check API Gateway CORS for this browser origin and your internet connection." : error.message);
  } finally {
    if (requestId === state.requestId) setLoading(false);
  }
}

function setup() {
  try {
    ClimoraMap.init();
  } catch (error) { showError(error.message); return; }
  ClimoraMap.setRouteSelectHandler(handleSelection);
  ClimoraNavigation.init();
  document.querySelectorAll('input[name="travelMode"]').forEach(input => {
    input.addEventListener("change", () => {
      syncTravelMode();
      clearAnalysis();
    });
  });
  syncTravelMode();
  ClimoraMap.setPointPickHandler((mode, coords) => setLocation(mode, coords, `Pinned location (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`));
  for (const [mode, fieldId] of [["start", "from"], ["end", "to"]]) {
    updateLocationUI(mode);
    $(fieldId).addEventListener("input", () => {
      state[mode] = { name: $(fieldId).value, coords: null };
      $(`${fieldId}Hint`).textContent = "Click Search, then choose the correct result";
      $(`${fieldId}Results`).replaceChildren();
      clearAnalysis();
    });
    $(fieldId).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); void lookupLocations(mode); } });
  }
  $("searchFrom").addEventListener("click", () => void lookupLocations("start"));
  $("searchTo").addEventListener("click", () => void lookupLocations("end"));
  document.querySelectorAll("[data-preset]").forEach(button =>
    button.addEventListener("click", () => applyPreset(button.dataset.preset)));

  $("pickStart").addEventListener("click", () => ClimoraMap.enablePointPicking("start"));
  $("pickEnd").addEventListener("click", () => ClimoraMap.enablePointPicking("end"));
  $("showAllBtn").addEventListener("click", () => ClimoraMap.showAllRoutes());
  $("resetMapBtn").addEventListener("click", () => ClimoraMap.fitMap());
  $("routeForm").addEventListener("submit", analyze);
  $("useMyLocation").addEventListener("click", () => {
    if (!navigator.geolocation) { showError("Your browser does not support geolocation."); return; }
    hideError();
    navigator.geolocation.getCurrentPosition(
      pos => setLocation("start", [pos.coords.longitude, pos.coords.latitude], "My current location"),
      () => showError("Location permission was denied or your position was unavailable. You can pick a location on the map."),
      {enableHighAccuracy: false, timeout: 12000, maximumAge: 60000}
    );
  });
}
document.addEventListener("DOMContentLoaded", setup);
