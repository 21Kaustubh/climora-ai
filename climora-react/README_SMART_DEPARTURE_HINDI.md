# CLIMORA AI — Phase 6 / Smart Departure Advisor

This is an additive React frontend upgrade for the **premium React + Vite** edition.

## Your safest installation path (recommended)

1. Back up the existing folder `C:\Users\daksh\Downloads\1project\climora-react`.
2. Download `Climora_Smart_Departure_SRC.zip` and extract it.
3. Copy its entire `src` folder into `C:\Users\daksh\Downloads\1project\climora-react\`.
4. Confirm **Merge / Replace** for matching files. It adds:
   - `src/components/DepartureAdvisor.jsx`
   - `src/services/departure.js`
   - `src/departure.css`
   and fully replaces the three updated files:
   - `src/App.jsx`
   - `src/main.jsx`
   - `src/components/ExperienceHero.jsx`
5. Do **not** delete `.env.local`, `node_modules`, package.json, or the existing Google Maps key restrictions.
6. Do **not** update AWS Lambda, API Gateway, or ORS settings.
7. Open a terminal and run ONE COMMAND AT A TIME:

   ```powershell
   cd C:\Users\daksh\Downloads\1project\climora-react
   npm run dev
   ```

8. Open `http://127.0.0.1:5500/` and hard refresh (`Ctrl+Shift+R`).
9. Calculate Bandra -> Juhu in Car mode and scroll to **Smart Departure Advisor**.
10. Click `Now`, `+1h`, `+2h`, `+3h`, `+6h` to preview possible departure times. Try other journeys and modes.
11. After testing, check ignore rules: `git check-ignore climora-react/.env.local` and `git check-ignore climora-react/node_modules` from the `1project` root. If both are ignored:

   ```powershell
   git add climora-react/src climora-react/README_SMART_DEPARTURE_HINDI.md climora-react/tests/departure.test.mjs
   git status
   git commit -m "Add smart departure forecast advisor"
   git push origin main
   ```

**FULL ZIP alternative:** `Climora_Smart_Departure_FULL.zip` contains the complete `climora-react` project but **no private `.env.local` and no `node_modules`**. If using this package in a new folder, copy your own `.env.local` there yourself, run `npm install` and `npm run dev`. Avoid replacing your working root project or Git repository by accident.

## What it does

- Runs only AFTER an AWS route exists and uses the selected route's actual GeoJSON road geometry and duration.
- Samples five points along the route.
- Queries Open-Meteo hourly weather (`precipitation`, `temperature_2m`, `wind_speed_10m`).
- Queries Open-Meteo/CAMS global hourly modeled air (`pm2_5`, `us_aqi`).
- Compares departing **now, +1 hour, +2 hours, +3 hours, +6 hours**.
- Approximates forecast conditions at each point at the expected time the traveler passes it, assuming constant progress along the original route.
- Can suggest a *potentially* lower-PM slot only when modeled PM2.5 improves >=15% and >=3 µg/m³ without predicted rain worsening significantly; also can suggest a drier later slot if heavy forecast rain falls substantially while PM remains similar. Picks the **earliest** eligible slot.
- Does **not** hallucinate savings or recommend waiting when forecast difference is insignificant.
- Allows manual refresh, displays partial forecast data if a service fails, and leaves navigation functional even if both forecast APIs are unavailable.

## Important accuracy / safety limits

- This is a **forecast-based departure screening tool**, not a guarantee of lower personal exposure, safe weather, or health outcome.
- Open-Meteo air forecast (CAMS global) is coarse, roughly 45 km cells in this region. Nearby road streets cannot reliably be distinguished. Air forecasts may still vary **over time** in that shared region.
- Open-Meteo weather values likewise reflect model grids, not street-level measurements.
- PM2.5 × route duration is an informational proxy, **not inhaled dose**.
- Arrival time uses original OpenRouteService duration with same travel mode; it does NOT predict traffic congestion, accidents, or breaks at a future time.
- Clicking a departure card only previews weather/air and arrival-time estimates; **no booking, reminders, journey scheduling, or route changes occur**.
- For non-commercial or production use, verify API attribution, terms, pricing/rate limits and deploy/proxy requirements.

## Test automation (no API keys needed)

```powershell
cd C:\Users\daksh\Downloads\1project\climora-react
node --test tests\departure.test.mjs tests\routeAir.test.mjs
```

## Code preservation

The following existing frontend files are **byte-for-byte unchanged** compared to the premium Phase 5 baseline:
- `src/services/routing.js`
- `src/services/places.js`
- `src/services/environment.js`
- `src/services/routeAir.js`
- `src/lib/googleMap.js`
- `src/hooks/useGpsNavigation.js`
- `src/components/GoogleMapPanel.jsx`
- `src/components/GpsPanel.jsx`
- `src/components/PollutionIntelligence.jsx`

No AWS Lambda Python file is included or changed by this upgrade.
