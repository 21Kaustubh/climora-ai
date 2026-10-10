> **PHASE 5 UPDATE:** For route-wise pollution screening, see `README_PHASE5_HINDI.md`. This older document covers the base React/Vite migration.

# Climora AI — React.js + Vite Migration

This is a **real React migration** of the existing Climora AI frontend. It replaces the old direct-DOM `index.html` + `app.js` app with React components/hooks. The AWS Lambda route engine is **not changed**.

## What stays working

- Same Mumbai AWS API Gateway `/analyze-route` endpoint (POST) and same routing payload
- Real OpenRouteService road geometry, travel modes (Car, Bicycle, Walking, E-bike), distance, duration, route validation response
- Google Maps JavaScript API basemap, Satellite, traffic visual overlay, Street View and route selection
- Open-Meteo city/place search, picking map points, sample local routes
- GPS tracker: device speed, approximate remaining distance, steps, manual rerouting
- Modeled Open-Meteo US AQI/PM2.5, temperature and conditions
- Animated road lines, hero particles, route cards, circular AQI gauge, weather icons, GPS pulse
- Long-distance planner and Nearby Friends **Coming Soon** cards

Not included: live-traffic-adjusted travel time, Google Routes API, official road speed limits, background/voice navigation, friend tracking, actual road-specific pollution ranking. Showing a Google map **does not** change AWS/ORS distance and ETA.

## 1 — Backup your working project

Your old project was `C:\Users\daksh\Downloads\1project`. **First copy the entire folder somewhere safe**, e.g. `1project_backup`. Do not lose your existing `.git` folder or AWS Lambda files.

## 2 — Replace the frontend

Extract this ZIP. It contains `climora-react`.

- In your existing `1project` folder, **move its old `public` directory OUTSIDE the project** (for example into your backup). The old browser key config there must not be copied into a Vite production build.
- Copy all **contents** of this ZIP's `climora-react/` (including `src`, `index.html`, `package.json`, `vite.config.js`, `.env.example`, `.gitignore`) into `1project/` at the ROOT level.
- Keep your existing `api/` and `.git/` folders. Don't paste the React files into `public/`.
- If you already have a root `.gitignore`, merge the `.env*`, `node_modules/`, `dist/` exclusions rather than discarding other useful rules.

New layout:

```text
1project/
├── api/                         # Existing old repository code (unchanged)
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── styles.css
│   └── react.css
├── index.html                   # React/Vite root HTML
├── package.json
├── vite.config.js
├── .env.example
├── .env.local                   # You create this; NEVER commit it
└── .gitignore
```

## 3 — Configure Google Maps in `.env.local`

Create `1project/.env.local` (same folder as `package.json`), using this exact format:

```env
VITE_GOOGLE_MAPS_API_KEY=PASTE_YOUR_GOOGLE_MAPS_BROWSER_API_KEY
VITE_GOOGLE_MAP_ID=DEMO_MAP_ID
VITE_CLIMORA_API_URL=https://gbxdgy9b09.execute-api.ap-south-1.amazonaws.com/analyze-route
```

Get your **restricted** Google browser key from the existing `public/google-maps-config.js` in your backed-up project, or Google Cloud → APIs & Services → Credentials. **Do not send the key in chat.**

IMPORTANT: All `VITE_` environment variables are included in browser JavaScript and are NOT secret. Restrict the Google Maps key to:

- Application restrictions: Websites (HTTP referrers): `http://127.0.0.1:5500/*` and `http://localhost:5500/*` (include the bare origins if you get RefererNotAllowedMapError).
- API restrictions: Maps JavaScript API ONLY.
- Enable billing as required by Google Cloud; set spending alerts. Referrer restrictions and billing protect against unintended use; alerts do not cap spending.

The `.env.local` file is gitignored. If you previously committed a Google key, consider it disclosed and rotate it if necessary; deleting it in a new commit does not remove it from Git history.

## 4 — Start the React app

**STOP the old Live Server** first, otherwise Vite can't use port 5500.

Open the `1project` root in VS Code. In Terminal → New Terminal (PowerShell):

```powershell
node -v
npm -v
npm install
npm run dev
```

Install current Node.js LTS if `node` or `npm` is not recognized. Vite 6 supports Node 18+; recent Node 20/22 LTS recommended.

Open this exact URL:

```text
http://127.0.0.1:5500/
```

**Do NOT** open `file:///...`, `public/index.html`, or VS Code's Live Server. The React entry is the ROOT `index.html` and runs through Vite.

## 5 — Test the migration

1. Google Maps road map, Satellite and traffic buttons work.
2. Pick Bandra → Juhu; press **Calculate routes**; look for real lines, distance and time.
3. Select a route card; only its line should appear. Click **All routes** to restore.
4. Test Car then Bicycle and Walking (new queries, not same ETA).
5. Change a location using **Search** and choose a result (typing alone doesn't select coordinates).
6. Check AQI and weather after route analysis.
7. GPS tracking: for live GPS you need device permission. On PC the speed may be unavailable. Test safely off-road / as a passenger.
8. Check Upcoming cards for Long-distance and Nearby Friends.

`Route verification metadata unavailable` means the currently deployed Lambda is not returning the new `route_quality` fields; it is **not a React-specific error**. If roads and ETA appear but look suspicious, check AWS input coordinates and Lambda response; don't treat the result as exact.

For production, update API Gateway CORS for your new deployed **origin**, and add that origin to Google API key website restrictions.

## 6 — Test build and push GitHub

```powershell
npm run build
# After tests pass:
git status
git add -A
git commit -m "Migrate Climora frontend to React and Vite"
git push origin main
```

Only push after checking that **`.env.local` is not listed in `git status`**. Vite produces `dist/`, which is gitignored; deploy that directory using a static host. This React migration alone does not automatically update the old Hatchable live site.

## If something fails

- Blank site: press `F12` → Console and check Vite's terminal; don't open file://.
- `RefererNotAllowedMapError`: Cloud Console → correct Google key → website referrers for `127.0.0.1:5500` (not `file://`).
- `BillingNotEnabledMapError`: Maps JavaScript API project needs billing setup.
- `Google Maps key missing`: `.env.local` path must be alongside `package.json`, use `VITE_GOOGLE_MAPS_API_KEY`, restart `npm run dev`.
- `Port 5500 already in use`: Stop Live Server, other Vite terminal or change port **and** update CORS/key restrictions.
- `Failed to fetch` on routes: AWS API Gateway CORS/endpoint, network, or Lambda logs.
- Key exposed on GitHub: restrict and rotate the affected key.

## Development notes

All long-lived application data are held in React state; `GoogleMapPanel` uses a single imperative adapter only for the external Google Maps widget, and the `useGpsNavigation` hook manages device GPS subscriptions and cleanup. Routing, location search and environmental API requests are separated into `src/services`.
