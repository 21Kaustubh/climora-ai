import { useGpsNavigation } from '../hooks/useGpsNavigation.js';
import { MODE_META } from '../services/places.js';

export default function GpsPanel({route,mode,mapRef,onReroute}){
  const {active,stats,start,stop}=useGpsNavigation(route,mapRef);
  return <section id="navigation" className="wrap navigation-section">
    <div className="section-top"><div><p className="eyebrow">03 / GPS JOURNEY ASSISTANT</p><h2>Turn-by-turn directions</h2><p className="section-sub">Mode-aware directions, device GPS speed and road progress. Foreground assistance only, not a certified navigation system.</p></div><span className="chip">GPS PERMISSION REQUIRED</span></div>
    <div className="panel gps-panel">
      <div className="gps-toolbar"><div><strong>{route?`${MODE_META[mode]?.label||'Journey'} directions: ${route.name}`:'Analyze and select a route first'}</strong><p role="status">{stats.status}</p></div>
        <div className="gps-actions"><button type="button" disabled={!route||active} onClick={start}>▶ Start GPS navigation</button><button type="button" disabled={!active} onClick={stop}>■ Stop</button>
          <button type="button" disabled={!route||!stats.position} onClick={()=>{stop();onReroute(stats.position);}}>↻ Recalculate from GPS</button></div>
      </div>
      <div className="gps-stats" aria-label="Journey status">
        <div><small>Device speed</small><strong>{stats.speed}</strong></div><div><small>Remaining road distance</small><strong>{stats.remaining}</strong></div>
        <div><small>Estimated time remaining*</small><strong>{stats.eta}</strong></div><div><small>Estimated arrival</small><strong>{stats.arrival}</strong></div>
      </div>
      <div className="next-maneuver"><span>↗ NEXT DIRECTION</span><strong>{stats.next}</strong><small>{stats.nextDistance}</small></div>
      <div className="gps-warning" role="status">{stats.warning}</div>
      <details className="all-directions" open><summary>Full route directions</summary><ol>
        {route?.directions_preview?.length?route.directions_preview.map((step,i)=><li key={`${route.id}-${i}`} className={stats.activeStep===i?'active-instruction':''}>{step.instruction} <small>· {Number(step.distance_km||0).toFixed(2)} km</small></li>):<li>{route?'Detailed instructions unavailable in provider response.':'Analyze a route to load directions.'}</li>}
      </ol></details>
    </div>
  </section>;
}
