import { useEffect, useRef, useState } from 'react';
import { createGoogleMapController } from '../lib/googleMap.js';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const mapId = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

export default function GoogleMapPanel({start,end,analysis,mapRef,onSelect,onPick,onError}){
  const host=useRef(null);
  const selectRef=useRef(onSelect);
  const pickRef=useRef(onPick);
  const errorRef=useRef(onError);
  selectRef.current=onSelect;pickRef.current=onPick;errorRef.current=onError;
  const [mapStatus,setMapStatus]=useState('Loading Google Maps…');
  const [mapError,setMapError]=useState('');
  const [satellite,setSatellite]=useState(false);
  const [traffic,setTraffic]=useState(false);

  useEffect(()=>{
    const api=createGoogleMapController({
      host:host.current,
      onStatus:setMapStatus,
      onError:message=>{setMapError(message);errorRef.current?.(message);},
      onSelect:id=>selectRef.current?.(id),
      onPick:(mode,coords)=>pickRef.current?.(mode,coords),
    });
    mapRef.current=api;
    api.init(apiKey,mapId).catch(()=>{});
    return()=>{
      api.destroy();
      if(mapRef.current===api)mapRef.current=null;
    };
  },[mapRef]);
  useEffect(()=>{mapRef.current?.setPoints(start?.coords,end?.coords);},[start,end,mapRef]);
  useEffect(()=>{
    if(analysis?.routes?.length)mapRef.current?.drawRoutes(analysis.routes,analysis.bestId);
    else mapRef.current?.clearRoutes();
  },[analysis,mapRef]);

  return <section className="panel map-panel" aria-label="Interactive road map">
    <div className="map-header"><div><strong>Explore on Google Maps</strong><p role="status">{mapStatus}</p></div>
      <div className="map-buttons">
        <button type="button" aria-pressed={satellite} onClick={()=>setSatellite(mapRef.current?.toggleSatellite()||false)}>{satellite?'Road map':'Satellite'}</button>
        <button type="button" aria-pressed={traffic} onClick={()=>setTraffic(mapRef.current?.toggleTraffic()||false)}>{traffic?'Hide traffic':'Show traffic'}</button>
        <button type="button" onClick={()=>mapRef.current?.showAllRoutes()}>All routes</button>
        <button type="button" onClick={()=>mapRef.current?.fitMap()}>Fit map</button>
      </div>
    </div>
    <div className="map-canvas-wrap"><div id="routeMap" ref={host} aria-label="Google Maps showing selectable provider road routes"/>
      {mapError&&<div className="google-error-overlay" role="alert">{mapError}<small>Use .env.local to configure the API key, then restart Vite.</small></div>}
    </div>
    <div className="map-legend"><span><i className="legend-dot green"/> Road choice A</span><span><i className="legend-dot purple"/> Alternative</span><span><i className="legend-dot amber"/> Alternative</span><small>Colors distinguish routes, not pollution. Traffic overlay is visual only and does not change AWS route ETAs.</small></div>
  </section>;
}
