import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLogo from './AppLogo'
import './Login.css'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/home'

  const handleSubmit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    
    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()
    
    if (!trimmedUsername || !trimmedPassword) {
      setError('Please enter both username and password')
      return
    }
    
    const success = login(trimmedUsername, trimmedPassword)
    if (success) {
      navigate(redirectTo, { replace: true })
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="login-container">
      <div className="login-background">
        <img src="/asset/login.gif" alt="Background" className="login-bg-image" onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%23dcf0fb"/%3E%3Cstop offset="1" stop-color="%23e9f1f7"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g)" width="1920" height="1080"/%3E%3C/svg%3E'; }} />
        <div className="login-overlay"></div>
      </div>
      
      <div className="login-content">
        <div className="login-form-wrapper">
          <div className="login-header">
            <AppLogo size="lg" />
            <p className="login-subtitle">Environmental Monitoring System</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="login-button">
              Login
            </button>

            <div className="register-section">
              <button type="button" className="register-button" disabled>
                Register New User
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login

