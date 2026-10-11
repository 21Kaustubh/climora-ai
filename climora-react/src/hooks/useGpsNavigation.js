import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {formatMinutes} from '../services/places.js';
import {buildRouteGeometry, nearestRoutePosition, approximateNextInstruction, gpsProgress} from '../services/navigationMath.js';

const MIN_REROUTE_INTERVAL_MS = 120_000;
const OFF_ROUTE_LIMIT_KM = 0.25;
const MAX_GOOD_ACCURACY_METERS = 75;

function initialStats(route) {
  return {
    status: route ? 'Route ready — press Start Journey to enable GPS.' : 'Calculate an eligible route first.',
    warning:'Navigation works while this browser tab stays active. Device GPS accuracy varies; do not interact with the phone while driving.',
    speed:'— km/h', remaining:route?`${Number(route.distance_km).toFixed(1)} km`:'— km',
    eta:route?formatMinutes(route.duration_minutes):'—', arrival:'—',
    next:route?.directions_preview?.[0]?.instruction || 'Select a route to see directions.',
    nextDistance:'Start to see next-turn distance',activeStep:null,position:null,
    progressPercent:0,accuracyMeters:null,offRoute:false,arrived:false,
    nextInstructionApproximate:true,lastFixAt:null,distanceFromRoadMeters:null,
  };
}

