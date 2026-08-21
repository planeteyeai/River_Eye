import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MONITORING_THEMES } from '../data/monitoringThemes'
import './Home.css'

/* ---------------------------------------------------------------- icons */

const Icon = {
  spark: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3Z" fill="currentColor" />
      <path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="currentColor" fillOpacity="0.6" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 12.3 2.7 2.7L16 9.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  rain: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 14A4.2 4.2 0 0 1 8 5.7 5.4 5.4 0 0 1 18 7.2a3.6 3.6 0 0 1 .3 6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 17v2.6M12 16.4V20M15.5 17v2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17l4.2-4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.7" fill="currentColor" />
    </svg>
  ),
  waves: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 7c3-2.4 5 2.4 8 0s5-2.4 8 0 3 1.2 4 .4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeOpacity="0.5" />
      <path d="M2 13c3-2.4 5 2.4 8 0s5-2.4 8 0 3 1.2 4 .4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 19c3-2.4 5 2.4 8 0s5-2.4 8 0 3 1.2 4 .4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeOpacity="0.75" />
    </svg>
  ),
}

/* --------------------------------------------------------------- content */

const NAV = [
  { label: 'Features', to: '/#features' },
  { label: 'Dashboard', to: '/dashboard' },
]

const HERO_POINTS = [
  'Reach digital twin for discharge and water level',
  'Air quality and weather on the selected area',
  'Every figure labelled by source',
]

const STATS = [
  { value: '17.0', unit: 'km', label: 'River reach modelled' },
  { value: '8', unit: '', label: 'Assets watched on the reach' },
  { value: '1698', unit: '', label: 'Model cells along the reach' },
  { value: '72', unit: 'h', label: 'Forecast horizon' },
]

/* ----------------------------------------------------------------- utils */

const useReveal = () => {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || shown) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown(true)
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [shown])

  return [ref, shown]
}

// Hero items animate on load, revealed sections transition on scroll — set both
// so the same helper can stagger either one.
const stagger = (index) => {
  const delay = `${index * 70}ms`
  return { animationDelay: delay, transitionDelay: delay }
}

/* ------------------------------------------------------------------ parts */

const BrandMark = () => (
  <span className="lp-brand">
    <span className="lp-mark" aria-hidden="true">
      <span className="lp-mark-eye">
        <span className="lp-mark-pupil" />
      </span>
      <span className="lp-mark-ring" />
    </span>
    <span className="lp-brand-text">
      River<span className="lp-brand-accent">Eye</span>
    </span>
  </span>
)

