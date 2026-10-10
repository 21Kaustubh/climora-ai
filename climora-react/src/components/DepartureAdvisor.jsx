import { useEffect, useState } from 'react';
import { getSmartDepartureForecast } from '../services/departure.js';

function clock(timeMs) {
  return new Intl.DateTimeFormat('en-IN', { hour:'numeric', minute:'2-digit', hour12:true }).format(new Date(timeMs));
}
function measure(value, units = '', decimals = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(decimals)}${units}` : 'Unavailable';
}
function RainIcon({ amount }) {
  if (!Number.isFinite(amount)) return <span aria-hidden="true">◌</span>;
  if (amount >= 2) return <span aria-hidden="true">☂</span>;
  if (amount >= .3) return <span aria-hidden="true">☁</span>;
  return <span aria-hidden="true">○</span>;
}

/** Runs only after a real route exists; no additional AWS calls or route changes. */
export default function DepartureAdvisor({ route, mode, routeStart, routeEnd }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    setFocused(0);
    setData(null);
    setError('');
    if (!route) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    void getSmartDepartureForecast(route, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err?.message || 'Hourly forecast unavailable');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [route, refresh]);

  const highlighted = data?.slots.find(s => s.offsetHours === focused) || data?.slots[0];
  const recommended = data?.decision?.offsetHours;
  const hasSuggestion = Number.isFinite(recommended) && recommended > 0;
  return <section id="departure" className="wrap cx-section smart-departure" aria-labelledby="departure-title" data-reveal="">
    <div className="section-top">
      <div><p className="eyebrow">04 <span className="cx-eyebrow-slash">/</span> THE RIGHT MOMENT TO GO</p>
        <h2>Leave at the <em>right time.</em></h2>
        <p className="section-sub">Compare departure now or later using hourly modeled air-quality and weather forecasts along your selected road route.</p>
      </div>
      <span className="chip cx-section-chip">◷ &nbsp; SMART DEPARTURE ADVISOR</span>
    </div>
    <div className="sd-shell panel">
      <div className="sd-heading">
        <div className="sd-heading-icon" aria-hidden="true">◷</div>
        <div className="sd-heading-copy"><strong>Departure window explorer</strong>
          <p>{route ? `${routeStart || 'Starting point'} → ${routeEnd || 'Destination'} · ${mode || 'Travel'} · ${route.name}` : 'Calculate a route first to unlock the advisor.'}</p>
        </div>
        {route && <button type="button" className="sd-refresh" disabled={loading} onClick={()=>setRefresh(r=>r+1)}>↻ Refresh forecasts</button>}
      </div>
      {!route ? <div className="sd-empty"><span aria-hidden="true">✧</span><strong>Your smarter departure begins with a route.</strong><p>Choose a start, destination and travel mode above, then click Calculate routes.</p><a href="#planner">Go to route planner ↗</a></div>
      : loading ? <div className="sd-loading" role="status"><span className="sd-loading-orbit"/><div><strong>Scanning the next few hours…</strong><p>Checking modeled PM2.5 and weather along the existing route. Your road distance and navigation stay untouched.</p></div></div>
      : error ? <div className="sd-error" role="status"><strong>Departure forecasts currently unavailable</strong><p>{error} You can still use Google Maps and your normal route planner.</p></div>
      : data ? <>
        <div className="sd-decision" role="status">
          <div className="sd-decision-symbol" aria-hidden="true">{hasSuggestion ? '✦' : '≈'}</div>
          <div><span className="sd-overline">MODELED DEPARTURE INSIGHT</span>
            <h3>{hasSuggestion
              ? data.decision.status==='potentially-drier' ? `Potentially drier at +${recommended}h` : `Lower modeled PM2.5 at +${recommended}h`
              : data.decision.status === 'no-clear-benefit' ? 'No strong reason to wait' : 'Not enough data to recommend a time'}</h3>
            <p>{data.decision.explanation}</p>
          </div>
        </div>
        <div className="sd-strip" aria-label="Compare forecast departure hours">
          {data.slots.map(s => {
            const selected = focused === s.offsetHours;
            const suggested = hasSuggestion && recommended === s.offsetHours;
            return <button key={s.offsetHours} type="button" aria-pressed={selected}
              className={`sd-slot ${selected ? 'sd-slot-active' : ''} ${suggested ? 'sd-slot-suggested' : ''}`}
              onClick={()=>setFocused(s.offsetHours)}>
              <span className="sd-slot-top"><span>{s.offsetHours === 0 ? 'LEAVE NOW' : `IN ${s.offsetHours} HOUR${s.offsetHours===1?'':'S'}`}</span>{suggested && <b>MODEL PICK</b>}</span>
              <strong>{clock(s.departureMs)}</strong>
              <span className="sd-slot-separator"/>
              <span className="sd-slot-metric"><small>PM2.5 forecast</small><b>{measure(s.avgPm25, ' µg/m³')}</b></span>
              <span className="sd-slot-metric"><small>Peak rain</small><b><RainIcon amount={s.peakRainMmPerHour}/> {measure(s.peakRainMmPerHour,' mm/h')}</b></span>
            </button>;
          })}
        </div>
        {highlighted && <div className="sd-detail" aria-live="polite">
          <div className="sd-detail-heading"><span className="sd-overline">SELECTED DEPARTURE</span><strong>{clock(highlighted.departureMs)} → {clock(highlighted.arrivalMs)}</strong><small>Arrival assumes the same provider trip duration; no future traffic prediction.</small></div>
          <div className="sd-detail-stats">
            <div><span>Modeled average PM2.5</span><strong>{measure(highlighted.avgPm25,' µg/m³')}</strong></div>
            <div><span>Peak sampled US AQI</span><strong>{measure(highlighted.maxUsAqi,'',0)}</strong></div>
            <div><span>Peak forecast rainfall</span><strong>{measure(highlighted.peakRainMmPerHour,' mm/h')}</strong></div>
            <div><span>Average temperature</span><strong>{measure(highlighted.avgTemperatureC,'°C')}</strong></div>
          </div>
        </div>}
        <div className="sd-data-note"><span>◈ {data.sampledPoints} points along road geometry</span><span>Air: {data.dataStatus.air}</span><span>Weather: {data.dataStatus.weather}</span><span>Open-Meteo/CAMS modeled forecasts</span></div>
        <p className="sd-disclaimer">{data.modelNote} These are forecasts, not actual measured conditions or medical recommendations. The PM2.5 × time indicator is an approximate comparison proxy, not inhaled dose. Selecting a departure slot previews its forecast; it does not schedule or start navigation.</p>
      </> : null}
    </div>
  </section>;
}
