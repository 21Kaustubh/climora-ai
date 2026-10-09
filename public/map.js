/* Climora Phase 4 — Leaflet real-road map */
const ClimoraMap = (() => {
  let map;
  let startMarker = null;
  let endMarker = null;
  let gpsMarker = null;
  let gpsAccuracyCircle = null;
  let selectionMode = null;
  let routeSelectHandler = null;
  let pointPickHandler = null;
  const layers = new Map();
  let routeModels = [];
  let selectedId = null;
  let recommendedId = null;
  const COLORS = ["#3ee8a6", "#ad95ff", "#f5b75b", "#64bafe", "#ff7d99"];

  function init() {
    if (typeof L === "undefined") throw new Error("Leaflet library did not load. Check your internet connection.");
    map = L.map("routeMap", { zoomControl: true, preferCanvas: true }).setView([19.08, 72.83], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on("click", e => {
      if (!selectionMode) return;
      const mode = selectionMode;
      selectionMode = null;
      const coords = [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))];
      if (typeof pointPickHandler === "function") pointPickHandler(mode, coords);
      setStatus("Map point selected. Analyze to calculate roads.");
    });
    setPoints([72.8347, 19.0544], [72.8267, 19.1075]);
    setTimeout(() => map.invalidateSize(), 130);
  }

  function setStatus(text) {
    const status = document.getElementById("mapStatus");
    if (status) status.textContent = text;
  }

  function makeMarker(coords, fillColor, label) {
    return L.circleMarker([coords[1], coords[0]], {
      radius: 9, color: "#ffffff", weight: 3, fillColor, fillOpacity: 1
    }).addTo(map).bindTooltip(label, { direction: "top" });
  }

  function setPoints(start, end) {
    if (!map) return;
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    startMarker = makeMarker(start, "#3ee8a6", "Start");
    endMarker = makeMarker(end, "#f5b75b", "Destination");
    if (!layers.size) fitMap();
  }

  function clearRoutes() {
    layers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
    layers.clear();
    routeModels = [];
    selectedId = null;
    recommendedId = null;
    setStatus("Choose start and destination to analyze");
  }

  function drawRoutes(routes, bestId) {
    clearRoutes();
    recommendedId = String(bestId);
    routeModels = routes.filter(route => route.geometry && route.geometry.coordinates && route.geometry.type);
    routeModels.forEach((route, index) => {
      const id = String(route.id);
      const color = COLORS[index % COLORS.length];
      route.mapColor = color;
      const layer = L.geoJSON({type: "Feature", geometry: route.geometry, properties: {}}, {
        style: { color, weight: id === recommendedId ? 8 : 6, opacity: 0.9, lineCap: "round", lineJoin: "round" },
        bubblingMouseEvents: false
      });
      layer.on("click", () => selectRoute(id));
      layer.on("mouseover", () => layer.setStyle({ weight: 11, opacity: 1 }));
      layer.on("mouseout", () => layer.setStyle({
        weight: selectedId === id ? 9 : (id === recommendedId ? 8 : 6), opacity: selectedId === id ? 1 : 0.9
      }));
      layers.set(id, layer);
      layer.addTo(map);
    });
    setStatus(`${routeModels.length} real road route(s) returned`);
    fitMap();
  }

  function selectRoute(id) {
    id = String(id);
    const chosen = layers.get(id);
    if (!chosen) return;
    selectedId = id;
    layers.forEach((layer, key) => {
      if (key === id) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        layer.setStyle({ weight: 9, opacity: 1 });
        layer.bringToFront();
      } else if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    const bounds = chosen.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
    setStatus("Showing only the selected route");
    if (typeof routeSelectHandler === "function") routeSelectHandler(id);
  }

  function showAllRoutes() {
    selectedId = null;
    layers.forEach((layer, id) => {
      if (!map.hasLayer(layer)) layer.addTo(map);
      layer.setStyle({ weight: id === recommendedId ? 8 : 6, opacity: 0.9 });
    });
    setStatus(layers.size ? "Comparing all returned routes" : "No routes calculated yet");
    fitMap();
    if (typeof routeSelectHandler === "function") routeSelectHandler(null);
  }

  function fitMap() {
    if (!map) return;
    const bounds = L.latLngBounds([]);
    layers.forEach(layer => { if (map.hasLayer(layer)) bounds.extend(layer.getBounds()); });
    if (startMarker) bounds.extend(startMarker.getLatLng());
    if (endMarker) bounds.extend(endMarker.getLatLng());
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.20), { maxZoom: 15 });
    map.invalidateSize();
  }

  function enablePointPicking(mode) {
    selectionMode = mode;
    setStatus(mode === "start" ? "Click map to choose START" : "Click map to choose DESTINATION");
  }

  function updateUserLocation(coords, accuracyMeters, follow = true) {
    if (!map || !Array.isArray(coords)) return;
    const pos = [coords[1], coords[0]];
    if (!gpsMarker) {
      gpsMarker = L.circleMarker(pos, {
        radius: 8, color: "#ffffff", weight: 3,
        fillColor: "#268aff", fillOpacity: 1
      }).bindTooltip("My live GPS position").addTo(map);
    } else gpsMarker.setLatLng(pos);
    const radius = Number.isFinite(accuracyMeters) ? Math.min(Math.max(accuracyMeters, 1), 1500) : 50;
    if (!gpsAccuracyCircle) {
      gpsAccuracyCircle = L.circle(pos, {
        radius, weight: 1, color: "#268aff", fillColor: "#268aff", fillOpacity: 0.10
      }).addTo(map);
    } else gpsAccuracyCircle.setLatLng(pos).setRadius(radius);
    if (follow) map.panTo(pos, {animate: true, duration: 0.4});
  }

  function getRouteColor(id) {
    const route = routeModels.find(r => String(r.id) === String(id));
    return route?.mapColor || COLORS[0];
  }

  return {
    init, setPoints, clearRoutes, drawRoutes, selectRoute, showAllRoutes, fitMap, enablePointPicking,
    getRouteColor, updateUserLocation,
    setRouteSelectHandler: fn => { routeSelectHandler = fn; },
    setPointPickHandler: fn => { pointPickHandler = fn; }
  };
})();
