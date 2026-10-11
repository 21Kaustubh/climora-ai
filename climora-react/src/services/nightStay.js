/** Find real published stays around an intermediate road point; NOT booking availability.
 * Google Places Nearby Search (New) is called only when the user clicks Search.
 */
import { ensureGoogleMapsLoaded } from '../lib/googleMap.js';

export function geoKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2) return NaN;
  const r = Math.PI / 180;
  const x = Math.sin((b[1]-a[1])*r/2)**2 + Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;
  return 12742*Math.asin(Math.min(1, Math.sqrt(Math.max(0,x))));
}

/** True road-length-based progression (not just midpoint of GPS vertex array). */
export function routePointAtFraction(route, fraction=0.5) {
  const points=route?.geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2) return null;
  const good=points.filter(p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite));
  if(good.length < 2)return null;
  const distances=good.slice(1).map((p,i)=>geoKm(good[i],p));
  const total=distances.reduce((acc,d)=>acc+d,0);
  if(!(total>0))return good[0].slice();
  let target=total*Math.max(0,Math.min(1,Number(fraction)||0));
  for(let i=0;i<distances.length;i++){
    if(target<=distances[i]||i===distances.length-1){
      const t=distances[i]?target/distances[i]:0;
      return [good[i][0]+(good[i+1][0]-good[i][0])*t,good[i][1]+(good[i+1][1]-good[i][1])*t];
    }
    target-=distances[i];
  }
  return good[good.length-1].slice();
}

export function stayMapSearchUrl(center){
  if(!Array.isArray(center)||center.length!==2)return 'https://www.google.com/maps/search/hotels/';
  const q=new URLSearchParams({api:'1',query:`hotels near ${center[1].toFixed(5)},${center[0].toFixed(5)}`});
  return `https://www.google.com/maps/search/?${q}`;
}

export async function findNightStays(center,{radiusMeters=3500}={}) {
  if(!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite))throw new Error('Calculate a route first.');
  await ensureGoogleMapsLoaded();
  const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary('places');
  if(!Place?.searchNearby)throw new Error('Google Places Nearby Search is unavailable. Check Places API (New).');
  const request={
    fields:['id','displayName','formattedAddress','googleMapsURI','location'],
    locationRestriction:{center:{lat:center[1],lng:center[0]},radius:Math.max(100,Math.min(10000,radiusMeters))},
    includedTypes:['lodging'],maxResultCount:8,
    rankPreference:SearchNearbyRankPreference?.DISTANCE||'DISTANCE',
  };
  const { places=[] }=await Place.searchNearby(request);
  return places.map((p,i)=>{
    const lat=Number(typeof p.location?.lat==='function'?p.location.lat():p.location?.lat);
    const lng=Number(typeof p.location?.lng==='function'?p.location.lng():p.location?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
    const coords=[lng,lat];
    const label=String(p.displayName||'Stay').trim();
    const mapsUrl=p.googleMapsURI||`https://www.google.com/maps/search/?${new URLSearchParams({api:'1',query:`${label} ${p.formattedAddress||''}`, ...(p.id?{query_place_id:p.id}:{})})}`;
    return {id:p.id||`${i}-${lat}-${lng}`,name:label,address:p.formattedAddress||'',coords,straightLineKm:geoKm(center,coords),mapsUrl};
  }).filter(Boolean).sort((a,b)=>a.straightLineKm-b.straightLineKm);
}
