# Climora AI — Phase 5: Route-wise Pollution Intelligence

**This is a complete React + Vite source project.** Google Maps, AWS/OpenRouteService routes, travel modes, GPS and existing endpoint AQI/weather remain in place. No Lambda redeployment, no new npm packages, no new API key are needed for this phase.

## Installation on Windows (existing project)

1. Back up `C:\Users\daksh\Downloads\1project\climora-react`.
2. Extract `Climora_AI_Phase5_Route_Pollution_Intelligence.zip`.
3. From the extracted `climora-react` folder, copy its **complete `src` folder** into `C:\Users\daksh\Downloads\1project\climora-react` and choose **Replace/Merge**. The ZIP includes the complete files (not patch snippets):
   - `src/App.jsx` — modified
   - `src/react.css` — modified
   - `src/components/PollutionIntelligence.jsx` — new
   - `src/services/routeAir.js` — new
   - All existing `src` files (Google Maps, route API, place search, GPS, AQI endpoints) — preserved.
4. DO NOT delete/change your current `climora-react/.env.local`, `node_modules`, or old `1project/public` folder. `.env.local` is intentionally NOT inside the ZIP.
5. In VS Code Terminal:

   ```powershell
   cd C:\Users\daksh\Downloads\1project\climora-react
   npm run dev
   ```

   If Vite is running, `Ctrl+C` to stop then restart it. If node_modules are missing, run `npm install` first. URL: **http://127.0.0.1:5500/** (no `/public/index.html`).

## Test (in browser)

1. Check Google map renders and Car mode remains selected.
2. Use preset **Bandra → Juhu**, click **Calculate routes**.
3. Below route cards look for **Pollution along your routes**.
4. Expect modeled PM2.5, time × PM2.5 exposure screening proxy, and maximum sampled US AQI. **For short Mumbai trips, the app will normally say 'No reliable cleaner-road distinction'. This is CORRECT, not a bug.** The CAMS global pollution grid across Maharashtra is about 45 km, not block-level.
5. Try **Andheri → Powai** and another journey; verify map routes and AWS distances do NOT change.
6. Click an air-route card and confirm the corresponding existing Google map route is selected.
7. If pollution API fails/limits are exceeded, a separate warning appears; AWS routing/distance/ETA and endpoint weather should continue working.
8. Optional unit test:

   ```powershell
   node --test tests/routeAir.test.mjs
   ```

## Interpretation / judging guidance

- **Distance & ETA:** unchanged ORS road measurements and predicted mode-specific travel times. No live traffic or stops.
- **'Mean modeled PM2.5':** trapezoidal average of forecast concentration along equally spaced geometric route samples, with expected travel time interpolated assuming uniform progress. It is not precise roadside pollution.
- **'Time × PM2.5 proxy':** mean modeled PM2.5 (µg/m³) × ORS trip duration (hours). Units µg·h/m³; useful as a simplified screening proxy, NOT measured exposure or inhaled dose. The method approximates actual segment speeds and does not model person-specific breathing rate.
- **'Peak sampled US AQI':** maximum of sampled model forecasts along that route. It is NOT India's official AQI.
- **A lower modeled proxy badge** appears ONLY when a detour is within your configured time limit, its modeled mean PM2.5 is >=10% and >=3 µg/m³ lower than the fastest, the time × PM2.5 proxy is >=8% lower, and the route visits meaningfully different model cells. These are conservative UI screening rules, not clinical advice.
- If the model grid cannot distinguish street-level differences, app explicitly says so; it NEVER fabricates a cleaner street.
- Model values depend on forecast updates, request time and API availability. The current version scores up to the first four routes and requests up to 9 geometric samples per route. It is intended for a prototype, not high-volume production.
- API attribution: **Open-Meteo** (https://open-meteo.com/en/docs/air-quality-api) and **Copernicus Atmosphere Monitoring Service (CAMS)** (https://atmosphere.copernicus.eu/). India's region uses CAMS global, about 0.4° / ~45km resolution, updated approximately twice daily.
- Check Open-Meteo's commercial/non-commercial terms before production deployment; protect the app from excessive repeated requests if publicly hosted.

## GitHub safely push

From `C:\Users\daksh\Downloads\1project`:

```powershell
git check-ignore climora-react/.env.local
git add climora-react/src climora-react/tests climora-react/README_PHASE5_HINDI.md
git status
git commit -m "Add route-wise pollution screening to Climora React"
git push origin main
```

**IMPORTANT:** `git check-ignore climora-react/.env.local` must print that path. Never commit your API key or `.env.local`.

## If you see any errors

- `Air-quality forecast API unavailable (429)` — the free provider is rate-limiting. Wait and retry once, not rapidly.
- `Environmental provider unavailable` — endpoint weather/AQI request failed; route comparison remains usable.
- `Google Maps key missing` — keep your existing `climora-react/.env.local` and restart Vite.
- `AWS request failed` — this is independent of the new pollution feature; check Lambda, API Gateway and CORS.
- `No reliable cleaner-road distinction` — a scientifically honest result for close parallel streets on coarse modeled grids.
