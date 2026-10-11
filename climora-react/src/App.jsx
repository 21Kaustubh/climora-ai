import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GoogleMapPanel from './components/GoogleMapPanel.jsx';
import GpsPanel from './components/GpsPanel.jsx';
import EnvironmentCard from './components/EnvironmentCard.jsx';
import PollutionIntelligence from './components/PollutionIntelligence.jsx';
import DepartureAdvisor from './components/DepartureAdvisor.jsx';
import AuthModal from './components/AuthModal.jsx';
import AccountPanel from './components/AccountPanel.jsx';
import EntryGate from './components/EntryGate.jsx';
import TravelTools from './components/TravelTools.jsx';
import './travelTools.css';
import { restoreSession, signOut } from './auth/cognito.js';
import { SiteHeader, ExperienceHero, CapabilitiesStrip } from './components/ExperienceHero.jsx';
import { PRESETS, MODE_META, searchPlaces, resolvePlaceSuggestion, isCoords, formatCoords, formatMinutes } from './services/places.js';
import { requestRoutes, googleDirectionsLink, nearbySearchLink } from './services/routing.js';
import { getEnvironmentalSnapshot } from './services/environment.js';
import { getRouteAirIntelligence } from './services/routeAir.js';
import { applyRouteGuardrails, prioritizeRoutes, ROUTE_POLICY } from './services/routePriority.js';
import { emptyUserProfile, isProfileApiConfigured, fetchUserProfile, putPlace, deleteUserProfile } from './services/userProfile.js';

const initialStart = PRESETS['bandra-juhu'][0];
const initialEnd = PRESETS['bandra-juhu'][1];