export function useGpsNavigation(route, mapRef, {onReroute, autoReroute=false, follow=true, voice=false}={}) {
  const [active,setActive]=useState(false);
  const [stats,setStats]=useState(()=>initialStats(route));
  const watchRef=useRef(null);
  const currentRouteRef=useRef(route);
  const callbacksRef=useRef({onReroute,autoReroute,follow,voice});
  callbacksRef.current={onReroute,autoReroute,follow,voice};
  const offRoadCountRef=useRef(0);
  const sawRoadRef=useRef(false);
  const lastRerouteRef=useRef(-Infinity);
  const notifiedInstructionRef=useRef('');
  const geometry=useMemo(()=>buildRouteGeometry(route),[route]);

  const clearWatch=useCallback(()=>{
    if(watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current=null;
    setActive(false);
  },[]);
  const stop=useCallback(()=>{
    offRoadCountRef.current=0;
    clearWatch();
    if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();
    setStats(old=>({...old,status:route?'Journey paused · GPS off':'No route calculated.',offRoute:false}));
  },[route,clearWatch]);

  useEffect(()=>{
    currentRouteRef.current=route;
    clearWatch();
    if (typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();
    offRoadCountRef.current=0;sawRoadRef.current=false;notifiedInstructionRef.current='';
    setStats(initialStats(route));
    return()=>{clearWatch();};
  },[route,clearWatch]);

  const onPosition=useCallback(pos=>{
    const currentRoute=currentRouteRef.current;
    if(!currentRoute||geometry.coords.length<2)return;
    const gps=[pos.coords.longitude,pos.coords.latitude];
    if(!gps.every(Number.isFinite))return;
    const accuracy=Number.isFinite(pos.coords.accuracy)?pos.coords.accuracy:null;
    const goodAccuracy=accuracy!==null&&accuracy<=MAX_GOOD_ACCURACY_METERS;
    const closest=nearestRoutePosition(geometry,gps);
    if(!closest)return;
    const progress=gpsProgress(currentRoute,geometry,closest);
    const offRoute=goodAccuracy&&closest.distanceKm>OFF_ROUTE_LIMIT_KM;
    const nearArrival=goodAccuracy&&progress.remainingKm<0.12 &&
      Number.isFinite(closest.distanceKm)&&closest.distanceKm<0.12;
    if(goodAccuracy&&closest.distanceKm<0.12) sawRoadRef.current=true;
    if(offRoute)offRoadCountRef.current+=1;else offRoadCountRef.current=0;
    const instruction=approximateNextInstruction(currentRoute.directions_preview,geometry,closest.travelledKm);
    const nextDistance=instruction.distanceKm===null?'Distance unavailable':instruction.distanceKm<1?
      `${Math.round(instruction.distanceKm*1000)} m ahead`:`${instruction.distanceKm.toFixed(1)} km ahead`;
    const currentSpeed=Number.isFinite(pos.coords.speed)&&pos.coords.speed>=0?
      `${(pos.coords.speed*3.6).toFixed(0)} km/h`:'— km/h';
    const warning=nearArrival?'Near destination. Verify you have reached the correct entrance.':
      accuracy===null?'GPS accuracy unavailable; route progress may be unreliable.':
      accuracy>MAX_GOOD_ACCURACY_METERS?'GPS accuracy is low. Move outdoors; turns may be unreliable.':
      offRoute?'Possibly off route (>250 m). Choose Recalculate from GPS if needed.':
      currentRoute.traffic_aware?'Arrival is projected from traffic-aware ETA at calculation time; congestion is NOT continuously refreshed.':
      'Arrival is projected from provider ETA; no live-traffic updates.';
    mapRef.current?.updateUserLocation(gps,accuracy,callbacksRef.current.follow);
    setStats({
      status:nearArrival?'Approaching destination':`GPS tracking · ${accuracy===null?'accuracy unknown':`±${Math.round(accuracy)} m`}`,
      warning, speed:currentSpeed, remaining:`${progress.remainingKm.toFixed(1)} km`,
      eta:formatMinutes(progress.remainingMinutes),
      arrival:new Date(Date.now()+progress.remainingMinutes*60_000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
      next:instruction.instruction,nextDistance,activeStep:instruction.activeIndex,
      position:gps,progressPercent:progress.progressPercent,accuracyMeters:accuracy,
      offRoute,arrived:nearArrival,nextInstructionApproximate:instruction.approximate,
      lastFixAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
      distanceFromRoadMeters:Math.round(closest.distanceKm*1000),
    });

    // Voice is intentionally opt-in and only announced near a modeled maneuver.
    // The user is warned that provider instructions may only approximate location.
    const voiceKey=`${String(currentRoute.id)}:${instruction.activeIndex}`;
    if(callbacksRef.current.voice&&typeof window!=='undefined'&&window.speechSynthesis&&
       instruction.distanceKm!==null&&instruction.distanceKm<=0.25&&
       instruction.activeIndex!==null&&voiceKey!==notifiedInstructionRef.current&&goodAccuracy) {
      notifiedInstructionRef.current=voiceKey;
      try{
        const utterance=new SpeechSynthesisUtterance(instruction.instruction);
        utterance.rate=0.95;utterance.lang='en-IN';
        window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
      }catch{/* Keep GPS tracking functional if voice unavailable. */}
    }

    // Require 3 consecutive good off-road fixes, at least one earlier on-road
    // fix and a two-minute cooldown. Only recalculate; never silently switch roads.
    if(callbacksRef.current.autoReroute&&offRoadCountRef.current>=3&&sawRoadRef.current&&
       Date.now()-lastRerouteRef.current>=MIN_REROUTE_INTERVAL_MS&&
       typeof callbacksRef.current.onReroute==='function') {
      lastRerouteRef.current=Date.now();
      offRoadCountRef.current=0;
      clearWatch();
      setStats(previous=>({...previous,status:'Recalculating from current GPS point…'}));
      callbacksRef.current.onReroute(gps);
    }
  },[geometry,mapRef,clearWatch]);

  const start=useCallback(()=>{
    if(!route){setStats(old=>({...old,warning:'Select an eligible route first.'}));return;}
    if(!navigator.geolocation){setStats(old=>({...old,warning:'This device does not support GPS geolocation.'}));return;}
    if(typeof window!=='undefined'&&!window.isSecureContext){setStats(old=>({...old,warning:'GPS requires HTTPS or localhost. Open Climora securely.'}));return;}
    if(watchRef.current!==null)return;
    setStats(old=>({...old,status:'Requesting location permission…'}));
    try{
      const watchId=navigator.geolocation.watchPosition(onPosition,err=>{
        clearWatch();
        setStats(old=>({...old,status:'GPS stopped',warning:`GPS error: ${err.message}`}));
      },{enableHighAccuracy:true,maximumAge:1500,timeout:20000});
      watchRef.current=watchId;setActive(true);
    }catch(err){setStats(old=>({...old,warning:err.message||'Cannot start GPS.'}));}
  },[route,onPosition,clearWatch]);

  return {active,stats,start,stop};
}
