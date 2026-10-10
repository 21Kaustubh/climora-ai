import { useEffect, useState } from 'react';

const features = [
  { icon: '⌖', title: 'Real road navigation', sub: 'Actual mapped routes & travel modes' },
  { icon: '◈', title: 'Climate intelligence', sub: 'Modeled AQI, PM2.5 & weather' },
  { icon: '◷', title: 'Smart departure', sub: 'Compare forecast journey windows' },
];

export default function EntryGate({ onSignIn, onGuest }) {
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    document.title = 'Welcome to Climora AI | Choose how to explore';
    const animation = requestAnimationFrame(() => setIntroReady(true));
    return () => cancelAnimationFrame(animation);
  }, []);

  return <main className={`cx-entry ${introReady ? 'cx-entry-ready' : ''}`}>
    <div className="cx-entry-lights" aria-hidden="true"><i/><i/><i/></div>
    <header className="cx-entry-header">
      <div className="cx-entry-brand"><span className="cx-entry-logo" aria-hidden="true">✦</span><span>CLIMORA <b>AI</b></span></div>
      <span className="cx-entry-header-note">SMARTER JOURNEYS · BETTER AWARENESS</span>
    </header>
    <div className="cx-entry-layout">
      <section className="cx-entry-intro" aria-labelledby="cx-entry-title">
        <div className="cx-entry-kicker"><span className="cx-entry-kicker-dot"/> WELCOME TO A MORE CONSCIOUS WAY TO MOVE</div>
        <h1 id="cx-entry-title">Every journey.<br/><em>More intelligent.</em><br/><span>More conscious.</span></h1>
        <p>Navigate real roads and understand the environmental conditions along your journey. Your next move begins with a choice.</p>
        <div className="cx-entry-visual" aria-hidden="true">
          <svg viewBox="0 0 640 195" fill="none" role="presentation" preserveAspectRatio="xMidYMid meet">
            <defs><linearGradient id="cxGateLine" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#67eab5"/><stop offset="1" stopColor="#4ca1ff"/></linearGradient></defs>
            <path d="M0 160 Q120 110 190 130T340 75T640 60" stroke="#7dcbb6" strokeWidth="1" strokeDasharray="6 12" opacity=".18"/>
            <path className="cx-entry-route-line" d="M32 164 C102 173 108 109 177 115 C258 122 261 151 324 92 S446 45 512 68 S573 27 610 24" stroke="url(#cxGateLine)" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="32" cy="164" r="10" stroke="#90f9cb" strokeWidth="3" fill="#091a20"/>
            <circle cx="610" cy="24" r="9" fill="#8aefca"/><circle cx="610" cy="24" r="16" stroke="#8aefca" opacity=".25"/>
            <circle className="cx-entry-route-dot" r="6" fill="#eafff6"><animateMotion dur="7s" repeatCount="indefinite" path="M32 164 C102 173 108 109 177 115 C258 122 261 151 324 92 S446 45 512 68 S573 27 610 24"/></circle>
          </svg>
          <div className="cx-entry-visual-label">DISCOVER · COMPARE · NAVIGATE</div>
        </div>
        <div className="cx-entry-features">{features.map(item=><div className="cx-entry-feature" key={item.title}><span className="cx-entry-feature-icon">{item.icon}</span><div><strong>{item.title}</strong><small>{item.sub}</small></div></div>)}</div>
      </section>
      <section className="cx-entry-card" aria-label="Choose how to access Climora">
        <div className="cx-entry-card-orbit" aria-hidden="true">✧</div>
        <span className="cx-entry-card-kicker">YOUR CLIMORA EXPERIENCE</span>
        <h2>How would you<br/><span>like to explore?</span></h2>
        <p>Choose a mode to enter your navigation dashboard.</p>
        <button type="button" className="cx-entry-signin" onClick={onSignIn}><span className="cx-entry-button-icon" aria-hidden="true">◎</span><span><strong>Sign in or create account</strong><small>Personalize your journey · My Trips</small></span><span aria-hidden="true">↗</span></button>
        <div className="cx-entry-divider"><span/> OR <span/></div>
        <button type="button" className="cx-entry-guest" onClick={onGuest}><span className="cx-entry-button-icon" aria-hidden="true">⌖</span><span><strong>Continue as Guest</strong><small>Explore maps, routes, AQI & forecasts</small></span><span aria-hidden="true">→</span></button>
        <div className="cx-entry-note">🔒 Your journey starts only after you select an access mode. Guest mode does not require an account.</div>
      </section>
    </div>
    <footer className="cx-entry-footer"><span>✦ CLIMORA AI</span><span>Powered by Google Maps · AWS · Open-Meteo</span><span>Built for conscious travel</span></footer>
  </main>;
}
