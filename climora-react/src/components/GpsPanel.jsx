import {useEffect,useState} from 'react';
import {useGpsNavigation} from '../hooks/useGpsNavigation.js';
import {MODE_META} from '../services/places.js';

const maneuverSymbol = text => /left/i.test(text)?'↰':/right/i.test(text)?'↱':/destination|arriv/i.test(text)?'⌖':'↑';

export default function GpsPanel({route,mode,mapRef,onReroute}) {
  const [follow,setFollow]=useState(true);
  const [voice,setVoice]=useState(false);
  const [autoReroute,setAutoReroute]=useState(false);
  const {active,stats,start,stop}=useGpsNavigation(route,mapRef,{onReroute,follow,voice,autoReroute});
  useEffect(()=>{
    if(!voice&&typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();
  },[voice]);

  const viewMap=()=>{
    if(stats.position)mapRef.current?.updateUserLocation(stats.position,stats.accuracyMeters,true);
    document.getElementById('planner')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const reroute=()=>{
    if(!stats.position)return;
    stop();onReroute?.(stats.position);
  };
  return <section id="navigation" className="wrap navigation-section journey-section">
    <div className="section-top"><div>
      <p className="eyebrow">03 / START JOURNEY</p>
      <h2>Navigation that <em>moves with you.</em></h2>
      <p className="section-sub">Start device GPS to follow your selected route, track approximate progress and receive next-turn hints.</p>
    </div><span className="chip">FOREGROUND GPS · LOCATION PERMISSION</span></div>

    <div className="panel gps-panel journey-panel">
      <div className="gps-toolbar journey-toolbar">
        <div><span className="journey-kicker">{active?'● JOURNEY IN PROGRESS':'◉ READY TO NAVIGATE'}</span>
          <strong>{route?`${MODE_META[mode]?.label||'Journey'} · ${route.name}`:'Calculate and select a route first'}</strong>
          <p role="status">{stats.status}</p>
        </div>
        <div className="gps-actions">
          <button type="button" className="journey-start" disabled={!route||active} onClick={start}>▶ Start Journey</button>
          <button type="button" disabled={!active} onClick={stop}>Ⅱ Pause GPS</button>
          <button type="button" disabled={!route||!stats.position} onClick={reroute}>↻ Recalculate from GPS</button>
        </div>
      </div>

      <div className="journey-progress-top"><span>ROUTE PROGRESS</span><strong>{stats.progressPercent}%</strong></div>
      <div className="journey-track" role="progressbar" aria-label="Estimated journey progress" aria-valuenow={stats.progressPercent} aria-valuemin="0" aria-valuemax="100"><span style={{width:`${stats.progressPercent}%`}}/></div>

      <div className="journey-main-direction" aria-live="polite" aria-atomic="true">
        <span className="journey-turn-icon" aria-hidden="true">{maneuverSymbol(stats.next)}</span>
        <div><small>NEXT DIRECTION {stats.nextInstructionApproximate?'· APPROXIMATE':''}</small>
          <strong>{stats.next}</strong><p>{stats.nextDistance}</p></div>
      </div>

      <div className="gps-stats journey-stats" aria-label="Journey status">
        <div><small>GPS speed</small><strong>{stats.speed}</strong></div>
        <div><small>Distance remaining</small><strong>{stats.remaining}</strong></div>
        <div><small>Estimated time remaining</small><strong>{stats.eta}</strong></div>
        <div><small>Predicted arrival</small><strong>{stats.arrival}</strong></div>
      </div>

      <div className="journey-options" aria-label="Navigation options">
        <label className="journey-check"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/> Follow my location on map</label>
        <label className="journey-check"><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/> Optional voice prompts</label>
        <label className="journey-check"><input type="checkbox" checked={autoReroute} onChange={e=>setAutoReroute(e.target.checked)}/> Auto-reroute after confirmed deviation</label>
        <button type="button" className="journey-map-button" onClick={viewMap}>⌖ View live map</button>
      </div>

      <div className={`gps-warning journey-warning ${stats.offRoute?'journey-offroute':''}`} role="status">{stats.warning}</div>
      <p className="journey-disclaimer">GPS, next turns and percentage progress are estimates based on road geometry. Google traffic-aware ETA is calculated when routes load; it is not automatically refreshed during tracking. Browser navigation usually pauses when your phone is locked or this tab is in the background. Do not use this prototype as your only navigation aid.</p>

      <details className="all-directions"><summary>View all available provider directions</summary><ol>
        {route?.directions_preview?.length?route.directions_preview.map((step,i)=><li key={`${route.id}-${i}`} className={stats.activeStep===i?'active-instruction':''}>{step.instruction} <small>· {Number(step.distance_km||0).toFixed(2)} km</small></li>):<li>{route?'Detailed instructions unavailable from this provider.':'Calculate a route to see directions.'}</li>}
      </ol></details>
    </div>
    {active&&<div className="journey-floating" role="status">
      <span className="journey-live-dot" aria-hidden="true"/>
      <div className="journey-floating-text"><strong>{stats.next}</strong><small>{stats.nextDistance} · {stats.eta} remaining · {stats.remaining}</small></div>
      <button type="button" onClick={viewMap}>Map</button><button type="button" onClick={()=>{stop();document.getElementById('navigation')?.scrollIntoView({behavior:'smooth'});}}>Stop</button>
    </div>}
  </section>;
}
