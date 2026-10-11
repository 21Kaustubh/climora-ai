import { aqiBand } from '../services/environment.js';
const decimal = n => Number.isFinite(n) ? n.toFixed(1) : 'N/A';
export default function PollutionIntelligence({analysis,result,loading,error,primaryId,usingAqi,selectedId,onSelect}) {
  const routes=analysis?.routes||[];
  const winner=routes.find(r=>String(r.id)===String(primaryId));
  return <section className="air-intelligence panel" aria-labelledby="air-intelligence-title">
    <div className="air-intelligence-header">
      <div><p className="eyebrow">AQI-FIRST · DISTANCE-CONTROLLED</p>
        <h3 id="air-intelligence-title">Average AQI along eligible roads</h3>
        <p>Distance-weighted mean of modeled US AQI sampled along provider road geometry, at approximate journey times.</p>
      </div><span className="air-intelligence-label">COARSE MODEL DATA</span>
    </div>
    {!analysis ? <p className="air-status">Calculate a road journey to compare modeled route AQI.</p> :
      !routes.length ? <p className="air-status air-failure">No routes pass both distance and time restrictions. No oversized alternative is recommended.</p> :
      loading ? <p className="air-status" role="status"><span className="spin air-spinner"/> Checking the same forecast along eligible routes…</p> :
      error ? <p className="air-status air-failure" role="status">AQI unavailable: {error}. Fastest eligible route remains usable for directions.</p> :
      !result ? <p className="air-status">No model screening yet. Fastest eligible option is shown.</p> : <>
        <div className={`air-decision ${usingAqi?'air-has-candidate':''}`} role="status">
          <div className="air-decision-icon" aria-hidden="true">{usingAqi?'✦':'≈'}</div>
          <div><strong>{usingAqi?'AQI-first recommendation':result.status==='single'?'Only one eligible road':result.status==='unavailable'?'Forecast data incomplete':'No reliable cleaner-road distinction'}</strong>
            <p>{winner?`${winner.name} · ${Number(winner.distance_km).toFixed(2)} km · ${Number(winner.duration_minutes).toFixed(1)} min. `:''}{result.explanation}</p></div>
        </div>
        <div className="air-route-grid">
          {routes.map(route=>{
            const id=String(route.id);
            const v=result.byRoute?.[id];
            const primary=id===String(primaryId);
            return <button key={id} type="button" className={`air-route-card ${String(selectedId)===id?'air-active':''}`} onClick={()=>onSelect(id)}>
              <span className="air-route-top"><strong>{route.name}</strong>{primary&&<em>{usingAqi?'BEST MODELED AQI':'FASTEST ELIGIBLE'}</em>}</span>
              {v?.available? <>
                <span className="air-metric-row"><span>Mean modeled US AQI</span><b style={{color:aqiBand(v.avgUsAqi).color}}>{Math.round(v.avgUsAqi)}</b></span>
                <span className="air-metric-row"><span>Mean modeled PM2.5</span><b>{decimal(v.avgPm25)} <small>µg/m³</small></b></span>
                <span className="air-metric-row"><span>Time × PM2.5 proxy</span><b>{decimal(v.pmTimeProxy)} <small>µg·h/m³</small></b></span>
                <span className="air-metric-row"><span>Peak sampled US AQI</span><b>{Number.isFinite(v.maxSampledUsAqi)?Math.round(v.maxSampledUsAqi):'N/A'}</b></span>
                <small>{v.sampledLocations} road samples · {v.gridCells} model cell(s) · {Number(route.duration_minutes).toFixed(1)} min</small>
              </> : <span className="air-unavailable">{v?.reason||'AQI not available for this route.'}</span>}
            </button>;
          })}
        </div>
        <p className="air-method">Mean US AQI is an informational, distance-weighted average of forecast index samples; it is <strong>not</strong> an official route AQI, street sensor value or health-risk score. Open-Meteo/CAMS global grid cells can cover many neighboring roads (~45 km). Climora chooses lower modeled AQI only when the difference is meaningful and spatially distinguishable. Otherwise the fastest eligible road is recommended. No live-traffic prediction.</p>
        <p className="air-credit">Air data: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener noreferrer">Open-Meteo</a> / <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer">Copernicus CAMS</a>.</p>
      </>}
  </section>;
}
