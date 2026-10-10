import assert from 'node:assert/strict';
import {
  hourlyValue, routeSamplingPoints, calculateDepartureSlots, chooseDeparture,
  getSmartDepartureForecast
} from '../src/services/departure.js';

const base = Date.parse('2026-10-10T00:00:00.000Z');
const now = base + 6*3600_000;
const times = Array.from({length:72},(_,i)=>base/1000+i*3600);
const route = { id:'A',name:'Fastest route',duration_minutes:60,distance_km:12,
  geometry:{type:'LineString',coordinates:[[72.8,19],[72.85,19.02],[72.9,19.05]]} };
const points = routeSamplingPoints(route.geometry);
const makeRecord = (values) => ({latitude:19.1, longitude:72.8, hourly: {time:times, ...values}});
const same = val=>times.map(()=>val);
const airSamples = (pm) => points.map(()=>makeRecord({pm2_5:pm,us_aqi:same(80)}));
const weatherSamples = (rain) => points.map(()=>makeRecord({precipitation:rain, temperature_2m:same(31),wind_speed_10m:same(12)}));
let n=0;
const test = async (label, fn) => {await fn();n++;process.stdout.write(`✓ ${label}\n`);};

await test('Hourly interpolation respects UTC seconds',()=>{
  const record = makeRecord({pm2_5:times.map((_,i)=>i*2)});
  assert.equal(hourlyValue(record,'pm2_5',base+90*60_000),3);
  assert.equal(hourlyValue(record,'pm2_5',base-60_000),null);
  assert.equal(hourlyValue(record,'unknown',base),null);
});
await test('Route sampling uses true road geometry and five points',()=>{
  assert.equal(points.length,5);
  assert.deepEqual(points[0].coords,route.geometry.coordinates[0]);
  assert.deepEqual(points[4].coords,route.geometry.coordinates.at(-1));
});
await test('Same forecasts lead to no speculative waiting suggestion',()=>{
  const slots=calculateDepartureSlots(route,points,airSamples(same(40)),weatherSamples(same(0)),now);
  assert.equal(slots.length,5);
  assert.equal(slots[0].pmTimeProxy,40);
  assert.equal(slots[0].arrivalMs,now+3600_000);
  assert.equal(chooseDeparture(slots).status,'no-clear-benefit');
});
await test('Strong modeled PM improvement can suggest a later time',()=>{
  const pm = times.map((_,i)=> i<8 ? 65 : i===8 ? 30 : 28);
  const slots=calculateDepartureSlots(route,points,airSamples(pm),weatherSamples(same(0)),now);
  const decision=chooseDeparture(slots);
  assert.equal(decision.status,'lower-modeled-pm');
  assert.equal(decision.offsetHours,1); // earliest materially better departure during transitional hour
});
await test('Heavy rain easing can suggest drier departure, if PM remains stable',()=>{
  const rain=times.map((_,i)=>i<8?3:0);
  const slots=calculateDepartureSlots(route,points,airSamples(same(45)),weatherSamples(rain),now);
  const decision=chooseDeparture(slots);
  assert.equal(decision.status,'potentially-drier');
  assert.equal(decision.offsetHours,2);
});
await test('Missing weather never generates confident later recommendation',()=>{
  const pm=times.map((_,i)=>i<8?65:20);
  const slots=calculateDepartureSlots(route,points,airSamples(pm),null,now);
  assert.equal(slots[0].availableWeather,false);
  assert.equal(chooseDeparture(slots).status,'insufficient');
});
await test('Weather deterioration blocks modeled cleaner-hour recommendation',()=>{
  const pm=times.map((_,i)=>i<8?65:20);
  const rain=times.map((_,i)=>i<8?0:4);
  const slots=calculateDepartureSlots(route,points,airSamples(pm),weatherSamples(rain),now);
  assert.equal(chooseDeparture(slots).status,'no-clear-benefit');
});
await test('Fetch calls preserve provider URL variables, no AWS routing calls',async()=>{
  const called=[];
  const fetcher=async url=>{
    called.push(url);
    const isAir=url.includes('air-quality');
    const response=isAir?airSamples(same(33)):weatherSamples(same(0));
    return {ok:true,json:async()=>response};
  };
  const result=await getSmartDepartureForecast(route,undefined,fetcher,now);
  assert.equal(called.length,2);
  assert.ok(called.every(x=>x.includes('timeformat=unixtime')));
  assert.ok(called.some(x=>x.includes('pm2_5%2Cus_aqi')));
  assert.equal(result.dataStatus.air,'available');
  assert.equal(result.slots.length,5);
});
await test('Air failure keeps weather-only cards and reports insufficient recommendation',async()=>{
  const fetcher=async url=> url.includes('air-quality')
    ? {ok:false,status:429,json:async()=>({})}
    : {ok:true,json:async()=>weatherSamples(same(.2))};
  const result=await getSmartDepartureForecast(route,undefined,fetcher,now);
  assert.equal(result.dataStatus.air,'unavailable');
  assert.equal(result.dataStatus.weather,'available');
  assert.equal(result.decision.status,'insufficient');
});
await test('Both forecast services fail gracefully; AWS route remains unaffected',async()=>{
  await assert.rejects(getSmartDepartureForecast(route,undefined,async()=>({ok:false,status:500}),now),/forecast services are unavailable/);
});
await test('Missing geometry refuses to fake forecast routes',async()=>{
  await assert.rejects(getSmartDepartureForecast({...route,geometry:null},undefined,async()=>({}),now),/geometry/);
});
console.log(`PASS: ${n} Smart Departure forecast tests`);
