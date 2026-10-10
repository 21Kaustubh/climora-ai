import { useCallback, useEffect, useRef, useState } from 'react';
import GoogleMapPanel from './components/GoogleMapPanel.jsx';
import GpsPanel from './components/GpsPanel.jsx';
import EnvironmentCard from './components/EnvironmentCard.jsx';
import PollutionIntelligence from './components/PollutionIntelligence.jsx';
import { PRESETS, MODE_META, searchPlaces, isCoords, formatCoords, formatMinutes } from './services/places.js';
import { requestRoutes, googleDirectionsLink, nearbySearchLink } from './services/routing.js';
import { getEnvironmentalSnapshot } from './services/environment.js';
import { getRouteAirIntelligence } from './services/routeAir.js';

const PARTICLES = [
  [8,78,3,6.7,-2],[12,20,2,5.1,-1],[24,12,2,7.8,-5.4],
  [30,88,3,5.8,-3.7],[45,19,2,6.2,-1.3],[57,73,4,6.9,-4.7],
  [63,38,2,8.6,-3.5],[72,14,3,5.7,-3.3],[82,82,2,6.8,-1.4],
  [91,22,3,7,-6.1],[96,64,2,5.3,-3.1],[51,92,2,6.4,-4.1],
];
const initialStart = PRESETS['bandra-juhu'][0];
const initialEnd = PRESETS['bandra-juhu'][1];

