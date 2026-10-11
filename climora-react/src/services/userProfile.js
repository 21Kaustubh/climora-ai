/** Climora My Places: private Home/Work/School profile, NOT saved journeys. */
import { getAccessToken } from '../auth/cognito.js';

export const PROFILE_API_URL = (import.meta.env.VITE_CLIMORA_PROFILE_API_URL || '').trim().replace(/\/+$/, '');
export const isProfileApiConfigured = Boolean(/^https:\/\//i.test(PROFILE_API_URL) || /^http:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/.test(PROFILE_API_URL));
export const PLACE_KEYS = ['home', 'work', 'school'];
export const PLACE_LABELS = {home:'Home',work:'Work',school:'School / College'};

export function emptyPlaces() {return {home:null,work:null,school:null};}
export function emptyUserProfile() {return {places:emptyPlaces(),revision:0,updatedAt:null};}

export function normalizePlace(place) {
  if(!place)return null;
  const name=String(place.name||'').trim();
  const coords=place.coords;
  if(name.length<2||name.length>150 || !Array.isArray(coords) || coords.length!==2 ||
      !Number.isFinite(coords[0])||!Number.isFinite(coords[1])||
      Math.abs(coords[0])>180||Math.abs(coords[1])>90)throw new Error('Choose a valid place from Google suggestions or the map.');
  const normalized={name,coords:[coords[0],coords[1]]};
  if(typeof place.placeId==='string' && place.placeId.length<=256 && place.placeId)
    normalized.placeId=place.placeId;
  return normalized;
}

export function normalizeProfile(profile) {
  const places=emptyPlaces();
  for(const k of PLACE_KEYS)places[k]=normalizePlace(profile?.places?.[k]);
  const revision=Number(profile?.revision||0);
  return {places,revision:Number.isInteger(revision)&&revision>=0?revision:0,
    updatedAt:profile?.updatedAt||null};
}

async function requestProfile(method, body) {
  if(!isProfileApiConfigured)throw new Error('Cloud My Places is not connected. Set VITE_CLIMORA_PROFILE_API_URL first.');
  const token=await getAccessToken();
  if(!token)throw new Error('Your sign-in session expired. Sign out and sign in again.');
  const response=await fetch(PROFILE_API_URL,{
    method,
    headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:'no-store',
  });
  let data;
  try{data=await response.json();}catch{data={};}
  if(!response.ok)throw new Error(data.error||`Profile API returned HTTP ${response.status}. Check Cognito JWT, CORS and Lambda integration.`);
  return normalizeProfile(data.profile);
}

export const fetchUserProfile=()=>requestProfile('GET');
export const deleteUserProfile=()=>requestProfile('DELETE');

export function putPlace(profile,slot,place){
  if(!PLACE_KEYS.includes(slot))throw new Error('Unknown saved place.');
  const current=normalizeProfile(profile);
  const places={...current.places,[slot]:normalizePlace(place)};
  return requestProfile('PUT',{places,revision:current.revision});
}
