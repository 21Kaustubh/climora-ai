import { useEffect, useState } from 'react';

const SPARKS = Array.from({length: 18}, (_, i) => ({
  x: `${(i * 37 + 11) % 100}%`,
  y: `${(i * 23 + 13) % 100}%`,
  delay: `${-(i * 0.63)}s`,
  duration: `${4 + (i % 5)}s`,
}));

function NavigationArtwork() {
  return <div className="cx-art" aria-label="Decorative illustrated route exploration visual">
    <div className="cx-art-glow" />
    <div className="cx-art-grid" />
    <div className="cx-orbit cx-orbit-one" />
    <div className="cx-orbit cx-orbit-two" />
    <div className="cx-orbit cx-orbit-three" />
    <svg className="cx-world" viewBox="0 0 560 510" role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="cxSphere" cx="35%" cy="23%" r="79%">
          <stop offset="0" stopColor="#2a857f" stopOpacity=".54"/>
          <stop offset=".53" stopColor="#0c484b" stopOpacity=".73"/>
          <stop offset="1" stopColor="#08202d" stopOpacity=".95"/>
        </radialGradient>
        <linearGradient id="cxRoute" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b3ffe2"/><stop offset=".52" stopColor="#50e9b3"/><stop offset="1" stopColor="#65b9ff"/>
        </linearGradient>
        <filter id="cxHalo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
        <clipPath id="cxCircle"><circle cx="275" cy="253" r="170"/></clipPath>
      </defs>
      <circle cx="275" cy="253" r="185" fill="none" stroke="#5edfc5" strokeOpacity=".12" strokeWidth="1" strokeDasharray="4 12"/>
      <circle cx="275" cy="253" r="170" fill="url(#cxSphere)" stroke="#69ddbb" strokeOpacity=".42" strokeWidth="1.2"/>
      <g clipPath="url(#cxCircle)" opacity=".55" stroke="#90ead3" fill="none">
        <ellipse cx="275" cy="253" rx="72" ry="173" strokeWidth=".9" strokeOpacity=".38"/>
        <ellipse cx="275" cy="253" rx="125" ry="173" strokeWidth=".9" strokeOpacity=".23"/>
        <path d="M102 214 Q275 168 448 214 M100 293 Q275 340 450 293 M100 254H450" strokeWidth="1" strokeOpacity=".32"/>
        <path d="M130 145 Q195 140 215 169T279 163T365 177T413 170" strokeWidth="7" strokeOpacity=".09"/>
        <path d="M149 331 Q201 312 246 343T355 338T413 353" strokeWidth="10" strokeOpacity=".07"/>
        <g stroke="#66d8ba" strokeWidth="1" strokeOpacity=".17">
          <path d="M150 98L199 140L223 111L276 133L315 104L354 142L392 128"/>
          <path d="M120 329L166 297L208 318L256 287L312 316L385 287L443 319"/>
          <path d="M180 190L217 213L251 190L294 215L344 192L379 230"/>
        </g>
      </g>
      <path className="cx-route-halo" d="M157 324 C175 269 182 275 227 270 S269 219 305 220 S350 189 383 159" fill="none" stroke="#47ebb8" strokeOpacity=".43" strokeWidth="12" filter="url(#cxHalo)"/>
      <path className="cx-route-line" d="M157 324 C175 269 182 275 227 270 S269 219 305 220 S350 189 383 159" fill="none" stroke="url(#cxRoute)" strokeWidth="4.5" strokeLinecap="round"/>
      <circle cx="157" cy="324" r="9" fill="#08262b" stroke="#baf6da" strokeWidth="3"/>
      <circle cx="157" cy="324" r="17" fill="none" stroke="#baf6da" strokeOpacity=".34" strokeWidth="1.6"/>
      <g transform="translate(383 157)">
        <path d="M0 -27C-14 -27 -23 -16 -23 -4C-23 13 0 34 0 34S23 13 23 -4C23 -16 14 -27 0 -27Z" fill="#65f1b8" stroke="#c8ffdf" strokeWidth="1"/>
        <circle cy="-6" r="8" fill="#12463c"/>
      </g>
      <circle className="cx-travel-dot" r="6" fill="#fff" stroke="#67f4c3" strokeWidth="4">
        <animateMotion dur="8s" repeatCount="indefinite" rotate="auto" path="M157 324 C175 269 182 275 227 270 S269 219 305 220 S350 189 383 159"/>
      </circle>
    </svg>
    <div className="cx-art-tag cx-art-tag-a"><span className="cx-tiny-icon">⌁</span><div><small>ROUTE INSIGHTS</small><strong>Better informed journeys</strong></div></div>
    <div className="cx-art-tag cx-art-tag-b"><span className="cx-tiny-signal">✦</span><div><small>SMART NAVIGATION</small><strong>Explore · Compare · Go</strong></div></div>
    <div className="cx-art-coordinate">19°07′ N &nbsp; / &nbsp; 72°52′ E <i/> ILLUSTRATIVE VIEW</div>
    {SPARKS.map((p,i)=><span key={i} className="cx-spark" style={{left:p.x,top:p.y,animationDelay:p.delay,animationDuration:p.duration}} />)}
  </div>;
}

