import { useEffect, useRef, useState } from 'react';
import { searchPlaces, resolvePlaceSuggestion, isCoords } from '../services/places.js';
import { isProfileApiConfigured, PLACE_LABELS, PLACE_KEYS, normalizePlace } from '../services/userProfile.js';

const SYMBOLS = {home:'⌂',work:'▣',school:'▤'};

/** Member profile: PRIVATE cloud Home/Work/School, no saved-trip/history tracking. */
export default function AccountPanel({
  profile, onClose, onSignIn, onSignOut, onExitGuest,
  myPlaces, myPlacesLoading, myPlacesError, onReloadMyPlaces,
  onSavePlace, onDeleteMyPlaces, onPlanTo,
  currentStart, currentEnd,
}) {
  const closeButton = useRef(null);
  const [editing,setEditing] = useState(null);
  const [query,setQuery] = useState('');
  const [suggestions,setSuggestions] = useState([]);
  const [candidate,setCandidate] = useState(null);
  const [searching,setSearching] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function beginEdit(slot) {
    setEditing(slot);setQuery('');setSuggestions([]);setCandidate(null);setMessage('');setError('');
  }
  async function findPlaces() {
    if(!query.trim()){setError('Enter a building, landmark or address to search.');return;}
    setError('');setSearching(true);setSuggestions([]);setCandidate(null);
    try {
      const results = await searchPlaces(query,undefined,`profile-${editing}`);
      setSuggestions(results);
      if(!results.length)setError('No Google Places matches. Try a specific area or nearby landmark.');
    } catch(err) {setError(err.message||'Search failed.');}
    finally {setSearching(false);}
  }
  async function chooseSuggestion(item) {
    setError('');setSearching(true);
    try {
      const resolved = await resolvePlaceSuggestion(item,`profile-${editing}`);
      setCandidate(normalizePlace(resolved));
      setQuery(resolved.name);
      setSuggestions([]);
    } catch(err) {setError(err.message||'Could not find location coordinates.');}
    finally {setSearching(false);}
  }
  function usePlannerLocation(location) {
    try {setCandidate(normalizePlace(location));setQuery(location.name);setSuggestions([]);setError('');}
    catch(err){setError(err.message);}
  }
  async function save(slot, place) {
    setError('');setMessage('');setBusy(true);
    try {
      await onSavePlace(slot,place);
      setEditing(null);setCandidate(null);setSuggestions([]);
      setMessage(place ? `${PLACE_LABELS[slot]} saved to your private cloud profile.` : `${PLACE_LABELS[slot]} removed from your profile.`);
    } catch(err) {setError(err.message||'Unable to save this location.');}
    finally {setBusy(false);}
  }
  async function deleteEverything() {
    if(!window.confirm('Permanently delete all your saved Home / Work / School locations?'))return;
    setError('');setMessage('');setBusy(true);
    try {await onDeleteMyPlaces();setEditing(null);setMessage('Your private My Places data has been deleted.');}
    catch(err){setError(err.message||'Unable to delete profile data.');}
    finally{setBusy(false);}
  }

  return <div className="dashboard-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <section id="my-account" className="dashboard-panel cx-profile-panel" role="dialog" aria-modal="true" aria-labelledby="account-panel-title">
      <div className="dashboard-top">
        <span className="account-kicker">✧ CLIMORA ACCOUNT · MY PLACES</span>
        <button ref={closeButton} type="button" className="account-close" onClick={onClose} aria-label="Close account panel">✕</button>
      </div>
      <div className="dashboard-intro">
        <div className="dashboard-avatar" aria-hidden="true">{(profile?.displayName?.[0] || 'G').toUpperCase()}</div>
        <div><p className="eyebrow">{profile ? 'SIGNED IN' : 'GUEST MODE'}</p>
          <h2 id="account-panel-title">{profile ? `Hello, ${profile.displayName}` : 'Welcome, explorer.'}</h2>
          <p>{profile?.email || 'You are browsing Climora without an account.'}</p></div>
      </div>
      <div className="cx-account-overview" role="status">
        <span className="cx-account-overview-icon" aria-hidden="true">{profile ? '⌖' : '◎'}</span>
        <div><strong>{profile ? 'Your private places' : 'Guest access is active'}</strong>
          <p>{profile ? 'Save Home, Work and School / College to your own AWS profile. No journey history or live GPS is stored here.' : 'Continue routing and exploring without cloud profile storage. Sign in to save private places.'}</p></div>
      </div>
      {profile ? <div className="cx-my-places">
        <div className="cx-places-heading"><div><h3>My Places</h3><p>Available on your devices when signed into the same Cognito account.</p></div>
          <button type="button" className="cx-place-secondary" onClick={onReloadMyPlaces} disabled={busy||myPlacesLoading||!isProfileApiConfigured}>↻ Refresh</button></div>
        {!isProfileApiConfigured && <p className="cx-profile-notice" role="alert">Cloud My Places is not connected yet. After AWS setup, add <code>VITE_CLIMORA_PROFILE_API_URL</code> and restart Vite. Your routes and login still work.</p>}
        {myPlacesLoading && <p className="cx-profile-info" role="status">Loading your private places from AWS…</p>}
        {myPlacesError && <p className="cx-profile-notice" role="alert">{myPlacesError}</p>}
        {!!message && <p className="cx-profile-success" role="status">✓ {message}</p>}
        {!!error && <p className="cx-profile-notice" role="alert">{error}</p>}
        {PLACE_KEYS.map(slot=>{
          const saved=myPlaces?.places?.[slot];
          return <div className="cx-place-card" key={slot}>
            <div className="cx-place-top"><span className="cx-place-symbol" aria-hidden="true">{SYMBOLS[slot]}</span>
              <div className="cx-place-description"><strong>{PLACE_LABELS[slot]}</strong><span>{saved?.name || 'Not set yet'}</span></div></div>
            <div className="cx-place-buttons">
              <button type="button" disabled={!isProfileApiConfigured||busy||myPlacesLoading} onClick={()=>beginEdit(slot)}>{saved?'Change':'Set location'}</button>
              {saved && <button type="button" disabled={busy} onClick={()=>{onPlanTo(saved);onClose();}}>↗ Route here</button>}
              {saved && <button className="cx-place-danger" type="button" disabled={busy} onClick={()=>void save(slot,null)}>Remove</button>}
            </div>
            {editing===slot && <div className="cx-place-edit">
              <label htmlFor={`cx-place-query-${slot}`}>Find {PLACE_LABELS[slot]} on Google Places</label>
              <div className="cx-place-search"><input id={`cx-place-query-${slot}`} value={query} placeholder="Building, society, landmark or address" onChange={e=>{setQuery(e.target.value);setCandidate(null);setSuggestions([]);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void findPlaces();}}} autoComplete="off"/>
                <button type="button" disabled={searching||busy} onClick={()=>void findPlaces()}>{searching?'Searching…':'Search'}</button></div>
              {!!suggestions.length && <div className="cx-place-suggestions" aria-label="Place search suggestions">
                {suggestions.map((item,i)=><button key={`${item.name}-${i}`} type="button" disabled={searching} onClick={()=>void chooseSuggestion(item)}>{item.name}</button>)}
              </div>}
              <p className="cx-profile-info">Or choose a location you already selected in the planner:</p>
              <div className="cx-place-buttons">
                <button type="button" disabled={!isCoords(currentStart?.coords)} onClick={()=>usePlannerLocation(currentStart)}>Use planner start</button>
                <button type="button" disabled={!isCoords(currentEnd?.coords)} onClick={()=>usePlannerLocation(currentEnd)}>Use planner destination</button>
              </div>
              {candidate && <p className="cx-place-selected">✓ Selected: {candidate.name}</p>}
              <div className="cx-place-buttons"><button className="cx-place-save" type="button" disabled={!candidate||busy||myPlacesLoading} onClick={()=>void save(slot,candidate)}>{busy?'Saving…':`Save ${PLACE_LABELS[slot]}`}</button>
                <button type="button" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
            </div>}
          </div>;
        })}
        <div className="cx-profile-privacy"><span>🔒</span> Only your verified Cognito identity may read or edit these places. GPS travel history is not stored.
          <button type="button" disabled={busy||!isProfileApiConfigured||myPlacesLoading} onClick={()=>void deleteEverything()}>Delete all My Places data</button></div>
      </div> : <div className="cx-profile-guest"><strong>Save your everyday destinations</strong><p>Sign in to securely save Home, Work or School/College in AWS DynamoDB.</p></div>}
      <div className="dashboard-bottom">
        {profile ? <button type="button" className="dashboard-signout" onClick={onSignOut}>Sign out</button>
          : <><button type="button" className="account-primary" onClick={onSignIn}>Sign in / Create account ↗</button>
            <button type="button" className="dashboard-signout" onClick={onExitGuest}>Leave Guest Mode</button></>}
        <button type="button" className="dashboard-cancel" onClick={onClose}>Back to planner</button>
      </div>
    </section>
  </div>;
}
