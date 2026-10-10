import { useEffect, useRef } from 'react';
import { MODE_META, formatMinutes } from '../services/places.js';

const prettyTime = iso => {
  const date = new Date(iso);
  return Number.isNaN(+date) ? 'Saved journey' : date.toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'});
};

export default function UserDashboard({ profile, trips, onClose, onSignIn, onSignOut, onExitGuest, onRemoveTrip, onUseTrip,
  syncStatus='local', syncError='', onRetrySync, localImportCount=0, importingTrips=false, onImportLocal }) {
  const closeButton = useRef(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = event => { if(event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const label=profile ? (syncStatus==='cloud'?'Cloud synced':syncStatus==='loading'?'Connecting…':syncStatus==='error'?'Sync issue':'Local only') : 'Guest · Local only';
  const isCloud=profile && syncStatus==='cloud';
  return <div className="dashboard-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section id="my-dashboard" className="dashboard-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-title">
      <div className="dashboard-top"><span className="account-kicker">✧ YOUR CLIMORA SPACE</span><button ref={closeButton} className="account-close" onClick={onClose} aria-label="Close dashboard">✕</button></div>
      <div className="dashboard-intro">
        <div className="dashboard-avatar">{(profile?.displayName?.[0] || 'G').toUpperCase()}</div>
        <div><p className="eyebrow">{profile?'MEMBER ACCOUNT':'GUEST EXPERIENCE'}</p><h2 id="dashboard-title">{profile?`Hello, ${profile.displayName}`:'Your journey, your way.'}</h2><p>{profile?.email || 'Explore freely. Sign in when you are ready.'}</p></div>
      </div>
      <div className="dashboard-stats"><div><span>Saved journeys</span><strong>{trips.length}</strong></div><div><span>Travel modes</span><strong>{new Set(trips.map(t=>t.mode)).size}</strong></div><div><span>Sync status</span><strong>{label}</strong></div></div>
      <div className="dashboard-section-title"><div><span className="eyebrow">YOUR SHORTCUTS</span><h3>Saved trips</h3></div><span className="dashboard-local-pill">{isCloud?"☁ AWS DynamoDB":label}</span></div>
      {syncStatus==='loading'&&profile&&<div className="dashboard-sync-box" role="status">⏳ Loading your cloud journeys…</div>}
      {!!syncError&&<div className="dashboard-sync-error" role="alert"><strong>Cloud sync needs attention</strong><p>{syncError}</p><button className="dashboard-sync-action" onClick={onRetrySync}>Try again</button></div>}
      {isCloud && localImportCount>0 &&<div className="dashboard-sync-box"><strong>Previously saved trips found on this device</strong><p>{localImportCount} local journey(s) can be copied to your cloud account. Nothing is uploaded automatically.</p><button disabled={importingTrips} className="dashboard-sync-action" onClick={onImportLocal}>{importingTrips?'Importing…':`Import ${localImportCount} trip(s) to cloud`}</button></div>}
      {trips.length===0&&syncStatus!=='loading'?<div className="dashboard-empty"><div aria-hidden="true">⌖</div><strong>No saved journeys yet</strong><p>Calculate a route, then choose “Save this journey” from its route details. Your saved routes will show up here.</p><button className="account-primary" onClick={onClose}>Explore routes →</button></div>:<div className="dashboard-trip-list">
        {trips.map(trip=><article className="dashboard-trip" key={trip.id}>
          <div className="dashboard-trip-icon" aria-hidden="true">{MODE_META[trip.mode]?.emoji||'⌖'}</div>
          <div className="dashboard-trip-main"><strong>{trip.start.name} <span>→</span> {trip.end.name}</strong><div>{MODE_META[trip.mode]?.label || trip.mode} · {prettyTime(trip.savedAt)}</div><small>{trip.distanceKm!=null?`${trip.distanceKm.toFixed(1)} km · `:''}{trip.durationMin!=null?formatMinutes(trip.durationMin):'Route can be recalculated'} · estimate when saved</small></div>
          <div className="dashboard-trip-actions"><button onClick={()=>onUseTrip(trip)}>Plan again ↗</button><button className="remove" onClick={()=>onRemoveTrip(trip.id)} aria-label={`Remove trip from ${trip.start.name} to ${trip.end.name}`}>Remove</button></div>
        </article>)}
      </div>}
      <div className="dashboard-note">{isCloud?
        'Signed-in saved journeys are stored in your account-specific AWS DynamoDB records and can be loaded on another device. A fresh route request is required for up-to-date ETA, traffic and weather.':
        profile?'Cloud storage is not enabled or reachable in this session. When Cloud Trips API is not configured, journeys are saved locally to this browser only.':
        'Guest journeys stay in this browser only. Sign in for cloud-synced trips when configured. Never store passwords or route data in screenshots.'}</div>
      <div className="dashboard-bottom">{profile?<button className="dashboard-signout" onClick={onSignOut}>Sign out</button>:<><button className="account-primary" onClick={onSignIn}>Create account / Sign in →</button><button className="dashboard-signout" onClick={onExitGuest}>Leave Guest Mode</button></>}<button className="dashboard-cancel" onClick={onClose}>Back to planner</button></div>
    </section>
  </div>;
}