export function SiteHeader({ connected, profile, onOpenAuth, onOpenDashboard }) {
  const [open,setOpen] = useState(false);
  const links = [
    ['#planner','Route planner'],['#comparison','Compare'],['#navigation','Navigation'],['#departure','Depart smarter'],['#environment','Air intelligence'],['#upcoming','Roadmap']
  ];
  useEffect(()=>{
    if(!open)return;
    const close=e=>{if(e.key==='Escape')setOpen(false);};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[open]);
  return <header className="cx-header">
    <div className="cx-header-inner">
      <a className="cx-logo" href="#home" aria-label="Climora home" onClick={()=>setOpen(false)}>
        <span className="cx-logo-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 37 20 20 37 3 20Z" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M20 8c-5 7-8 13-8 19 5 1 12-3 16-14-3 3-6 5-12 7" fill="currentColor"/><circle cx="29" cy="11" r="2.6" fill="#a8fdc9"/></svg></span>
        <span className="cx-logo-type">CLIMORA <b>AI</b><small>INTELLIGENT EARTH MOBILITY</small></span>
      </a>
      <button type="button" className="cx-mobile-menu" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'✕':'☰'}</button>
      <nav className={`cx-nav ${open?'cx-nav-open':''}`} aria-label="Main navigation">
        {links.map(([href,label])=><a key={href} href={href} onClick={()=>setOpen(false)}>{label}</a>)}
        <button type="button" className="cx-nav-mobile-action" onClick={()=>{setOpen(false);onOpenDashboard();}}>◈ My trips / Dashboard</button>
        {!profile&&<button type="button" className="cx-nav-mobile-action" onClick={()=>{setOpen(false);onOpenAuth();}}>✧ Sign in / Sign up</button>}
      </nav>
      <div className="cx-header-actions">
        <span className="cx-api-status" title={connected?'AWS request completed':'AWS connectivity is checked when you calculate a route'}><i/>{connected?'ROUTING CONNECTED':'SYSTEM READY'}</span>
        <button type="button" className="cx-account-link" onClick={onOpenDashboard} aria-label="Open your trips dashboard">{profile?`◎ ${profile.displayName}`:'◈ My trips'}</button>
        {!profile&&<button type="button" className="cx-account-signin" onClick={onOpenAuth}>Sign in ↗</button>}
        <a className="cx-nav-cta" href="#planner">Plan a journey <span>↗</span></a>
      </div>
    </div>
  </header>;
}

export function ExperienceHero() {
  return <section id="home" className="cx-hero" aria-label="Climora introduction">
    <div className="cx-hero-noise" aria-hidden="true"/><div className="cx-hero-rays" aria-hidden="true"/>
    <div className="cx-hero-inner">
      <div className="cx-hero-copy">
        <div className="cx-live-kicker"><span className="cx-kicker-dot"/> THE FUTURE OF CONSCIOUS TRAVEL <span className="cx-kicker-spark">✧</span></div>
        <h1>Every journey.<br/><span>More intelligent.</span><br/><em>More conscious.</em></h1>
        <p className="cx-hero-description">Discover real road routes and explore the environmental conditions along your way. Navigation meets climate intelligence, beautifully.</p>
        <div className="cx-hero-actions"><a href="#planner" className="cx-button-primary">Start exploring <span>↗</span></a><a href="#environment" className="cx-button-outline"><span className="cx-play-icon">↗</span> Explore climate insights</a></div>
        <div className="cx-hero-trust"><div className="cx-trust-symbols"><span>⌖</span><span>◈</span><span>✧</span></div><p>Powered by real road networks<br/><strong>Built for a more aware way to move.</strong></p></div>
      </div>
      <NavigationArtwork/>
    </div>
    <div className="cx-hero-foot"><span><i/> EXPLORE THE WORLD RESPONSIBLY</span><span>SCROLL TO DISCOVER <b>↓</b></span></div>
  </section>;
}

export function CapabilitiesStrip() {
  const items=[
    {icon:'⌖',title:'Road-aware routing',description:'Real roads · four travel modes'},
    {icon:'◉',title:'Environmental context',description:'Modeled air quality & weather'},
    {icon:'↗',title:'GPS journey assistant',description:'On-device live progress'},
    {icon:'✳',title:'Thoughtful comparisons',description:'Explainable route insights'},
  ];
  return <div className="cx-capability-band"><div className="cx-capability-inner">
    {items.map((item,i)=><div className="cx-capability" key={item.title}>
      <span className="cx-capability-icon" aria-hidden="true">{item.icon}</span>
      <div><strong>{item.title}</strong><small>{item.description}</small></div>
      {i<items.length-1&&<span className="cx-capability-divider"/>}
    </div>)}
  </div></div>;
}
