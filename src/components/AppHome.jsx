import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { MONITORING_THEMES } from '../data/monitoringThemes'
import AppLogo from './AppLogo'
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
          <AppLogo size="md" className="app-logo--on-dark" />
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
      </main>
    </div>
  )
}

export default AppHome