function Header({connected}){
  return <header className="topbar">
    <a className="brand" href="#home" aria-label="Climora AI home"><span className="brand-glyph">✦</span> CLIMORA<span>AI</span></a>
    <nav className="nav-items" aria-label="Main navigation">
      <a href="#planner">Plan journey</a><a href="#comparison">Compare routes</a><a href="#navigation">GPS navigation</a><a href="#environment">Air &amp; weather</a><a href="#upcoming">Upcoming</a>
    </nav><span className={`service-state ${connected?'connected':''}`}>{connected?'● AWS route engine connected':'◌ Backend ready to test'}</span>
  </header>;
}
function Hero(){
  return <section id="home" className="hero wrap">
    <div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> SMART ROUTES · EVERYDAY JOURNEYS</div>
      <h1>Travel smarter.<br/><em>Breathe cleaner.</em></h1>
      <p>Compare real road routes by travel mode, view provider distance and travel-time estimates, follow GPS directions, and check modeled air quality and weather.</p>
      <a className="primary-cta" href="#planner">Explore real routes <span aria-hidden="true">↗</span></a>
    </div>
    <div className="hero-visual" aria-hidden="true"><div className="orbital orbit-1"/><div className="orbital orbit-2"/><div className="orbital orbit-3"/><div className="hero-pin">✦</div><span>CLIMORA / ROUTE INTELLIGENCE</span></div>
    {PARTICLES.map(([x,y,size,seconds,delay],i)=><span key={i} className="float-particle" aria-hidden="true" style={{'--px':`${x}%`,'--py':`${y}%`,'--ps':`${size}px`,'--pd':`${seconds}s`,'--delay':`${delay}s`}}/>)}
  </section>;
}
function LocationField({label,fieldId,text,place,onTextChange,onSearch,onSelect,results,searching,onPick,onMyLocation}){
  return <div className="location-group">
    <label htmlFor={fieldId}>{label}</label>
    <div className="search-row"><input id={fieldId} value={text} onChange={e=>onTextChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onSearch();}}} autoComplete="off"/>
      <button type="button" className="small-button" disabled={searching} onClick={onSearch}>{searching?'…':'Search'}</button></div>
    <div className="field-hint">{isCoords(place?.coords)?`✓ Selected · ${formatCoords(place.coords)}`:'Type a place, then select a result (or pick on map)'}</div>
    {!!results.length&&<div className="place-results" aria-label={`${label} matches`}>
      {results.map((p,i)=><button className="place-choice" key={`${p.name}-${i}`} type="button" onClick={()=>onSelect(p)}>{p.name}</button>)}
    </div>}
    <div className="micro-actions"><button type="button" onClick={onPick}>◎ Pick on map</button>
      {onMyLocation&&<button type="button" onClick={onMyLocation}>⌖ Use my location</button>}</div>
  </div>;
}
function RouteDetails({route,bestId,start,end,mode}){
  if(!route)return null;
  const fastest=String(route.id)===bestId;
  const within=route.within_time_limit!==false;
  const time=new Date(Date.now()+Number(route.duration_minutes)*60000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return <div className="route-details panel"><div className="detail-top"><div><p className="eyebrow">CURRENT ROUTE</p><h3>{route.name}</h3></div><span className="chip">{fastest?'FASTEST ESTIMATE':'ALTERNATIVE'}</span></div>
    <div className="detail-grid"><div><small>Estimated {MODE_META[mode]?.label||'journey'} time</small><strong>{formatMinutes(route.duration_minutes)}</strong></div>
      <div><small>Road distance</small><strong>{Number(route.distance_km).toFixed(2)} km</strong></div>
      <div><small>Arrival if leaving now</small><strong>{time}</strong></div></div>
    <p className="detail-note"><strong>Road-network checked:</strong> {route.quality_check==='passed'?'Provider route passed snapping and detour checks.':'Provider route; checks not reported.'} Start snap: {Number.isFinite(route.start_snap_m)?`${Math.round(route.start_snap_m)} m`:'not provided'}; destination snap: {Number.isFinite(route.end_snap_m)?`${Math.round(route.end_snap_m)} m`:'not provided'}.</p>
    <p className="detail-note">{fastest?'Fastest returned route estimate.':'Alternative road/path option.'} {within?'Within your selected detour limit.':'Long detour, exceeds your selected limit.'} Distances and duration come from the OpenRouteService {MODE_META[mode]?.label} profile. No live traffic or stops included. Modeled air screening, when available, is shown in the comparison section.</p>
    <div className="route-actions"><a href={googleDirectionsLink(start.coords,end.coords,mode)} target="_blank" rel="noopener noreferrer">↗ Open journey in Google Maps</a>
      <a href={nearbySearchLink('restaurants and snacks',end.name)} target="_blank" rel="noopener noreferrer">☕ Food near destination</a>
      <a href={nearbySearchLink('hotels and stays',end.name)} target="_blank" rel="noopener noreferrer">🛏 Stays near destination</a></div>
    {!!route.directions_preview?.length&&<details className="directions-preview"><summary>Preview road directions (first {Math.min(16,route.directions_preview.length)} steps)</summary><ol>{route.directions_preview.slice(0,16).map((step,i)=><li key={i}>{step.instruction} <small>({Number(step.distance_km||0).toFixed(2)} km)</small></li>)}</ol></details>}
    <p className="detail-note">Google Maps may calculate a different route/ETA. Food and stays are searches, not reservations.</p>
  </div>;
}

export default function App(){
  const [start,setStart]=useState(initialStart);
  const [end,setEnd]=useState(initialEnd);
  const [startText,setStartText]=useState(initialStart.name);
  const [endText,setEndText]=useState(initialEnd.name);
  const [startResults,setStartResults]=useState([]);
  const [endResults,setEndResults]=useState([]);
  const [searching,setSearching]=useState({start:false,end:false});
  const [mode,setMode]=useState('car');
  const [extraPercent,setExtraPercent]=useState('15');
  const [extraMinutes,setExtraMinutes]=useState('25');
  const [analysis,setAnalysis]=useState(null);
  const [selectedId,setSelectedId]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [env,setEnv]=useState({start:null,end:null});
  const [envLoading,setEnvLoading]=useState(false);
  const [routeAir,setRouteAir]=useState(null);
  const [routeAirLoading,setRouteAirLoading]=useState(false);
  const [routeAirError,setRouteAirError]=useState('');
  const [connected,setConnected]=useState(false);
  const requestSeq=useRef(0);
  const requestController=useRef(null);
  const searchesRef=useRef({start:0,end:0});
  const mapRef=useRef(null);

  const invalidate=useCallback(()=>{
    ++requestSeq.current;
    requestController.current?.abort();
    setAnalysis(null);setSelectedId(null);setLoading(false);
    setEnv({start:null,end:null});setEnvLoading(false);
    setRouteAir(null);setRouteAirLoading(false);setRouteAirError('');setError('');
  },[]);

  const pickPlace=useCallback((kind,place)=>{
    invalidate();
    if(kind==='start'){setStart(place);setStartText(place.name);setStartResults([]);}
    else{setEnd(place);setEndText(place.name);setEndResults([]);}
  },[invalidate]);

  const typedPlace=useCallback((kind,value)=>{
    invalidate();
    searchesRef.current[kind]++;
    setSearching(s=>({...s,[kind]:false}));
    if(kind==='start'){setStart({name:value,coords:null});setStartText(value);setStartResults([]);}
    else{setEnd({name:value,coords:null});setEndText(value);setEndResults([]);}
  },[invalidate]);

  const lookup=useCallback(async kind=>{
    const query=kind==='start'?startText:endText;
    const seq=++searchesRef.current[kind];
    setError('');setSearching(s=>({...s,[kind]:true}));
    try{
      const found=await searchPlaces(query);
      if(seq!==searchesRef.current[kind])return;
      if(kind==='start')setStartResults(found);
      else setEndResults(found);
      if(!found.length)setError('No locations found. Try a nearby town or pick on the map.');
    }catch(err){if(seq===searchesRef.current[kind])setError(err.message);}
    finally{if(seq===searchesRef.current[kind])setSearching(s=>({...s,[kind]:false}));}
  },[startText,endText]);

  const preset=useCallback(key=>{
    const pair=PRESETS[key];if(!pair)return;
    invalidate();setStart(pair[0]);setEnd(pair[1]);setStartText(pair[0].name);setEndText(pair[1].name);
    setStartResults([]);setEndResults([]);
    document.getElementById('planner')?.scrollIntoView({behavior:'smooth'});
  },[invalidate]);

  const calculate=useCallback(async(customStart)=>{
    setError('');
    const startLocation=customStart||start;
    if(!isCoords(startLocation.coords)||!isCoords(end.coords)){
      setError('Please search and select both locations, or choose them on the map.');return;
    }
    if(startLocation.coords.every((v,i)=>v===end.coords[i])){setError('Start and destination cannot be identical.');return;}
    const percent=Number(extraPercent),minutes=Number(extraMinutes);
    if(!Number.isFinite(percent)||!Number.isFinite(minutes)||percent<0||minutes<0){
      setError('Enter valid non-negative extra-time limits.');return;
    }
    const seq=++requestSeq.current;
    requestController.current?.abort();
    const controller=new AbortController();requestController.current=controller;
    setLoading(true);setAnalysis(null);setSelectedId(null);setEnv({start:null,end:null});setEnvLoading(false);
    setRouteAir(null);setRouteAirLoading(false);setRouteAirError('');
    try{
      const result=await requestRoutes({start:startLocation.coords,end:end.coords,travelMode:mode,maxExtraPercent:percent,maxExtraMinutes:minutes},controller.signal);
      if(seq!==requestSeq.current)return;
      setAnalysis({...result,start:startLocation,end,mode});
      setConnected(true);
      setLoading(false);
      setEnvLoading(true);
      setRouteAirLoading(true);
      document.getElementById('comparison')?.scrollIntoView({behavior:'smooth',block:'start'});
      // Route screening is optional: do not block or alter the existing
      // endpoint AQI/weather dashboard or any AWS routing results.
      void getRouteAirIntelligence(result.routes, result.bestId,controller.signal)
        .then(data=>{if(seq===requestSeq.current)setRouteAir(data);})
        .catch(err=>{if(seq===requestSeq.current&&err.name!=='AbortError')setRouteAirError(err.message||'Forecast service unreachable');})
        .finally(()=>{if(seq===requestSeq.current)setRouteAirLoading(false);});
      const [a,b]=await Promise.allSettled([
        getEnvironmentalSnapshot(startLocation.coords,controller.signal),
        getEnvironmentalSnapshot(end.coords,controller.signal),
      ]);
      if(seq!==requestSeq.current)return;
      setEnv({start:a.status==='fulfilled'?a.value:null,end:b.status==='fulfilled'?b.value:null});
    }catch(err){
      if(seq!==requestSeq.current||err.name==='AbortError')return;
      console.error('Climora routing error:',err);
      setError(err.message==='Failed to fetch'? 'AWS request failed. Check API Gateway CORS for http://127.0.0.1:5500 and network connectivity.':err.message);
    }finally{if(seq===requestSeq.current){setLoading(false);setEnvLoading(false);}}
  },[start,end,mode,extraPercent,extraMinutes]);

  const handleMyLocation=useCallback(()=>{
    if(!navigator.geolocation){setError('This browser does not support GPS location.');return;}
    navigator.geolocation.getCurrentPosition(p=>pickPlace('start',{name:'My current location',coords:[p.coords.longitude,p.coords.latitude]}),
      ()=>setError('Could not access your location. You can pick a point on the map.'),
      {enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  },[pickPlace]);

  const handleReroute=useCallback(coords=>{
    const place={name:'My current GPS location',coords};
    pickPlace('start',place);
    void calculate(place);
  },[pickPlace,calculate]);

  useEffect(()=>()=>{requestController.current?.abort();},[]);
  const visibleRoute=analysis?.routes.find(r=>String(r.id)===String(selectedId||analysis.bestId))||null;
  const detailsRoute=visibleRoute;
  const activeMode=analysis?.mode||mode;
  return <>
    <Header connected={connected}/><main><Hero/>
      <section id="planner" className="wrap planner-section">
        <div className="section-top"><div><p className="eyebrow">01 / ROUTE PLANNER</p><h2>Where are we going?</h2><p className="section-sub">Explore mapped roads across Maharashtra. Search a town, select a real location, or pin precise road start/end points. Distances are provider-measured, not straight-line guesses.</p></div><span className="chip">EVERYDAY ROUTING</span></div>
        <div className="quick-trip-row" aria-label="Sample local journeys"><strong>Test local journeys</strong>{Object.keys(PRESETS).map(key=><button key={key} type="button" onClick={()=>preset(key)}>{key==='bandra-juhu'?'Bandra → Juhu':key==='andheri-powai'?'Andheri → Powai':'Dadar → CSMT'}</button>)}</div>
        <div className="planner-grid">
          <aside className="panel control-panel"><form noValidate onSubmit={e=>{e.preventDefault();void calculate();}}>
            <fieldset className="travel-modes"><legend>Travel mode</legend><div className="mode-grid">
              {Object.entries(MODE_META).map(([id,item])=><label className="mode-option" key={id}><input type="radio" name="travelMode" value={id} checked={mode===id} onChange={()=>{setMode(id);invalidate();}}/><span>{item.emoji} {item.label}</span></label>)}
            </div><p className="mode-note" role="status">{MODE_META[mode].notice}</p><p className="mode-unsupported">Motorcycle and public transport need different routing providers — not available yet.</p></fieldset>
            <LocationField label="Starting point" fieldId="from" text={startText} place={start} onTextChange={v=>typedPlace('start',v)} onSearch={()=>lookup('start')} onSelect={p=>pickPlace('start',p)} results={startResults} searching={searching.start} onPick={()=>mapRef.current?.enablePointPicking('start')} onMyLocation={handleMyLocation}/>
            <LocationField label="Destination" fieldId="to" text={endText} place={end} onTextChange={v=>typedPlace('end',v)} onSearch={()=>lookup('end')} onSelect={p=>pickPlace('end',p)} results={endResults} searching={searching.end} onPick={()=>mapRef.current?.enablePointPicking('end')}/>
            <div className="limits"><div><label htmlFor="extraPercent">Max extra time (%)</label><input id="extraPercent" type="number" min="0" max="100" value={extraPercent} onChange={e=>{setExtraPercent(e.target.value);invalidate();}}/></div>
              <div><label htmlFor="extraMinutes">Max extra (min)</label><input id="extraMinutes" type="number" min="0" max="180" value={extraMinutes} onChange={e=>{setExtraMinutes(e.target.value);invalidate();}}/></div></div>
            <button className="primary-action" type="submit" disabled={loading}><span>{MODE_META[mode].emoji}</span> {loading?'Calculating…':'Calculate routes'}</button>
          </form>
            {loading&&<div className="loading"><span className="spin"/><span><strong>Calculating journeys</strong><small>Connecting to AWS route engine…</small></span></div>}
            {!!error&&<div className="error-box" role="alert">{error}</div>}
            <div className="panel-foot"><strong>Provider-based estimates</strong><p>Distance and ETA are returned by OpenRouteService. The backend can reject suspicious nearby detours or badly snapped pins. ETA excludes live traffic and breaks. Choose exact road entry/exit points for greater accuracy.</p></div>
          </aside>
          <GoogleMapPanel start={start} end={end} analysis={analysis} mapRef={mapRef} onError={setError} onPick={(kind,coords)=>pickPlace(kind,{name:`Pinned location (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`,coords})} onSelect={setSelectedId}/>
        </div>
      </section>
      <section id="comparison" className="wrap comparison-section">
        <div className="section-top"><div><p className="eyebrow">02 / ROUTE COMPARISON</p><h2>Choose your route</h2><p className="section-sub">Select one route to view its line on Google Maps. Choose “All routes” to compare. Routes above the detour limit are marked.</p></div><span className="chip">{analysis?.routes.length||0} ROUTE(S)</span></div>
        {analysis&&<><div className="routing-notice">{MODE_META[analysis.mode].label} mode · Provider road distance (not straight-line) and estimated travel time. {analysis.body.maximum_allowed_minutes?`Time limit: ${formatMinutes(analysis.body.maximum_allowed_minutes)}. `:''}No live traffic or stops included.</div>
          <div className="routing-notice route-verification" role="status">{analysis.body.route_quality?.status==='passed'?`✓ Route checks passed: snapping, endpoints and detour sanity. ${analysis.body.route_quality.hidden_anomalies||0} suspect route(s) hidden.`:'Route verification metadata unavailable: check whether the latest AWS Lambda is deployed.'}</div></>}
        <div className="route-cards">{!analysis?.routes.length?<div className="empty-state">{loading?'Requesting roads from AWS Lambda…':'Calculate a journey to compare verified road routes. No fake kilometres are shown.'}</div>:
          analysis.routes.map((r,i)=>{
            const id=String(r.id);const isSelected=id===selectedId;const isBest=id===analysis.bestId;
            const color=mapRef.current?.getRouteColor(id)||['#36dea2','#a990fa','#f2ad57','#5db8fa','#ff819d'][i%5];
            return <button className={`route-card route-enter ${isSelected?'selected':''}`} style={{'--route-color':color,'--enter-delay':`${i*85}ms`}} type="button" key={id} onClick={()=>mapRef.current?.selectRoute(id)}>
              <span className="route-name"><i/>{r.name}</span><span className="route-time">{formatMinutes(r.duration_minutes)}</span><span className="route-distance">{Number(r.distance_km).toFixed(2)} km</span>
              <span className="route-tag">{isBest?'FASTEST':r.route_preference==='shortest'?'SHORTEST':'ALTERNATIVE'}</span>{routeAir?.recommendationId===id&&<span className="route-tag air-tag">LOWER MODELED PROXY</span>}{r.within_time_limit===false&&<span className="route-tag late">LONG DETOUR</span>}{isSelected&&<span className="route-tag">SELECTED</span>}
            </button>;
          })}
        </div>
        <PollutionIntelligence analysis={analysis} result={routeAir} loading={routeAirLoading} error={routeAirError} selectedId={selectedId||analysis?.bestId} onSelect={id=>mapRef.current?.selectRoute(id)}/>
        {analysis&&<RouteDetails route={detailsRoute} bestId={analysis.bestId} start={analysis.start} end={analysis.end} mode={activeMode}/>}
      </section>
      <GpsPanel route={visibleRoute} mode={activeMode} mapRef={mapRef} onReroute={handleReroute}/>
      <section id="environment" className="wrap environment-section"><div className="section-top"><div><p className="eyebrow">04 / ENVIRONMENTAL SNAPSHOT</p><h2>Air &amp; weather on your journey</h2><p className="section-sub">Current modeled environmental conditions at your selected start and destination.</p></div><span className="chip">OPEN-METEO DATA</span></div>
        <div className="environment-grid"><EnvironmentCard label="○ STARTING POINT" name={analysis?.start.name||start.name} result={env.start} loading={envLoading} attempted={Boolean(analysis)}/><EnvironmentCard label="◇ DESTINATION" name={analysis?.end.name||end.name} result={env.end} loading={envLoading} attempted={Boolean(analysis)}/></div>
        <p className="environment-disclaimer">US AQI uses the US scale (not India's official AQI). PM2.5, AQI and weather are modeled location-level data, not street-level sensors. Climora samples these coarse forecasts along routes for informational screening, but cannot guarantee a cleaner street.</p>
      </section>
      <section id="upcoming" className="wrap upcoming-section"><div className="section-top"><div><p className="eyebrow">05 / ROADMAP</p><h2>Upcoming features</h2><p className="section-sub">Everyday routing first; these features are planned, not active.</p></div><span className="chip">COMING SOON</span></div>
        <div className="upcoming-grid"><article className="panel upcoming-card"><span className="upcoming-symbol" aria-hidden="true">🛣️</span><span className="upcoming-status">PLANNED · NOT ACTIVE</span><h3>Long-distance trip planner</h3><p>Dedicated multi-city trips, via-corridors and detailed highway stops. Regular routes remain available where supported.</p></article>
          <article className="panel upcoming-card"><span className="upcoming-symbol" aria-hidden="true">📍</span><span className="upcoming-status">PLANNED · NOT ACTIVE</span><h3>Nearby Friends</h3><p>Mutual opt-in location sharing, invitations and expiry. No friend's location is currently collected or shown.</p></article></div>
      </section>
    </main><footer className="footer">Climora AI · React · Vite · AWS Lambda · OpenRouteService · Google Maps · Open-Meteo <span>Non-commercial hackathon prototype</span></footer>
  </>;
}
