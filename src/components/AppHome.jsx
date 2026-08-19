import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { MONITORING_THEMES } from '../data/monitoringThemes'
import './AppHome.css'

const greetingFor = (hour) => {
  if (hour < 5) return 'Late night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const AppHome = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const now = new Date()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="hub">
      <header className="hub-bar">
        <div className="hub-brand">
          <span className="hub-mark" aria-hidden="true">
            <span className="hub-mark-eye">
              <span className="hub-mark-pupil" />
            </span>
            <span className="hub-mark-ring" />
          </span>
          <span className="hub-brand-text">
            River Eye
            <small>Environmental monitoring</small>
          </span>
        </div>

        <button type="button" className="hub-signout" onClick={handleLogout}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign out</span>
        </button>
      </header>

      <main className="hub-main">
        <div className="hub-greeting">
          <span className="hub-date">{format(now, 'EEEE d MMMM yyyy')}</span>
          <h1>{greetingFor(now.getHours())}</h1>
          <p>
            One platform, nine monitoring themes. Every parameter below is estimated from satellite
            data alone — no field sampling required.
          </p>
        </div>

        <div className="hub-themes">
          {MONITORING_THEMES.map((theme, index) => (
            <Link className="hub-theme" to={theme.to} key={theme.name}>
              <div className="hub-theme-head">
                <span className="hub-theme-num" aria-hidden="true">
                  {index + 1}
                </span>
                <h2>{theme.name}</h2>
              </div>
              <p>{theme.desc}</p>
            </Link>
          ))}
        </div>

        <div className="hub-notes">
          <section className="hub-note">
            <h3>What opens today</h3>
            <p>
              Hydrology opens the digital twin (modelled discharge, WSE, freeboard and alerts).
              Water quality and salinity intrusion open TSS, NDCI, NDWI, WST and the BOD–COD panel.
              Biodiversity opens classified vegetation overlays. Soil & land use opens monthly silt rasters plus urban vegetation. Climate impact
              opens the flood and surface-water heatmap. Geology opens joining streams on the map,
              with the satellite-derived bathymetry dashboard from that panel. Pollution and socio-economic land on the live map — their
              satellite layers are intended scope, not shipped screens yet.
            </p>
          </section>

          <section className="hub-note">
            <h3>Before you quote a number</h3>
            <p>
              Water level, freeboard, alerts and discharge come from a demonstration twin, and the
              BOD–COD series is demonstration data; Turbidity/TSS, NDCI, NDWI and WST (salinity
              thermal proxy) are classified overlays for July 2026 under water quality. The climate
              impact heatmap is classed sample-point density from seven 2026 image pairs, not a
              surveyed flood line. Geology bathymetry is satellite-derived (Sentinel-2, 14 Jul 2026),
              not an in-situ sounding survey.
              {' '}<Link to="/">The project page</Link> sets out
              every source and its footing.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default AppHome
