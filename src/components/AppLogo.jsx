import React from 'react'
import './AppLogo.css'

const LOGO_SRC = '/asset/planeteye-farm-ai-logo.png'

const AppLogo = ({ className = '', size = 'md', alt = 'PlanetEye Farm-AI' }) => (
  <img
    src={LOGO_SRC}
    alt={alt}
    className={`app-logo app-logo--${size}${className ? ` ${className}` : ''}`}
    decoding="async"
  />
)

export default AppLogo
