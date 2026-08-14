import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './components/Home'
import AppHome from './components/AppHome'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AQIDetailPage from './components/AQIDetailPage'
import WeatherDetailPage from './components/WeatherDetailPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import './App.css'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (isAuthenticated) return children

  // Carry the intended path so a deep link from the homepage survives the login.
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <AppHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aqi-detail"
            element={
              <ProtectedRoute>
                <AQIDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/weather-detail"
            element={
              <ProtectedRoute>
                <WeatherDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