const Navbar = ({ enterTo, isAuthenticated }) => {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location.pathname])

  const links = NAV.map((item) =>
    item.to.startsWith('/#') ? (
      <a className="lp-nav-link" href={item.to.slice(1)} key={item.label} onClick={() => setOpen(false)}>
        {item.label}
      </a>
    ) : (
      <Link className="lp-nav-link" to={item.to} key={item.label} onClick={() => setOpen(false)}>
        {item.label}
      </Link>
    )
  )

  return (
    <header className={`lp-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-header-inner">
        <Link to="/" aria-label="River Eye home">
          <BrandMark />
        </Link>

        <nav className="lp-nav" aria-label="Sections">
          {links}
        </nav>

        <div className="lp-header-actions">
          {!isAuthenticated && (
            <Link className="lp-nav-link is-quiet" to="/login">
              Dashboard login
            </Link>
          )}
          <Link className="lp-btn is-primary" to={enterTo}>
            {isAuthenticated ? 'Open dashboard' : 'Get started'}
            <span className="lp-btn-icon">{Icon.arrow}</span>
          </Link>
        </div>

        <button
          type="button"
          className="lp-burger"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? Icon.close : Icon.menu}
        </button>
      </div>

      {open && (
        <div className="lp-mobile-menu">
          {links}
          {!isAuthenticated && (
            <Link className="lp-nav-link" to="/login" onClick={() => setOpen(false)}>
              Dashboard login
            </Link>
          )}
          <Link className="lp-btn is-primary is-block" to={enterTo} onClick={() => setOpen(false)}>
            {isAuthenticated ? 'Open dashboard' : 'Get started'}
          </Link>
        </div>
      )}
    </header>
  )
}

const HeroOrb = () => (
  <div className="lp-orb">
    <div className="lp-orb-glow" aria-hidden="true" />

    <svg viewBox="0 0 400 400" className="lp-orb-svg" role="img" aria-label="The reach on a stylised globe, with satellite and model inputs">
      <defs>
        <radialGradient id="lp-globe" cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#1d4f77" />
          <stop offset="55%" stopColor="#123a5e" />
          <stop offset="100%" stopColor="#0b1d33" />
        </radialGradient>
        <linearGradient id="lp-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd9d2" />
          <stop offset="1" stopColor="#2f9bd6" />
        </linearGradient>
      </defs>

      {[150, 172, 194].map((r, i) => (
        <ellipse
          key={r}
          cx="200"
          cy="200"
          rx={r}
          ry={r * 0.42}
          fill="none"
          stroke="url(#lp-ring)"
          strokeOpacity={0.38 - i * 0.09}
          strokeWidth="1"
          transform={`rotate(${-20 + i * 22} 200 200)`}
        />
      ))}

      <circle cx="200" cy="200" r="120" fill="url(#lp-globe)" stroke="url(#lp-ring)" strokeOpacity="0.5" />

      <g stroke="#5fd9d2" strokeOpacity="0.24" fill="none">
        <circle cx="200" cy="200" r="120" />
        {[40, 80, 120, 160].map((rx) => (
          <ellipse key={rx} cx="200" cy="200" rx={rx * 0.75} ry="120" />
        ))}
        {[-80, -40, 0, 40, 80].map((dy) => (
          <path key={dy} d={`M 80 ${200 + dy} Q 200 ${200 + dy * 1.25} 320 ${200 + dy}`} />
        ))}
      </g>

      {/* corridor bands, widest first, in the same order the map draws them */}
      <g fill="none" strokeLinecap="round">
        <path d="M 104 236 C 148 196, 214 252, 300 172" stroke="#c2372a" strokeOpacity="0.3" strokeWidth="17" />
        <path d="M 104 236 C 148 196, 214 252, 300 172" stroke="#d2701a" strokeOpacity="0.38" strokeWidth="11" />
        <path d="M 104 236 C 148 196, 214 252, 300 172" stroke="#2f9bd6" strokeOpacity="0.5" strokeWidth="6" />
        <path className="lp-orb-trace" d="M 104 236 C 148 196, 214 252, 300 172" stroke="#eaf7ff" strokeWidth="2.4" />
      </g>

      <g stroke="#5fd9d2" strokeOpacity="0.45" fill="none" strokeWidth="1.2">
        {[0, 8, 16, 24].map((o) => (
          <path key={o} d={`M 132 ${292 - o} q 25 -${18 + o} 55 0 t 55 ${o ? 4 : 0}`} strokeOpacity={0.45 - o * 0.012} />
        ))}
      </g>

      <g className="lp-orb-sat">
        <g transform="translate(350 200)">
          <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#5fd9d2" />
          <rect x="-20" y="-3" width="10" height="6" fill="#2f9bd6" />
          <rect x="10" y="-3" width="10" height="6" fill="#2f9bd6" />
        </g>
      </g>
    </svg>

    {[
      { cls: 'is-one', icon: Icon.waves, title: 'Digital twin', sub: 'Discharge · WSE' },
      { cls: 'is-two', icon: Icon.rain, title: 'Air & weather', sub: 'AQI analysis' },
      { cls: 'is-three', icon: Icon.gauge, title: 'Water quality', sub: 'TSS · NDCI · NDWI · WST' },
    ].map((card) => (
      <div className={`lp-float ${card.cls}`} key={card.title}>
        <span className="lp-float-icon">{card.icon}</span>
        <span className="lp-float-copy">
          <strong>{card.title}</strong>
          <small>{card.sub}</small>
        </span>
      </div>
    ))}
  </div>
)

const Hero = ({ enterTo, enterLabel }) => (
  <section className="lp-hero">
    <div className="lp-hero-aurora" aria-hidden="true" />
    <div className="lp-hero-grid" aria-hidden="true" />
    <div className="lp-hero-fade" aria-hidden="true" />

    <div className="lp-hero-inner">
      <div className="lp-hero-copy">
        <span className="lp-chip lp-anim" style={stagger(0)}>
          <span className="lp-chip-icon">{Icon.spark}</span>
          Satellite · Digital Twin · Environmental monitoring
        </span>

        <h1 className="lp-anim" style={stagger(1)}>
          Environmental Intelligence for the{' '}
          <span className="lp-gradient-text">Mula–Mutha River</span>
        </h1>

        <p className="lp-anim" style={stagger(2)}>
          Track modelled discharge and water level, air quality and river health on one map of
          Pune&rsquo;s river — with every number labelled by where it came from and how far it can be
          trusted.
        </p>

        <div className="lp-hero-cta lp-anim" style={stagger(3)}>
          <Link className="lp-btn is-primary is-large" to={enterTo}>
            {enterLabel}
            <span className="lp-btn-icon">{Icon.arrow}</span>
          </Link>
        </div>

        <div className="lp-hero-points lp-anim" style={stagger(4)}>
          {HERO_POINTS.map((point) => (
            <span key={point}>
              <span className="lp-point-icon">{Icon.check}</span>
              {point}
            </span>
          ))}
        </div>
      </div>

      <div className="lp-hero-visual lp-anim" style={stagger(2)}>
        <HeroOrb />
      </div>
    </div>
  </section>
)

const Stats = () => {
  const [ref, shown] = useReveal()

  return (
    <section className="lp-stats" ref={ref} aria-label="Key figures">
      <div className="lp-stats-inner">
        {STATS.map((stat, index) => (
          <div className={`lp-stat lp-reveal ${shown ? 'is-in' : ''}`} style={stagger(index)} key={stat.label}>
            <div className="lp-stat-value lp-gradient-text">
              {stat.value}
              {stat.unit && <em>{stat.unit}</em>}
            </div>
            <div className="lp-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const SectionHead = ({ tag, title, sub, align = 'center' }) => (
  <div className={`lp-section-head ${align === 'left' ? 'is-left' : ''}`}>
    {tag && <span className="lp-chip is-light">{tag}</span>}
    <h2 className="lp-section-title">{title}</h2>
    <p>{sub}</p>
  </div>
)

const Themes = () => {
  const [ref, shown] = useReveal()

  return (
    <section className="lp-section" id="features" ref={ref}>
      <SectionHead
        align="left"
        title={
          <>
            One platform, <span className="lp-gradient-text">nine monitoring themes</span>
          </>
        }
        sub="Every parameter below is estimated from satellite data alone — no field sampling required"
      />

      <div className="lp-themes">
        {MONITORING_THEMES.map((theme, index) => (
          <article
            className={`lp-theme lp-reveal ${shown ? 'is-in' : ''}`}
            style={stagger(index % 3)}
            key={theme.name}
          >
            <div className="lp-theme-head">
              <span className="lp-theme-num" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{theme.name}</h3>
            </div>
            <p>{theme.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const Footer = () => (
  <footer className="lp-footer">
    <div className="lp-footer-inner">
      <div>
        <BrandMark />
        <p>
          Environmental monitoring for the Mula–Mutha in Pune, assembled from a reach digital twin
          and the ClimateEye air and weather backend.
        </p>
      </div>

      <div className="lp-footer-col">
        <h4>Platform</h4>
        <ul>
          <li>
            <Link to="/dashboard">Live map</Link>
          </li>
          <li>
            <Link to="/dashboard?view=flood">Digital twin</Link>
          </li>
          <li>
            <Link to="/dashboard?view=aqi">Air quality</Link>
          </li>
          <li>
            <a href="#features">Features</a>
          </li>
        </ul>
      </div>
    </div>

    <div className="lp-footer-bottom">
      © {new Date().getFullYear()} River Eye. Reach digital twin for discharge and water level ·
      basemaps from Esri, CARTO and OpenStreetMap · terrain from AWS
      Terrain Tiles. Water level, freeboard and BOD–COD figures are demonstration data.
    </div>
  </footer>
)

/* ------------------------------------------------------------------- page */

const Home = () => {
  const { isAuthenticated } = useAuth()
  const enterTo = isAuthenticated ? '/home' : '/login'
  const enterLabel = isAuthenticated ? 'Open dashboard' : 'Get started'

  return (
    <div className="lp">
      <Navbar enterTo={enterTo} isAuthenticated={isAuthenticated} />
      <main>
        <Hero enterTo={enterTo} enterLabel={enterLabel} />
        <Stats />
        <Themes />
      </main>
      <Footer />
    </div>
  )
}

export default Home