function LocationField({label,fieldId,text,place,onTextChange,onSearch,onSelect,results,searching,onPick,onMyLocation}){
  return <div className="location-group">
    <label htmlFor={fieldId}>{label}</label>
    <div className="search-row"><input id={fieldId} value={text} onChange={e=>onTextChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onSearch();}}} autoComplete="off"/>
      <button type="button" className="small-button" disabled={searching} onClick={onSearch}>{searching?'…':'Search'}</button></div>
    <div className="field-hint">{isCoords(place?.coords)?`✓ Selected · ${formatCoords(place.coords)}`:'Type a place, then select a result (or pick on map)'}</div>
    {!!results.length&&<div className="place-results" aria-label={`${label} Google Places matches`}>
      {results.map((p,i)=><button className="place-choice" key={`${p.name}-${i}`} type="button" onClick={()=>onSelect(p)}>{p.name}{p.source==='town_fallback'?' (town/city only)':''}</button>)}
    </div>}
    <p className="cx-search-tip">Search buildings, societies, offices, stations or area names. Select a suggestion to set exact coordinates.</p>
    <div className="micro-actions"><button type="button" onClick={onPick}>◎ Pick on map</button>
      {onMyLocation&&<button type="button" onClick={onMyLocation}>⌖ Use my location</button>}</div>
  </div>;
}
function RouteDetails({route,primaryId,fastestId,usingAqi,start,end,mode}){
  if(!route)return null;
  const primary=String(route.id)===String(primaryId);
  const fastest=String(route.id)===String(fastestId);
  const within=route.within_time_limit!==false;
  const time=new Date(Date.now()+Number(route.duration_minutes)*60000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return <div className="route-details panel"><div className="detail-top"><div><p className="eyebrow">CURRENT ROUTE</p><h3>{route.name}</h3></div><span className="chip">{primary?(usingAqi?'AQI-FIRST PICK':'FASTEST ELIGIBLE'):(fastest?'FASTEST OPTION':'ALTERNATIVE')}</span></div>
    <div className="detail-grid"><div><small>{route.traffic_aware?'Traffic-aware predicted driving time':`Estimated ${MODE_META[mode]?.label||'journey'} time`}</small><strong>{formatMinutes(route.duration_minutes)}</strong></div>
      <div><small>Road distance</small><strong>{Number(route.distance_km).toFixed(2)} km</strong></div>
      <div><small>Arrival if leaving now</small><strong>{time}</strong></div></div>
    <p className="detail-note"><strong>Road-network source:</strong> {route.traffic_aware?'Google Maps traffic-aware road geometry. A building location may snap to a nearby road rather than its actual entrance.':`${route.quality_check==='passed'?'Provider route passed snapping and detour checks.':'Provider route; checks not reported.'} Start snap: ${Number.isFinite(route.start_snap_m)?`${Math.round(route.start_snap_m)} m`:'not provided'}; destination snap: ${Number.isFinite(route.end_snap_m)?`${Math.round(route.end_snap_m)} m`:'not provided'}.`}</p>
    <p className="detail-note">{fastest?'Fastest eligible provider route.':'Other eligible road/path option.'} {within?'Within your selected detour limit.':'Long detour, exceeds your selected limit.'} {route.traffic_aware?'Road geometry, distance and predicted drive time come from Google Maps traffic-aware routing at calculation time. Real congestion can change; this is not a live-updating guarantee. Stops are excluded.':'Road geometry, distance and estimated time come from OpenRouteService (no live traffic).'} Modeled air screening is shown in the comparison section.</p>
    {route.traffic_aware&&<p className="cx-traffic-freshness">⏱ Traffic ETA checked {route.eta_updated_at?new Date(route.eta_updated_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'recently'}{Number.isFinite(route.static_duration_minutes)?` · Google historical-time baseline ${formatMinutes(route.static_duration_minutes)}`:''}. To refresh traffic, calculate routes again.</p>}
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
  const [extraMinutes,setExtraMinutes]=useState('10');
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
  const [profile,setProfile]=useState(null);
  const [access,setAccess]=useState('checking');
  const [authOpen,setAuthOpen]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const [myPlaces,setMyPlaces]=useState(emptyUserProfile);
  const [myPlacesLoading,setMyPlacesLoading]=useState(false);
  const [myPlacesError,setMyPlacesError]=useState('');
  const requestSeq=useRef(0);
  const requestController=useRef(null);
  const searchesRef=useRef({start:0,end:0});
  const mapRef=useRef(null);

  // A returning, signed-in Cognito user skips the entry gate. A guest must
  // explicitly choose Guest Mode once per browser tab (sessionStorage).
  // Nothing from the main planner/map is mounted until access is chosen.
  useEffect(()=>{
    let active=true;
    const fallback=()=>{
      try{return sessionStorage.getItem('climora_entry_guest_v1')==='yes'?'guest':'gate';}
      catch{return 'gate';}
    };
    void restoreSession().then(account=>{
      if(!active)return;
      setProfile(account);
      setAccess(account?'member':fallback());
    }).catch(()=>{if(active)setAccess(fallback());});
    return()=>{active=false;};
  },[]);
  const enterAsGuest=useCallback(()=>{
    try{sessionStorage.setItem('climora_entry_guest_v1','yes');}catch{}
    setAuthOpen(false);
    setProfile(null);setMyPlaces(emptyUserProfile());setMyPlacesError('');
    setAccess('guest');
  },[]);
  const handleAuthenticated=useCallback(account=>{
    try{sessionStorage.removeItem('climora_entry_guest_v1');}catch{}
    setProfile(account);
    setMyPlaces(emptyUserProfile());setMyPlacesError('');
    setAccess('member');
    setAuthOpen(false);
    setAccountOpen(true);
  },[]);
  const logout=useCallback(()=>{
    signOut();
    try{sessionStorage.removeItem('climora_entry_guest_v1');}catch{}
    // Clear previously displayed routes and forecast data on sign-out.
    ++requestSeq.current;
    requestController.current?.abort();
    setAnalysis(null);setSelectedId(null);setError('');setEnv({start:null,end:null});
    setRouteAir(null);setRouteAirError('');
    setLoading(false);setEnvLoading(false);setRouteAirLoading(false);
    setStart(initialStart);setEnd(initialEnd);
    setStartText(initialStart.name);setEndText(initialEnd.name);
    setProfile(null);setMyPlaces(emptyUserProfile());setMyPlacesError('');setAccountOpen(false);setAuthOpen(false);setAccess('gate');
  },[]);

  // Load only this authenticated user's personal places; never fetch for guests.
  useEffect(()=>{
    let active=true;
    setMyPlaces(emptyUserProfile());setMyPlacesError('');
    if(access!=='member'||!profile?.id||!isProfileApiConfigured){setMyPlacesLoading(false);return()=>{active=false;};}
    setMyPlacesLoading(true);
    void fetchUserProfile().then(data=>{if(active)setMyPlaces(data);})
      .catch(err=>{if(active)setMyPlacesError(err.message||'Could not load your cloud profile.');})
      .finally(()=>{if(active)setMyPlacesLoading(false);});
    return()=>{active=false;};
  },[access,profile?.id]);

  const reloadMyPlaces=useCallback(async()=>{
    if(!isProfileApiConfigured)return;
    setMyPlacesLoading(true);setMyPlacesError('');
    try{setMyPlaces(await fetchUserProfile());}
    catch(err){setMyPlacesError(err.message||'Cloud profile could not be loaded.');}
    finally{setMyPlacesLoading(false);}
  },[]);
  const saveMyPlace=useCallback(async(slot,place)=>{
    // Failure must be visible; do not pretend private addresses were saved.
    const updated=await putPlace(myPlaces,slot,place);
    setMyPlaces(updated);setMyPlacesError('');return updated;
  },[myPlaces]);
  const clearMyPlaces=useCallback(async()=>{
    const updated=await deleteUserProfile();
    setMyPlaces(updated);setMyPlacesError('');return updated;
  },[]);

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
      const found=await searchPlaces(query,undefined,kind);
      if(seq!==searchesRef.current[kind])return;
      if(kind==='start')setStartResults(found);
      else setEndResults(found);
      if(!found.length)setError('No locations found. Try a nearby town or pick on the map.');
    }catch(err){if(seq===searchesRef.current[kind])setError(err.message);}
    finally{if(seq===searchesRef.current[kind])setSearching(s=>({...s,[kind]:false}));}
  },[startText,endText]);

  const selectSearchedPlace=useCallback(async (kind,suggestion)=>{
    const seq=++searchesRef.current[kind];
    setSearching(s=>({...s,[kind]:true}));
    setError('');
    try{
      const resolved=await resolvePlaceSuggestion(suggestion,kind);
      if(seq===searchesRef.current[kind])pickPlace(kind,resolved);
    }catch(err){if(seq===searchesRef.current[kind])setError(err?.message||'Unable to resolve this building or address.');}
    finally{if(seq===searchesRef.current[kind])setSearching(s=>({...s,[kind]:false}));}
  },[pickPlace]);

  // Debounced Google Places suggestions; prevents requests on every keystroke.
  useEffect(()=>{
    if(access==='checking'||access==='gate'||isCoords(start.coords)||startText.trim().length<3)return;
    const timer=setTimeout(()=>{void lookup('start');},550);
    return()=>clearTimeout(timer);
  },[startText,start.coords,lookup,access]);
  useEffect(()=>{
    if(access==='checking'||access==='gate'||isCoords(end.coords)||endText.trim().length<3)return;
    const timer=setTimeout(()=>{void lookup('end');},550);
    return()=>clearTimeout(timer);
  },[endText,end.coords,lookup,access]);

  const planToMyPlace=useCallback(place=>{
    if(!place?.coords)return;
    pickPlace('end',place);
    document.getElementById('planner')?.scrollIntoView({behavior:'smooth',block:'start'});
  },[pickPlace]);
  const quickCommute=useCallback(slot=>{
    const home=myPlaces?.places?.home;
    const destination=myPlaces?.places?.[slot];
    if(!home?.coords||!destination?.coords)return;
    invalidate();setStart(home);setEnd(destination);
    setStartText(home.name);setEndText(destination.name);
    setStartResults([]);setEndResults([]);
    document.getElementById('planner')?.scrollIntoView({behavior:'smooth',block:'start'});
  },[invalidate,myPlaces]);

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
      const result=await requestRoutes({start:startLocation.coords,end:end.coords,travelMode:mode,maxExtraPercent:Math.min(percent,ROUTE_POLICY.maxExtraTimePct),maxExtraMinutes:Math.min(minutes,ROUTE_POLICY.maxExtraMinutes)},controller.signal);
      if(seq!==requestSeq.current)return;
      // Hard distance/time filter BEFORE AQI sampling and BEFORE map drawing.
      const guardrails=applyRouteGuardrails(result.routes, percent, minutes);
      const screened={...result, routes:guardrails.eligible, bestId:guardrails.fastestId,
        start:startLocation, end, mode, guardrails};
      setAnalysis(screened);
      setConnected(true);
      setLoading(false);
      setEnvLoading(true);
      setRouteAirLoading(guardrails.eligible.length > 0);
      document.getElementById('comparison')?.scrollIntoView({behavior:'smooth',block:'start'});
      if (guardrails.eligible.length) {
        // Forecast screening is optional. The actual road geometry, ETA and
        // AWS routing call are unchanged. Never fabricate air values.
        void getRouteAirIntelligence(guardrails.eligible, guardrails.fastestId,controller.signal)
          .then(data=>{
            if(seq!==requestSeq.current)return;
            setRouteAir(data);
            if(data.status==='lower-modelled-aqi' && data.recommendationId)
              setSelectedId(String(data.recommendationId));
          })
          .catch(err=>{if(seq===requestSeq.current&&err.name!=='AbortError')setRouteAirError(err.message||'Forecast service unreachable');})
          .finally(()=>{if(seq===requestSeq.current)setRouteAirLoading(false);});
      }
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

  useEffect(()=>{
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const targets = Array.from(document.querySelectorAll('[data-reveal]'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting){entry.target.classList.add('cx-is-visible');observer.unobserve(entry.target);}
    }), {threshold:0.05,rootMargin:'0px 0px -36px 0px'});
    targets.forEach(target=>observer.observe(target));
    document.documentElement.classList.add('cx-motion-enabled');
    return ()=>{observer.disconnect();document.documentElement.classList.remove('cx-motion-enabled');};
  },[access]);
  useEffect(()=>()=>{requestController.current?.abort();},[]);
  const ranked=useMemo(()=>prioritizeRoutes(analysis?.routes,analysis?.bestId,routeAir),[analysis,routeAir]);
  const displayedAnalysis=useMemo(()=>analysis?{...analysis,routes:ranked.routes,bestId:ranked.primaryId}:null,[analysis,ranked]);
  const visibleRoute=displayedAnalysis?.routes.find(r=>String(r.id)===String(selectedId||ranked.primaryId))||null;
  const detailsRoute=visibleRoute;
  const activeMode=analysis?.mode||mode;
  const trafficRoute=Boolean(analysis?.trafficAware&&activeMode==='car');

  // Only the choice screen mounts before a successful Cognito restore/sign-in
  // or an explicit guest selection. Neither map nor routing components render.
  if(access==='checking') return <div className="cx-entry-loading" role="status" aria-live="polite"><span className="cx-entry-loading-mark">✦</span><strong>CLIMORA AI</strong><span>Checking your session…</span></div>;
  if(access==='gate') return <>
    <EntryGate onSignIn={()=>setAuthOpen(true)} onGuest={enterAsGuest}/>
    <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onContinueGuest={enterAsGuest} onAuthenticated={handleAuthenticated}/>
  </>;
  return <>
    <SiteHeader connected={connected} profile={profile} onOpenAuth={()=>setAuthOpen(true)} onOpenAccount={()=>setAccountOpen(true)}/><main><ExperienceHero/><CapabilitiesStrip/>
      <section id="planner" className="wrap planner-section cx-section" data-reveal="">
        <div className="section-top"><div><p className="eyebrow">01 <span className="cx-eyebrow-slash">/</span> YOUR JOURNEY, REIMAGINED</p><h2>Where will life take you <em>today?</em></h2><p className="section-sub">Explore mapped roads across Maharashtra. Search a town, select a real location, or pin precise road start/end points. Distances are provider-measured, not straight-line guesses.</p></div><span className="chip cx-section-chip">◉ &nbsp; PERSONAL ROUTE STUDIO</span></div>
        <div className="quick-trip-row" aria-label="Sample local journeys"><strong>QUICK START &nbsp; ↗</strong>{Object.keys(PRESETS).map(key=><button key={key} type="button" onClick={()=>preset(key)}>{key==='bandra-juhu'?'Bandra → Juhu':key==='andheri-powai'?'Andheri → Powai':'Dadar → CSMT'}</button>)}</div>
        {access==='member'&&<div className="cx-commute-shortcuts" aria-label="Your private everyday places">
          <span className="cx-commute-kicker">⌂ MY PLACES</span>
          {myPlaces?.places?.home&&myPlaces?.places?.work&&<button type="button" onClick={()=>quickCommute('work')}>Home → Work ↗</button>}
          {myPlaces?.places?.home&&myPlaces?.places?.school&&<button type="button" onClick={()=>quickCommute('school')}>Home → School ↗</button>}
          {myPlaces?.places?.home&&<button type="button" onClick={()=>planToMyPlace(myPlaces.places.home)}>Go Home</button>}
          {myPlaces?.places?.work&&<button type="button" onClick={()=>planToMyPlace(myPlaces.places.work)}>Go Work</button>}
          {myPlaces?.places?.school&&<button type="button" onClick={()=>planToMyPlace(myPlaces.places.school)}>Go School</button>}
          <button type="button" className="cx-commute-manage" onClick={()=>setAccountOpen(true)}>⚙ Manage My Places</button>
        </div>}
        <div className="planner-grid">
          <aside className="panel control-panel"><div className="cx-control-heading"><span className="cx-form-symbol">⌖</span><div><h3>Craft your journey</h3><p>Choose how you want to explore</p></div><span className="cx-form-live" aria-label="Real routing available"/></div><form noValidate onSubmit={e=>{e.preventDefault();void calculate();}}>
            <fieldset className="travel-modes"><legend>Travel mode</legend><div className="mode-grid">
              {Object.entries(MODE_META).map(([id,item])=><label className="mode-option" key={id}><input type="radio" name="travelMode" value={id} checked={mode===id} onChange={()=>{setMode(id);invalidate();}}/><span>{item.emoji} {item.label}</span></label>)}
            </div><p className="mode-note" role="status">{MODE_META[mode].notice}</p><p className="mode-unsupported">Motorcycle and public transport need different routing providers — not available yet.</p></fieldset>
            <LocationField label="Starting point" fieldId="from" text={startText} place={start} onTextChange={v=>typedPlace('start',v)} onSearch={()=>lookup('start')} onSelect={p=>{void selectSearchedPlace('start',p);}} results={startResults} searching={searching.start} onPick={()=>mapRef.current?.enablePointPicking('start')} onMyLocation={handleMyLocation}/>
            <LocationField label="Destination" fieldId="to" text={endText} place={end} onTextChange={v=>typedPlace('end',v)} onSearch={()=>lookup('end')} onSelect={p=>{void selectSearchedPlace('end',p);}} results={endResults} searching={searching.end} onPick={()=>mapRef.current?.enablePointPicking('end')}/>
            <div className="limits"><div><label htmlFor="extraPercent">Max extra time (%)</label><input id="extraPercent" type="number" min="0" max="15" value={extraPercent} onChange={e=>{setExtraPercent(e.target.value);invalidate();}}/></div>
              <div><label htmlFor="extraMinutes">Max extra (min)</label><input id="extraMinutes" type="number" min="0" max="10" value={extraMinutes} onChange={e=>{setExtraMinutes(e.target.value);invalidate();}}/></div></div>
            <p className="cx-aqi-limit-note">✦ AQI-first, only within <b>{ROUTE_POLICY.maxExtraDistancePct}% extra distance</b> and at most <b>{ROUTE_POLICY.maxExtraTimePct}% / {ROUTE_POLICY.maxExtraMinutes} min</b> extra time. Lower limits you set are respected.</p>
            <button className="primary-action" type="submit" disabled={loading}><span>{MODE_META[mode].emoji}</span> {loading?'Calculating…':'Calculate routes'}</button>
          </form>
            {loading&&<div className="loading"><span className="spin"/><span><strong>Calculating journeys</strong><small>Requesting real roads, traffic-aware ETA when available…</small></span></div>}
            {!!error&&<div className="error-box" role="alert">{error}</div>}
            <div className="panel-foot"><strong>Provider-based estimates</strong><p>Car journeys use Google traffic-aware ETA and matching Google route geometry when Routes API is enabled. If unavailable, AWS/OpenRouteService road estimates are used and labeled as fallback. Cycling/walking also use AWS. Traffic predictions are not exact arrival guarantees; stops are excluded.</p></div>
          </aside>
          <GoogleMapPanel start={start} end={end} analysis={displayedAnalysis} mapRef={mapRef} onError={setError} onPick={(kind,coords,name)=>pickPlace(kind,{name:name||`Pinned location (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`,coords})} onSelect={setSelectedId}/>
        </div>
      </section>
      <section id="comparison" className="wrap comparison-section cx-section" data-reveal="">
        <div className="section-top"><div><p className="eyebrow">02 <span className="cx-eyebrow-slash">/</span> AQI-FIRST ROUTE INTELLIGENCE</p><h2>Cleaner choices, <em>without huge detours.</em></h2><p className="section-sub">First we reject oversized distance/time detours, then compare distance-weighted modeled US AQI. The primary eligible route comes first and is highlighted on Google Maps.</p></div><span className="chip cx-section-chip">{displayedAnalysis?.routes.length||0} ELIGIBLE ROUTE(S)</span></div>
        {analysis&&<><div className="routing-notice">{MODE_META[analysis.mode].label} mode · {trafficRoute?'Google Routes: traffic-aware predicted driving time and matching roads':'AWS/OpenRouteService: estimated road time, no live traffic'}. <strong>Allowed:</strong> up to {analysis.guardrails.maxDistanceKm?.toFixed(1)??'N/A'} km and {analysis.guardrails.maxDurationMinutes?.toFixed(1)??'N/A'} min. <strong>{analysis.guardrails.excluded.length} excessive detour(s) hidden.</strong></div>
          {trafficRoute?<div className="cx-traffic-source"><span className="cx-traffic-live">● TRAFFIC-AWARE ETA (GOOGLE)</span><span>Updated {new Date(analysis.etaUpdatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · Predicted, not guaranteed. Recalculate to refresh.</span></div>:analysis.mode==='car'?<div className="cx-traffic-source"><span className="cx-traffic-fallback">⚠ AWS estimated ETA — live Google traffic unavailable</span><span>Check Routes API access if you want traffic-aware results.</span></div>:null}
          <div className="routing-notice route-verification" role="status">{trafficRoute?'Road distances and predicted ETA from Google Routes. Pin the correct building entrance for the closest road access point.':analysis.body.route_quality?.status==='passed'?`✓ Route checks passed: snapping, endpoints and detour sanity. ${analysis.body.route_quality.hidden_anomalies||0} suspect route(s) hidden.`:'Route verification metadata unavailable: check whether the latest AWS Lambda is deployed.'}</div></>}
        <div className="cx-aqi-choice" role="status" aria-live="polite">
          <span className="cx-aqi-choice-icon">✦</span>
          <div><strong>{!analysis?'AQI-first screening ready':routeAirLoading?'Checking modeled AQI along eligible roads…':ranked.usingAqi?'AQI-first recommended route':'Fastest eligible route (AQI difference not confirmed)'}</strong>
          <p>{!analysis?'Calculate a journey to screen the roads.':!analysis.routes.length?analysis.guardrails.explanation:routeAirError?'AQI forecasts unavailable; fastest eligible route selected.':routeAir?.explanation||'Forecast loading or unavailable; no unverified cleaner-road claim.'}</p></div>
        </div>
        <div className="route-cards">{!displayedAnalysis?.routes.length?<div className="empty-state">{loading?'Requesting real road routes…':analysis?.guardrails?.explanation||'Calculate a journey to compare real roads. No fake kilometres.'}</div>:
          displayedAnalysis.routes.map((r,i)=>{
            const id=String(r.id);const isSelected=id===String(selectedId||ranked.primaryId);const isBest=id===String(analysis.bestId);const isPrimary=id===ranked.primaryId;
            const color=mapRef.current?.getRouteColor(id)||['#36dea2','#a990fa','#f2ad57','#5db8fa','#ff819d'][i%5];
            return <button className={`route-card route-enter ${isSelected?'selected':''}`} style={{'--route-color':color,'--enter-delay':`${i*85}ms`}} type="button" key={id} onClick={()=>mapRef.current?.selectRoute(id)}>
              <span className="route-name"><i/>{r.name}</span>
              {isPrimary&&<span className="cx-primary-label">★ {ranked.usingAqi?'AQI-FIRST RECOMMENDATION':'PRIMARY: FASTEST ELIGIBLE'}</span>}
              <span className="route-time">{formatMinutes(r.duration_minutes)}</span><span className={`cx-route-traffic ${r.traffic_aware?"":"cx-route-traffic-estimate"}`}>{r.traffic_aware?"Google traffic-aware prediction":"Provider estimate · no live traffic"}</span><span className="route-distance">{Number(r.distance_km).toFixed(2)} km</span>
              <span className="cx-route-aqi">Average modeled US AQI: <b>{Number.isFinite(routeAir?.byRoute?.[id]?.avgUsAqi)?Math.round(routeAir.byRoute[id].avgUsAqi):routeAirLoading?'Checking…':'Not distinguishable'}</b></span>
              <span className="route-tag">{isBest?'FASTEST':r.route_preference==='shortest'?'SHORTEST':'ALTERNATIVE'}</span>{isSelected&&<span className="route-tag">SELECTED</span>}
            </button>;
          })}
        </div>
        <PollutionIntelligence analysis={displayedAnalysis} result={routeAir} loading={routeAirLoading} error={routeAirError} primaryId={ranked.primaryId} usingAqi={ranked.usingAqi} selectedId={selectedId||ranked.primaryId} onSelect={id=>mapRef.current?.selectRoute(id)}/>
        {analysis&&<RouteDetails route={detailsRoute} primaryId={ranked.primaryId} fastestId={analysis.bestId} usingAqi={ranked.usingAqi} start={analysis.start} end={analysis.end} mode={activeMode}/>}
      </section>
      <GpsPanel route={visibleRoute} mode={activeMode} mapRef={mapRef} onReroute={handleReroute}/>
      <DepartureAdvisor route={visibleRoute} mode={MODE_META[activeMode]?.label} routeStart={analysis?.start.name} routeEnd={analysis?.end.name}/>
      <section id="environment" className="wrap environment-section cx-section" data-reveal=""><div className="section-top"><div><p className="eyebrow">05 <span className="cx-eyebrow-slash">/</span> UNDERSTAND THE ATMOSPHERE</p><h2>Know the air <em>ahead.</em></h2><p className="section-sub">Current modeled environmental conditions at your selected start and destination.</p></div><span className="chip cx-section-chip">✦ &nbsp; MODELED CLIMATE DATA</span></div>
        <div className="environment-grid"><EnvironmentCard label="○ STARTING POINT" name={analysis?.start.name||start.name} result={env.start} loading={envLoading} attempted={Boolean(analysis)}/><EnvironmentCard label="◇ DESTINATION" name={analysis?.end.name||end.name} result={env.end} loading={envLoading} attempted={Boolean(analysis)}/></div>
        <p className="environment-disclaimer">US AQI uses the US scale (not India's official AQI). PM2.5, AQI and weather are modeled location-level data, not street-level sensors. Climora samples these coarse forecasts along routes for informational screening, but cannot guarantee a cleaner street.</p>
      </section>
      <TravelTools route={visibleRoute} start={analysis?.start||start} end={analysis?.end||end} mode={activeMode} member={access==='member'} profile={profile} onPlanTo={place=>{pickPlace('end',place);document.getElementById('planner')?.scrollIntoView({behavior:'smooth',block:'start'});}}/>
      <section id="upcoming" className="wrap upcoming-section cx-section" data-reveal=""><div className="section-top"><div><p className="eyebrow">07 <span className="cx-eyebrow-slash">/</span> THE JOURNEY CONTINUES</p><h2>What lies <em>ahead.</em></h2><p className="section-sub">Deeper trip-planning features may come later; these are not active bookings or live-price integrations.</p></div><span className="chip cx-section-chip">✧ &nbsp; COMING SOON</span></div>
        <div className="upcoming-grid"><article className="panel upcoming-card"><span className="upcoming-symbol" aria-hidden="true">🛣️</span><span className="upcoming-status">PLANNED · NOT ACTIVE</span><h3>Long-distance trip planner</h3><p>Dedicated multi-city trips, via-corridors and detailed highway stops. Regular routes remain available where supported.</p></article>
          <article className="panel upcoming-card"><span className="upcoming-symbol" aria-hidden="true">🚕</span><span className="upcoming-status">PARTNER API REQUIRED</span><h3>Automatic taxi fares and hotel bookings</h3><p>Climora now links to taxi apps and finds stays, but live fares and hotel inventory require authorized provider integrations.</p></article></div>
      </section>
    </main><footer className="footer">Climora AI · React · Vite · AWS Lambda · OpenRouteService · Google Maps · Open-Meteo <span>Non-commercial hackathon prototype</span></footer>
    <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onContinueGuest={enterAsGuest} onAuthenticated={handleAuthenticated}/>
    {accountOpen&&<AccountPanel profile={profile} onClose={()=>setAccountOpen(false)} onSignIn={()=>{setAccountOpen(false);setAuthOpen(true);}} onSignOut={logout} onExitGuest={logout}
      myPlaces={myPlaces} myPlacesLoading={myPlacesLoading} myPlacesError={myPlacesError}
      onReloadMyPlaces={reloadMyPlaces} onSavePlace={saveMyPlace} onDeleteMyPlaces={clearMyPlaces}
      onPlanTo={planToMyPlace} currentStart={start} currentEnd={end}/>}
  </>;
}
