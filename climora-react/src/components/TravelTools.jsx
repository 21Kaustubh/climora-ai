import { useEffect, useMemo, useState } from 'react';
import { findNightStays, routePointAtFraction, stayMapSearchUrl } from '../services/nightStay.js';
import { FriendsPanel } from './FriendsPanel.jsx';

const RIDE_APPS=[
  {id:'uber',name:'Uber',url:'https://www.uber.com/go/',description:'Open Uber to check its own available rides and fare.'},
  {id:'ola',name:'Ola',url:'https://www.olacabs.com/',description:'Open Ola and enter the same pickup / drop-off.'},
  {id:'rapido',name:'Rapido',url:'https://www.rapido.bike/',description:'Open Rapido and compare options if offered in your city.'},
];

function NightStayPanel({route,onPlanTo}){
  const [fraction,setFraction]=useState(0.5);
  const [departure,setDeparture]=useState(()=>new Date().toTimeString().slice(0,5));
  const [stays,setStays]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [searched,setSearched]=useState(false);
  const point=useMemo(()=>routePointAtFraction(route,fraction),[route,fraction]);
  const departMinutes=Number(departure.slice(0,2))*60+Number(departure.slice(3,5));
  const stopMinutes=Number.isFinite(route?.duration_minutes)?(departMinutes+Number(route.duration_minutes)*fraction)%1440:NaN;
  const stopHour=Number.isFinite(stopMinutes)?Math.floor(stopMinutes/60):NaN;
  const stopClock=Number.isFinite(stopMinutes)?`${String(stopHour).padStart(2,'0')}:${String(Math.floor(stopMinutes%60)).padStart(2,'0')}`:'';
  const overnight=stopHour>=20||stopHour<6;
  useEffect(()=>{setStays([]);setError('');setSearched(false);},[route?.id,route?.geometry,fraction]);
  async function search(){
    setError('');setBusy(true);setSearched(false);setStays([]);
    try{setStays(await findNightStays(point));setSearched(true);}
    catch(err){setError(err.message||'Could not find stays. Open Google Maps instead.');}
    finally{setBusy(false);}
  }
  return <article className="panel cx-tool-card">
    <div className="cx-tool-heading"><span className="cx-tool-icon">☾</span><div><h3>Night Route &amp; Stay Finder</h3><p>Find real hotels and rest options around a point on your selected route.</p></div></div>
    {!point?<p className="cx-tool-muted">Calculate and select a route first to find stays along it.</p>:<>
      {Number(route?.distance_km)<80&&<p className="cx-tool-advice">This is a short journey. An overnight stop may not be needed; search is available if you want it.</p>}
      <div className="cx-tool-select"><label htmlFor="cx-night-depart">Planned departure</label><input id="cx-night-depart" type="time" value={departure} onChange={e=>setDeparture(e.target.value)} />
      <label htmlFor="cx-night-stop">Check near</label>
        <select id="cx-night-stop" value={fraction} onChange={e=>setFraction(Number(e.target.value))}>
          <option value="0.25">25% of route</option><option value="0.5">Halfway point</option><option value="0.75">75% of route</option>
        </select></div>
      <p className={overnight?'cx-tool-advice':'cx-tool-muted'}>Approximate arrival at selected route point: <strong>{stopClock||'—'}</strong> {overnight?'· Night-time driving window — consider a rest break.':'· Daytime window.'} Uses the current provider ETA proportionally; it does not predict future traffic or stop time.</p>
      <p className="cx-tool-muted">Search point: {point[1].toFixed(4)}, {point[0].toFixed(4)} · Based on actual road geometry.</p>
      <div className="cx-tool-actions"><button type="button" className="cx-tool-button" disabled={busy} onClick={()=>void search()}>{busy?'Searching nearby stays…':'⌕ Find stays along route'}</button>
        <a href={stayMapSearchUrl(point)} rel="noopener noreferrer" target="_blank">↗ Search on Google Maps</a></div>
      {error&&<p className="cx-tool-error" role="alert">{error}</p>}
      {searched&&!stays.length&&<p className="cx-tool-muted">No hotels were returned in this area. Try another point or Google Maps.</p>}
      {!!stays.length&&<div className="cx-stay-results" aria-live="polite">{stays.map(s=><div className="cx-stay" key={s.id}>
        <div><strong>{s.name}</strong><small>{s.address}</small><small>Approx. {s.straightLineKm.toFixed(1)} km in a straight line from the search point (NOT driving detour).</small></div>
        <div className="cx-stay-actions"><a href={s.mapsUrl} target="_blank" rel="noopener noreferrer">Hotel details ↗</a><button type="button" onClick={()=>onPlanTo?.({name:s.name,coords:s.coords,placeId:s.id})}>Plan route to stay</button></div>
      </div>)}</div>}
      <p className="cx-tool-disclaimer">These are Google Places search results, not confirmed vacancies, prices, night-time safety ratings or hotel bookings. “Plan route to stay” replaces your destination and requires recalculation; it does not silently add a waypoint. Check actual roads and entry points.</p>
    </>}
  </article>;
}

