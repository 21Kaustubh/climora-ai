import { useEffect, useRef } from 'react';

/** Profile and session controls only. This app does not store journeys. */
export default function AccountPanel({ profile, onClose, onSignIn, onSignOut, onExitGuest }) {
  const closeButton = useRef(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return <div className="dashboard-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="my-account" className="dashboard-panel" role="dialog" aria-modal="true" aria-labelledby="account-panel-title">
      <div className="dashboard-top">
        <span className="account-kicker">✧ CLIMORA ACCOUNT</span>
        <button ref={closeButton} type="button" className="account-close" onClick={onClose} aria-label="Close account panel">✕</button>
      </div>
      <div className="dashboard-intro">
        <div className="dashboard-avatar" aria-hidden="true">{(profile?.displayName?.[0] || 'G').toUpperCase()}</div>
        <div>
          <p className="eyebrow">{profile ? 'SIGNED IN' : 'GUEST MODE'}</p>
          <h2 id="account-panel-title">{profile ? `Hello, ${profile.displayName}` : 'Welcome, explorer.'}</h2>
          <p>{profile?.email || 'You are browsing Climora without an account.'}</p>
        </div>
      </div>
      <div className="cx-account-overview" role="status">
        <span className="cx-account-overview-icon" aria-hidden="true">{profile ? '✓' : '⌖'}</span>
        <div>
          <strong>{profile ? 'Your account is connected' : 'Guest access is active'}</strong>
          <p>{profile
            ? 'You are signed in with AWS Cognito. Route planning, Google Maps, GPS navigation and environmental insights are available.'
            : 'Explore routes, maps, navigation and climate insights without signing in.'}</p>
        </div>
      </div>
      <div className="cx-account-summary">
        <div><span>Access type</span><strong>{profile ? 'Member' : 'Guest'}</strong></div>
        <div><span>Navigation</span><strong>Available</strong></div>
        <div><span>Environmental insights</span><strong>Available</strong></div>
      </div>
      <div className="dashboard-bottom">
        {profile
          ? <button type="button" className="dashboard-signout" onClick={onSignOut}>Sign out</button>
          : <><button type="button" className="account-primary" onClick={onSignIn}>Sign in / Create account ↗</button>
              <button type="button" className="dashboard-signout" onClick={onExitGuest}>Leave Guest Mode</button></>}
        <button type="button" className="dashboard-cancel" onClick={onClose}>Back to planner</button>
      </div>
    </section>
  </div>;
}
