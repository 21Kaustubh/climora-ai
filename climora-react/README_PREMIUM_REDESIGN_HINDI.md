# CLIMORA AI — Premium React Redesign (Studio Edition)

## Kya change hua?

Naya design: Cinematic + Futuristic AI Explorer + Climate Intelligence, dark emerald/teal glass UI. Header responsive hai, navigation hero illustrated SVG motion use karta hai, route planner aur map modern cards me re-styled hain, route comparison, GPS dashboard, AQI/weather, model-based route pollution, upcoming features redesigned hain.

**Yeh existing React/Vite app ka frontend redesign hai, live Google Maps ka replacement nahi.** Maps API key, AWS API Gateway, OpenRouteService, route calculations, GPS hook, geocoding, air quality and PM2.5 scoring logic same hain.

## Easiest install — SOURCE ONLY ZIP

1. Existing folder ka backup banao:

   `C:\Users\daksh\Downloads\1project\climora-react`

2. `Climora_Premium_UI_Only.zip` extract karo.

3. ZIP ke `src` folder ko current `climora-react/src` mein copy / merge karo. `Replace existing files` choose karo. ZIP mein aayi files complete hain; code snippet replace nahi karna.

4. Root folder ki `.env.local`, `node_modules`, `.gitignore`, `package.json` unchanged rakho. Nayi API key nahi chahiye.

5. VS Code terminal mein (existing Vite server ko Ctrl+C se stop karne ke baad):

   ```powershell
   cd C:\Users\daksh\Downloads\1project\climora-react
   npm run dev
   ```

6. Chrome URL: `http://127.0.0.1:5500/` (not file:/// and not /public/index.html). Ctrl+Shift+R se hard refresh.

## Complete project ZIP

`Climora_React_Premium_Full.zip` mein full Vite source project hai. Agar tum isko separate new folder mein unzip karte ho, apni existing `.env.local` ko *local machine par* new project root mein manually copy karo (GitHub/chat mein share mat karna). Naye folder se `npm install` then `npm run dev`.

## React source files changed in this redesign

- `src/components/ExperienceHero.jsx` — **new** cinematic hero, responsive navigation, illustrated interactive-looking route artwork, feature rail. Artwork decorative only.
- `src/App.jsx` — same route/state/API logic, new header/hero and layout text, scroll reveal hooks.
- `src/components/GoogleMapPanel.jsx` — same Google Map init/controller and events, new map controls layout and legend.
- `src/premium.css` — **new** entire design layer, responsive design, advanced motion, accessibility.
- `src/main.jsx` — imports `premium.css` after original CSS.

Original `src/services/*`, `src/hooks/useGpsNavigation.js`, `src/lib/googleMap.js`, `src/components/EnvironmentCard.jsx`, `src/components/PollutionIntelligence.jsx`, and `src/components/GpsPanel.jsx` are preserved unchanged from the Phase 5 source.

## Test checklist (real browser)

1. Hero visible: map-sphere illustration & cards float smoothly; navigation menu opens on mobile.
2. Google Maps loads when `.env.local` contains `VITE_GOOGLE_MAPS_API_KEY` and key restrictions allow `http://127.0.0.1:5500/*`.
3. Bandra → Juhu in Car mode: Calculate routes; verify road geometry, distance and estimated minutes.
4. Change mode Walking / Bicycle / E-bike and rerun.
5. Click route cards, toggle All routes, Road map/Satellite/Traffic/Fit map.
6. Open turn directions; GPS navigation requires browser location permission (test safely; not while driving).
7. Air & weather cards show modeled AQI, PM2.5 and conditions if Open-Meteo reachable.
8. Pollution along your routes shows modeled screening results or a helpful unavailable state if API fails.
9. Test mobile display at 390px width; confirm forms don't overflow and mobile menu works.
10. Optional accessibility check: Windows reduced motion setting should minimize animations.

## Common issues

- `Google Maps key missing` → check `.env.local` is in `climora-react/` (same level as package.json) and restart Vite.
- `RefererNotAllowedMapError` → Google Cloud key restrictions must allow the current origin `http://127.0.0.1:5500/*` and Maps JavaScript API.
- AWS fetch fails/CORS → verify AWS API URL, `http://127.0.0.1:5500` API Gateway CORS, internet connection.
- Port 5500 busy → stop Live Server and older Vite processes. Current API Gateway CORS and key website restriction assume port 5500.
- No modeled air data → normal route planner should still work; frontend deliberately does not invent pollution values.

## Production/GitHub

From `1project` root, verify `.env.local` and `node_modules` are ignored:

```powershell
git check-ignore climora-react/.env.local
git check-ignore climora-react/node_modules
```

Then, after local tests pass:

```powershell
git add climora-react/src/ climora-react/README_PREMIUM_REDESIGN_HINDI.md
git status
git commit -m "Redesign Climora React experience with premium motion UI"
git push origin main
```

**Never put a server-side credential into a `VITE_` variable.** Vite `VITE_GOOGLE_MAPS_API_KEY` is a browser-visible Google Maps key and must be restricted to approved website origins and Maps JavaScript API. Do not commit `.env.local`.

## Accuracy and safety

- Decorative hero diagram is not a real map or route.
- Google Maps displays roads; AWS/OpenRouteService supplies route distance/duration. Traffic overlay does not make ETA live.
- Route pollution uses approximate coarse modeled conditions and must not be described as exact street pollution or health dose.
- Browser GPS requires permission, may be inaccurate and is not a certified real-time navigation system.
- Nearby Friends remains upcoming: no friend tracking has been added.

## Verification performed when packaged

TypeScript transpiler parsed all JSX/JS files. PostCSS parsed all CSS. Six existing routeAir unit tests passed. Source service/hash comparison confirmed API/geocoding/GPS/route-air calculations unchanged. npm install did not complete in the packaging environment, so production build and live browser/API checks still need to run on your local VS Code installation.