function TaxiComparison({start,end,route,mode}){
  const [quotes,setQuotes]=useState({uber:'',ola:'',rapido:''});
  const [copyMessage,setCopyMessage]=useState('');
  const validRoute=Boolean(mode==='car'&&start?.coords&&end?.coords&&route);
  const ranked=RIDE_APPS.map(a=>({...a,fare:quotes[a.id].trim()?Number(quotes[a.id]):NaN}))
    .filter(a=>Number.isFinite(a.fare)&&a.fare>0).sort((a,b)=>a.fare-b.fare);
  const cheapest=ranked[0];
  useEffect(()=>{setQuotes({uber:'',ola:'',rapido:''});setCopyMessage('');},[start?.name,end?.name,route?.id]);
  const summary=validRoute?`Pickup: ${start.name}\nDropoff: ${end.name}\nTravel mode: car\nClimora road distance: ${Number(route.distance_km).toFixed(1)} km\nClimora predicted/estimated driving time: ${Math.round(route.duration_minutes)} min\nConfirm live price, pickup and availability inside taxi app.`:'';
  async function copy(){
    if(!summary)return;
    try{await navigator.clipboard.writeText(summary);setCopyMessage('Pickup and destination copied.');}
    catch{setCopyMessage('Browser blocked clipboard. Copy pickup and destination manually.');}
  }
  return <article className="panel cx-tool-card">
    <div className="cx-tool-heading"><span className="cx-tool-icon">🚕</span><div><h3>Taxi App Comparison</h3><p>Check Uber, Ola and Rapido using the same planned journey.</p></div></div>
    {!validRoute?<p className="cx-tool-muted">Select Car mode and calculate a route to compare taxi providers for the same pickup, drop-off and ETA.</p>:<>
      <div className="cx-taxi-itinerary"><p><b>From</b> {start.name}</p><p><b>To</b> {end.name}</p><span>{Number(route.distance_km).toFixed(1)} km · {Math.round(route.duration_minutes)} min · {route.traffic_aware?'Google traffic-aware prediction':'No live traffic estimate'}</span></div>
      <div className="cx-tool-actions"><button className="cx-tool-button" type="button" onClick={()=>void copy()}>⧉ Copy journey details</button>{copyMessage&&<small role="status">{copyMessage}</small>}</div>
      <div className="cx-taxi-apps">{RIDE_APPS.map(a=><div className="cx-taxi-row" key={a.id}>
        <div><strong>{a.name}</strong><small>{a.description}</small></div>
        <label>Actual quote (₹)<input type="number" min="0" step="1" inputMode="numeric" value={quotes[a.id]} placeholder="Enter price" onChange={e=>setQuotes(prev=>({...prev,[a.id]:e.target.value}))}/></label>
        <a target="_blank" rel="noopener noreferrer" href={a.url}>Open {a.name} ↗</a>
      </div>)}</div>
      {cheapest&&<p className="cx-tool-highlight" role="status">Lowest fare you've entered: <strong>{cheapest.name} — ₹{cheapest.fare.toLocaleString('en-IN')}</strong>. This is not an automatically retrieved quote.</p>}
      <p className="cx-tool-disclaimer">Climora does not have partner fare/availability APIs. Live fare amounts, surcharges, vehicle types and availability must be checked in each official service before booking. External app links may not auto-fill locations. Prices typed here are NOT stored or sent to Climora.</p>
    </>}
  </article>;
}

export default function TravelTools({route,start,end,mode,member,profile,onPlanTo}){
  return <section id="travel-tools" className="wrap cx-section cx-travel-tools-section" data-reveal="">
    <div className="section-top"><div><p className="eyebrow">06 <span className="cx-eyebrow-slash">/</span> BEYOND THE ROAD</p><h2>More than <em>directions.</em></h2><p className="section-sub">Explore overnight stop options, compare taxi apps, and connect with friends only if both people agree.</p></div><span className="chip cx-section-chip">✦ &nbsp; TRAVEL TOOLS</span></div>
    <div className="cx-travel-grid"><NightStayPanel route={route} onPlanTo={onPlanTo}/><TaxiComparison route={route} start={start} end={end} mode={mode}/></div>
    <FriendsPanel member={member} profile={profile}/>
  </section>;
}
