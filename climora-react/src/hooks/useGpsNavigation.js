import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMinutes } from '../services/places.js';

const EARTH_DIAMETER_KM = 12742;
function segmentKm(a, b) {
  const rad = deg => deg * Math.PI / 180;
  const deltaLat = rad(b[1]-a[1]);
  const deltaLng = rad(b[0]-a[0]);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_DIAMETER_KM * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}
const defaultStats = () => ({
  status: 'Select a route to start navigation.', warning: 'GPS readings depend on your device. No traffic or road speed-limit feed is connected.',
  speed:'— km/h', remaining:'— km', eta:'—', arrival:'—', next:'Select a route to see turn instructions.',
  nextDistance:'No navigation active', activeStep:null, position:null,
});

function closestSegment(coords, cumulative, gps) {
  if (coords.length < 2) return null;
  let best = {distanceKm: Infinity, travelledKm:0};
  const latScale = Math.cos(gps[1]*Math.PI/180);
  for (let i=0;i<coords.length-1;i++) {
    const a=coords[i]; const b=coords[i+1];
    const ax=(a[0]-gps[0])*latScale; const ay=a[1]-gps[1];
    const dx=(b[0]-a[0])*latScale; const dy=b[1]-a[1];
    const denominator=dx*dx+dy*dy;
    const t=denominator ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/denominator)) : 0;
    const point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
    const distanceKm=segmentKm(gps,point);
    if (distanceKm < best.distanceKm) best={distanceKm, travelledKm:cumulative[i]+t*(cumulative[i+1]-cumulative[i])};
  }
  return best;
}

export function useGpsNavigation(route, mapRef) {
  const [active,setActive]=useState(false);
  const [stats,setStats]=useState(defaultStats);
  const watchRef=useRef(null);
  const geo = useMemo(()=>{
    const coords = route?.geometry?.type === 'LineString' ? route.geometry.coordinates.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)) : [];
    const cumulative=[0];
    for(let i=1;i<coords.length;i++) cumulative.push(cumulative[i-1]+segmentKm(coords[i-1],coords[i]));
    return {coords,cumulative};
  },[route]);

  const stop=useCallback(()=>{
    if(watchRef.current!==null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current=null;
    setActive(false);
    setStats(s=>({...s,status:route?'GPS tracking stopped':'No route calculated'}));
  },[route]);

  useEffect(()=>{
    if(watchRef.current!==null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current=null;
    setActive(false);
    setStats({
      ...defaultStats(), status:route?'Directions ready. Start GPS when travelling.':'No route calculated',
      remaining:route?`${Number(route.distance_km).toFixed(1)} km`:'— km',
      eta:route?formatMinutes(route.duration_minutes):'—',
      next:route?.directions_preview?.[0]?.instruction||'Select a route to see turn instructions.',
      nextDistance:route?'Start GPS to track turn distance':'No navigation active',
    });
    return ()=>{
      if(watchRef.current!==null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current=null;
    };
  },[route]);

  const onPosition=useCallback((position)=>{
    if(!route || !geo.coords.length) return;
    const c=position.coords;
    const gps=[c.longitude,c.latitude];
    if(!gps.every(Number.isFinite))return;
    const accuracy=Number.isFinite(c.accuracy)?c.accuracy:null;
    mapRef.current?.updateUserLocation(gps,accuracy,true);
    const nearest=closestSegment(geo.coords,geo.cumulative,gps);
    if(!nearest)return;
    const full=geo.cumulative.at(-1)||Number(route.distance_km);
    const fraction=full>0?Math.max(0,Math.min(1,(full-nearest.travelledKm)/full)):1;
    // The geometry is used for progress only; all shown distances/times use ORS summaries.
    const remaining=Number(route.distance_km)*fraction;
    const minutes=Number(route.duration_minutes)*fraction;
    const steps=route.directions_preview||[];
    let index=steps.findIndex(s=>Number.isInteger(s.start_index)&&geo.cumulative[s.start_index]!==undefined&&geo.cumulative[s.start_index]>nearest.travelledKm+0.03);
    if(index===-1&&steps.length)index=steps.length-1;
    const step=index>=0?steps[index]:null;
    const distanceKm=step && Number.isInteger(step.start_index)&&geo.cumulative[step.start_index]!==undefined?
      Math.max(0,geo.cumulative[step.start_index]-nearest.travelledKm):null;
    let warning='GPS progress is an approximation along the provider route; ETA does not include live traffic.';
    if(nearest.distanceKm>0.2&&(accuracy===null||accuracy<100))warning='You are over 200 m from the selected road route. Recalculate from GPS when safe.';
    else if(accuracy!==null&&accuracy>100)warning='GPS accuracy is low. Distances and turns may be unreliable.';
    setStats({
      status:`GPS active · accuracy ${accuracy===null?'unknown':Math.round(accuracy)+' m'}`,
      speed:Number.isFinite(c.speed)&&c.speed>=0?`${(c.speed*3.6).toFixed(0)} km/h`:'— km/h',
      remaining:`${remaining.toFixed(1)} km`,eta:formatMinutes(minutes),
      arrival:new Date(Date.now()+minutes*60000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
      next:step?.instruction||'Detailed instructions unavailable',
      nextDistance:distanceKm===null?'Turn distance unavailable':distanceKm<1?`${Math.round(distanceKm*1000)} m ahead`:`${distanceKm.toFixed(1)} km ahead`,
      activeStep:index,position:gps,warning,
    });
  },[route,geo,mapRef]);

  const start=useCallback(()=>{
    if(!route||!navigator.geolocation){setStats(s=>({...s,warning:'GPS is not supported here.'}));return;}
    if(watchRef.current!==null)return;
    setStats(s=>({...s,status:'Requesting GPS permission...'}));
    const watchId=navigator.geolocation.watchPosition(onPosition,error=>{
      setStats(s=>({...s,warning:`GPS unavailable: ${error.message}`,status:'GPS stopped'}));
      if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current=null;setActive(false);
    },{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
    watchRef.current=watchId;setActive(true);
  },[route,onPosition]);
  return {active,stats,start,stop};
}
