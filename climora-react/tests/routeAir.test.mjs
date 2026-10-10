import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleRoute, getRouteAirIntelligence } from '../src/services/routeAir.js';
const now = Date.parse('2026-10-09T12:35:00Z');
const baseTime = Math.floor(now / 3600000) * 3600 - 3600;
const time = Array.from({ length: 48 }, (_, i) => baseTime + i * 3600);
const sameGrid = (lat,lon) => ({ latitude: 19.2, longitude: 72.8, hourly: {time,pm2_5: time.map(()=>55), us_aqi:time.map(()=>150)}});
const variedGrid = (lat,lon) => lat > 19.15
  ? { latitude: 19.5, longitude: 73.0, hourly:{time,pm2_5:time.map(()=>12),us_aqi:time.map(()=>60)}}
  : sameGrid(lat,lon);
const mockFetch = model => async url => {
  const u = new URL(url);
  assert.equal(u.searchParams.get('domains'),'cams_global');
  assert.equal(u.searchParams.get('timeformat'),'unixtime');
  const lats = u.searchParams.get('latitude').split(',').map(Number);
  const lons = u.searchParams.get('longitude').split(',').map(Number);
  assert.equal(lats.length,lons.length);
  return { ok:true, json:async()=>lats.map((lat,i)=>model(lat,lons[i])) };
};
const routes = [
  {id:'A',name:'Fastest',duration_minutes:30,distance_km:25,within_time_limit:true,geometry:{type:'LineString',coordinates:[[72.8,19],[73.0,19]]}},
  {id:'B',name:'Alternative',duration_minutes:34,distance_km:27,within_time_limit:true,geometry:{type:'LineString',coordinates:[[72.8,19],[72.85,19.35],[73.0,19]]}},
];
test('road samples include endpoints and midpoint',()=>{
  const r=sampleRoute({coordinates:[[72.8,19],[73,19]]},5);
  assert.equal(r.length,5);
  assert.equal(r[0].coords[0],72.8);
  assert.equal(r[4].coords[0],73);
  assert.ok(Math.abs(r[2].coords[0]-72.9)<.001);
});
test('same coarse model cell never claims lower pollution route',async()=>{
  const result=await getRouteAirIntelligence(routes,'A',undefined,mockFetch(sameGrid),now);
  assert.equal(result.status,'indistinguishable');
  assert.equal(result.recommendationId,null);
  assert.equal(result.modelCells,1);
  assert.ok(Math.abs(result.byRoute.A.avgPm25-55)<.001);
  assert.ok(result.byRoute.A.pmTimeProxy<result.byRoute.B.pmTimeProxy);
});
test('meaningfully lower modeled PM can recommend valid detour only',async()=>{
  const result=await getRouteAirIntelligence(routes,'A',undefined,mockFetch(variedGrid),now);
  assert.equal(result.status,'lower-modelled-exposure');
  assert.equal(result.recommendationId,'B');
  assert.ok(result.byRoute.B.avgPm25<result.byRoute.A.avgPm25);
  assert.ok(result.modelCells>=2);
});
test('does not recommend a longer-than-allowed detour',async()=>{
  const invalid=[routes[0],{...routes[1],within_time_limit:false}];
  const result=await getRouteAirIntelligence(invalid,'A',undefined,mockFetch(variedGrid),now);
  assert.equal(result.recommendationId,null);
});
test('API failure is surfaced to caller without changing routing data',async()=>{
  await assert.rejects(()=>getRouteAirIntelligence(routes,'A',undefined,async()=>({ok:false,status:429}),now),/429/);
  assert.equal(routes[0].duration_minutes,30);
  assert.equal(routes[0].distance_km,25);
});
test('single route is informational and has no comparative claim',async()=>{
  const result=await getRouteAirIntelligence([routes[0]],'A',undefined,mockFetch(sameGrid),now);
  assert.equal(result.status,'single');
  assert.equal(result.recommendationId,null);
});
