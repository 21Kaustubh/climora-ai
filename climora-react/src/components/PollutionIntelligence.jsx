import { aqiBand } from '../services/environment.js';

const decimal = n => Number.isFinite(n) ? n.toFixed(1) : 'N/A';

export default function PollutionIntelligence({ analysis, result, loading, error, selectedId, onSelect }) {
  return <section className="air-intelligence panel" aria-labelledby="air-intelligence-title">
    <div className="air-intelligence-header">
      <div><p className="eyebrow">MODEL-BASED ENVIRONMENTAL SCREENING</p>
        <h3 id="air-intelligence-title">Pollution along your routes</h3>
        <p>Compare sampled PM2.5 along real road geometry using Open-Meteo/CAMS forecasts.</p>
      </div>
      <span className="air-intelligence-label">NOT STREET-LEVEL</span>
    </div>
    {!analysis ? <p className="air-status">Calculate a journey first to see modeled air quality along the available routes.</p> :
      loading ? <p className="air-status" role="status"><span className="spin air-spinner"/> Sampling route forecasts… This will not change your AWS route distance or ETA.</p> :
      error ? <p className="air-status air-failure" role="status">Air-quality screening unavailable: {error}. Routes and directions still work.</p> :
      !result ? <p className="air-status">No pollution screening available for this journey.</p> : <>
        <div className={`air-decision ${result.status === 'lower-modelled-exposure' ? 'air-has-candidate' : ''}`} role="status">
          <div className="air-decision-icon" aria-hidden="true">{result.status === 'lower-modelled-exposure' ? '↗' : '≈'}</div>
          <div><strong>{result.status === 'lower-modelled-exposure'
            ? 'Potentially lower modeled exposure alternative'
            : result.status === 'single' ? 'Only one route available'
              : result.status === 'unavailable' ? 'Insufficient forecast data'
                : 'No reliable cleaner-road distinction'}</strong>
            <p>{result.explanation}</p></div>
        </div>
        <div className="air-route-grid">
          {analysis.routes.map(route => {
            const id = String(route.id);
            const v = result.byRoute[id];
            const isCandidate = id === result.recommendationId;
            return <button key={id} type="button"
              className={`air-route-card ${String(selectedId) === id ? 'air-active' : ''}`}
              onClick={() => onSelect(id)}>
              <span className="air-route-top"><strong>{route.name}</strong>
                {isCandidate && <em>LOWER MODELED PROXY</em>}
              </span>
              {v?.available ? <>
                <span className="air-metric-row"><span>Mean modeled PM2.5</span><b>{decimal(v.avgPm25)} <small>µg/m³</small></b></span>
                <span className="air-metric-row"><span>Time × PM2.5 proxy</span><b>{decimal(v.pmTimeProxy)} <small>µg·h/m³</small></b></span>
                <span className="air-metric-row"><span>Peak sampled US AQI</span>
                  <b style={{color:Number.isFinite(v.maxSampledUsAqi)?aqiBand(v.maxSampledUsAqi).color:undefined}}>{Number.isFinite(v.maxSampledUsAqi)?Math.round(v.maxSampledUsAqi):'N/A'}</b></span>
                <small>{v.sampledLocations} sample points · {v.gridCells} model cell(s) · {Number(route.duration_minutes).toFixed(1)} min</small>
              </> : <span className="air-unavailable">{v?.reason || 'Not sampled in this version.'}</span>}
            </button>;
          })}
        </div>
        <p className="air-method">The proxy is modeled PM2.5 concentration multiplied by estimated trip hours, with uniform progress along the road assumed. It is <strong>not</strong> inhaled dose or a personalized health risk. CAMS global data for Maharashtra is coarse (about 45 km), so nearby streets often cannot be distinguished. Forecast timestamps are approximated along the journey. Route choice and traffic ETA remain provided by AWS/OpenRouteService.</p>
        <p className="air-credit">Air data: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener noreferrer">Open-Meteo</a> and <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer">Copernicus Atmosphere Monitoring Service (CAMS)</a>.</p>
      </>}
  </section>;
}
