import { useEffect, useState } from 'react';
import { aqiBand, asMeasure, conditionText } from '../services/environment.js';

function AQIGauge({value}){
  const rounded=Math.round(value);
  const [progress,setProgress]=useState(0);
  const band=aqiBand(rounded);
  useEffect(()=>{
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setProgress(1);return;}
    let start=null,raf;
    const tick=t=>{
      if(start===null)start=t;
      const ratio=Math.min((t-start)/1300,1);
      setProgress(1-(1-ratio)**3);
      if(ratio<1)raf=requestAnimationFrame(tick);
    };
    setProgress(0);raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[rounded]);
  const radius=50, circumference=2*Math.PI*radius;
  const offset=circumference*(1-Math.min(rounded,300)/300*progress);
  return <div className="climora-aqi-display" style={{'--aqi-color':band.color}} role="img" aria-label={`Modeled US AQI ${rounded}: ${band.label}`}>
    <div className="aqi-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle className="aqi-track" cx="60" cy="60" r="50"/><circle className="aqi-progress" cx="60" cy="60" r="50" style={{strokeDasharray:circumference,strokeDashoffset:offset}}/></svg>
      <div className="aqi-ring-label"><strong aria-hidden="true">{Math.round(rounded*progress)}</strong><span>US AQI</span></div></div>
    <div className="aqi-note"><span className="aqi-model">MODELED AIR QUALITY</span><strong className="aqi-status">{band.label}</strong><small>US AQI scale · Location-level model, not a street sensor.</small></div>
  </div>;
}

function WeatherIcon({code}) {
  let type='unknown';
  if(code===0)type='sunny';
  else if([1,2,3].includes(code))type='cloudy';
  else if([45,48].includes(code))type='foggy';
  else if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))type='rainy';
  else if([71,73,75,77,85,86].includes(code))type='snowy';
  else if([95,96,99].includes(code))type='thunder';
  return <span className={`weather-icon ${type}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type==='sunny'&&<><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"/></>}
      {type==='cloudy'&&<path d="M5 18h13a4 4 0 000-8 5.8 5.8 0 00-11-1.3A4.8 4.8 0 005 18Z"/>}
      {type==='rainy'&&<><path d="M5 16h13a4 4 0 000-8 5.8 5.8 0 00-11-1.3A4.8 4.8 0 005 16Z"/><path className="drop" d="M7 18l-1 3M13 18l-1 3M19 18l-1 3"/></>}
      {type==='foggy'&&<path d="M3 8h18M5 12h14M2 16h20M5 20h14"/>}
      {type==='snowy'&&<><path d="M5 16h13a4 4 0 000-8 5.8 5.8 0 00-11-1.3A4.8 4.8 0 005 16Z"/><path d="M7 21v-3m-1.5 1.5h3m5.5 1.5v-3m-1.5 1.5h3"/></>}
      {type==='thunder'&&<><path d="M5 16h13a4 4 0 000-8 5.8 5.8 0 00-11-1.3A4.8 4.8 0 005 16Z"/><path className="bolt" d="M13 15l-3 5h3l-1 3 5-6h-3l1-2"/></>}
      {type==='unknown'&&<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a3 3 0 015-1c1 2-.4 3-2.5 4M12 17h.02"/></>}
    </svg>
  </span>;
}

export default function EnvironmentCard({label,name,result,loading,attempted}) {
  const weather=result?.weather,air=result?.air;
  return <div className="env-card"><div className="env-heading"><span>{label}</span><strong>{name}</strong></div>
    {!result ? <div className="environment-data placeholder-env">{loading?'Loading modeled local conditions…':attempted?'Environmental data unavailable right now. Routing still works.':'Run a route analysis to view modeled conditions.'}</div> :
    <div className="environment-data">
      {typeof air.us_aqi==='number'&&Number.isFinite(air.us_aqi)&&<AQIGauge key={`${name}:${air.us_aqi}`} value={air.us_aqi}/>}
      <div className="env-metrics">
        <div><span>Temperature</span><strong>{asMeasure(weather.temperature_2m,'°C')}</strong></div>
        <div><span>US AQI (modeled)</span><strong>{asMeasure(air.us_aqi)}</strong></div>
        <div><span>PM2.5 (modeled)</span><strong>{asMeasure(air.pm2_5,' µg/m³')}</strong></div>
        <div><span>Wind</span><strong>{asMeasure(weather.wind_speed_10m,' km/h')}</strong></div>
      </div>
      <p className="env-summary"><span className="weather-chip"><WeatherIcon code={weather.weather_code}/>{conditionText(weather.weather_code)}</span><span className="weather-details">· {asMeasure(weather.precipitation,' mm precipitation')} · {asMeasure(weather.relative_humidity_2m,'% humidity')}</span></p>
    </div>}
  </div>;
}
