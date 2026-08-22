import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { transformRecordsByHeight } from '../utils/dataTransformers'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { format, subDays, startOfDay, isAfter, addDays, isBefore, isEqual, isToday, subHours, parseISO } from 'date-fns'
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Cell, Dot } from 'recharts'
import MapComponent from './MapComponent'
import ChainageScrubber from './ChainageScrubber'
import MapLayersControl from './MapLayersControl'
import MapViewsControl from './MapViewsControl'
import { LayerPanelSlotProvider } from './LayerPanelSlots'
import { legendForLayer } from '../lib/layerLegends'
import BodCodMapOverlay from './BodCodMapOverlay'
import AqiMapOverlay from './AqiMapOverlay'
import FloodMapOverlay from './FloodMapOverlay'
import SoilLandUseMapOverlay from './SoilLandUseMapOverlay'
import BiodiversityMapOverlay from './BiodiversityMapOverlay'
import ClimateImpactMapOverlay from './ClimateImpactMapOverlay'
import GeologyMapOverlay from './GeologyMapOverlay'
import WeatherSection from './WeatherSection'
import AQISection from './AQISection'
import LiveDashboardCards from './LiveDashboardCards'
import { calculateGeometryCenter, fetchAQIData, fetchWeatherData, fetchHourlyAQIDataRange, fetchHourlyWeatherData, fetchHourlyAQIData } from '../services/api'
import './Dashboard.css'
import './DatePicker.css'
// HeightSelectionScreen.css was deleted - remove import if HeightSelectionScreen is not used

const Dashboard = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const appliedViewRef = useRef(null)
  const today = startOfDay(new Date())
  const oneWeekAgo = startOfDay(subDays(today, 7))

  const [startDate, setStartDate] = useState(format(oneWeekAgo, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'))
  const [mapLayer, setMapLayer] = useState('google-satellite')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnGeometry, setDrawnGeometry] = useState(null)
  const [uploadedKML, setUploadedKML] = useState(null)
  const [kmlDownloadName, setKmlDownloadName] = useState('')
  const [showAnalysis, setShowAnalysis] = useState(false) 
  const [showBodCod, setShowBodCod] = useState(false) 
  const [showBodCodOverlay, setShowBodCodOverlay] = useState(false) 
  const [showTssLayer, setShowTssLayer] = useState(false)
  const [showNdciLayer, setShowNdciLayer] = useState(false)
  const [showNdwiLayer, setShowNdwiLayer] = useState(false)
  const [showWstLayer, setShowWstLayer] = useState(false)
  const [showNdsiSalinityLayer, setShowNdsiSalinityLayer] = useState(false)
  const [showAqiOverlay, setShowAqiOverlay] = useState(false) 
  const [showFlood, setShowFlood] = useState(false)
  const [showFloodOverlay, setShowFloodOverlay] = useState(false)
  const [floodZones, setFloodZones] = useState(null)
  const [showChainageLayer, setShowChainageLayer] = useState(false)
  const [focusChainage, setFocusChainage] = useState(null)
  const [showFloodDepthLayer, setShowFloodDepthLayer] = useState(false)
  const [showBathyMapLayer, setShowBathyMapLayer] = useState(false)
  const [showWrdFloodlines, setShowWrdFloodlines] = useState(false)
  const [showGarbageLayer, setShowGarbageLayer] = useState(false)
  const [showLandUseOverlay, setShowLandUseOverlay] = useState(false)
  const [showUrbanVegLayer, setShowUrbanVegLayer] = useState(false)
  const [showSiltClassLayer, setShowSiltClassLayer] = useState(false)
  const [showSiltVolumeLayer, setShowSiltVolumeLayer] = useState(false)
  const [siltPeriodId, setSiltPeriodId] = useState(5)
  const [showLulcLayer, setShowLulcLayer] = useState(false)
  const [lulcPeriodId, setLulcPeriodId] = useState(4)
  const [showBiodiversityOverlay, setShowBiodiversityOverlay] = useState(false)
  const [showBiodiversityTypeLayer, setShowBiodiversityTypeLayer] = useState(false)
  const [showBiodiversityHealthLayer, setShowBiodiversityHealthLayer] = useState(false)
  const [showClimateOverlay, setShowClimateOverlay] = useState(false)
  const [climatePeriodId, setClimatePeriodId] = useState(4)
  const [showClimateFloodHeat, setShowClimateFloodHeat] = useState(false)
  const [showClimateWaterHeat, setShowClimateWaterHeat] = useState(false)
  const [showBathy, setShowBathy] = useState(false)
  const [showGeologyOverlay, setShowGeologyOverlay] = useState(false)
  const [showTributaryLayer, setShowTributaryLayer] = useState(false)
  const [showMainStemLayer, setShowMainStemLayer] = useState(false)
  const [showErosionLayer, setShowErosionLayer] = useState(false)
  const [showLithologyLayer, setShowLithologyLayer] = useState(false)
  const [currentViewDate, setCurrentViewDate] = useState(null) // Currently viewing date
  const [weatherData, setWeatherData] = useState(null)
  const [aqiData, setAqiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('live') // 'live', 'daily', 'weekly', 'monthly'
  const [aqiChartData, setAqiChartData] = useState([]) // For AQI chart
  const [loadingChart, setLoadingChart] = useState(false)
  const [timeChartData, setTimeChartData] = useState([]) // For Time chart
  const [loadingTimeChart, setLoadingTimeChart] = useState(false)
  const [liveHourlyChartData, setLiveHourlyChartData] = useState([]) // Per-hour AQI for Live time series bar
  const [selectedHeight, setSelectedHeight] = useState(null) // '0-3meter' or '3meter-above' or null
  const [isFullscreen, setIsFullscreen] = useState(false)
  const cssFullscreenRef = useRef(false)
  
  // Refs to prevent multiple simultaneous API calls
  const isFetchingRef = useRef(false)
  const lastFetchKeyRef = useRef(null)

  const getFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null

  const exitAppFullscreen = async () => {
    cssFullscreenRef.current = false
    document.documentElement.classList.remove('app-fullscreen')
    const active = getFullscreenElement()
    if (active) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen
      if (exit) {
        try {
          await exit.call(document)
        } catch {
          // ignore abort from overlapping fullscreen requests
        }
      }
    }
    setIsFullscreen(false)
  }

  const toggleAppFullscreen = async () => {
    if (isFullscreen || getFullscreenElement() || cssFullscreenRef.current) {
      await exitAppFullscreen()
      return
    }

    const root = document.documentElement
    try {
      const request =
        root.requestFullscreen ||
        root.webkitRequestFullscreen ||
        root.msRequestFullscreen
      if (!request) throw new Error('Fullscreen API unavailable')
      await request.call(root)
    } catch {
      cssFullscreenRef.current = true
      root.classList.add('app-fullscreen')
      setIsFullscreen(true)
    }
  }

  useEffect(() => {
    // Update dates daily - recalculate one week ago from today
    const updateDates = () => {
      const currentToday = startOfDay(new Date())
      const currentOneWeekAgo = startOfDay(subDays(currentToday, 7))
      setStartDate(format(currentOneWeekAgo, 'yyyy-MM-dd'))
      setEndDate(format(currentToday, 'yyyy-MM-dd'))
    }

    // Update on mount and set interval to check daily
    updateDates()
    const interval = setInterval(updateDates, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (location.state?.restoreAnalysis) return undefined

    let cancelled = false
    const loadMulaMutha = async () => {
      try {
        const response = await fetch('/asset/mula-mutha-river.kml')
        if (!response.ok) throw new Error('Failed to load Mula-Mutha River')
        const content = await response.text()
        if (cancelled) return
        setUploadedKML({
          name: 'Mula-Mutha River.kml',
          displayName: 'Mula-Mutha River',
          content,
        })
        setDrawnGeometry(null)
        setIsDrawing(false)
        setKmlDownloadName('mula-mutha-river')
      } catch (error) {
        console.error(error)
      }
    }

    loadMulaMutha()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement
      if (active) {
        cssFullscreenRef.current = false
        document.documentElement.classList.remove('app-fullscreen')
        setIsFullscreen(true)
        return
      }
      setIsFullscreen(cssFullscreenRef.current)
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (!cssFullscreenRef.current) return
      cssFullscreenRef.current = false
      document.documentElement.classList.remove('app-fullscreen')
      setIsFullscreen(false)
    }

    document.addEventListener('fullscreenchange', syncFullscreen)
    document.addEventListener('webkitfullscreenchange', syncFullscreen)
    document.addEventListener('MSFullscreenChange', syncFullscreen)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncFullscreen)
      document.removeEventListener('MSFullscreenChange', syncFullscreen)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Restore analysis view when navigating back from detail page
  useEffect(() => {
    if (location.state?.restoreAnalysis) {
      // Restore the analysis state
      if (location.state.geometry) {
        // If geometry is provided, restore it
        if (location.state.geometry.type === 'Polygon') {
          setDrawnGeometry(location.state.geometry)
        }
      }
      if (location.state.startDate) {
        setStartDate(location.state.startDate)
      }
      if (location.state.endDate) {
        setEndDate(location.state.endDate)
      }
      if (location.state.currentDate) {
        setCurrentViewDate(location.state.currentDate)
      }
      // Restore selected height
      if (location.state.selectedHeight !== undefined) {
        setSelectedHeight(location.state.selectedHeight)
      }
      // Show analysis view
      setShowAnalysis(true)
      
      // Fetch data if we have geometry and date
      if (location.state.geometry && location.state.currentDate) {
        const center = calculateGeometryCenter(location.state.geometry)
        if (center) {
          fetchDataForDate(center.latitude, center.longitude, location.state.currentDate)
        }
      }
      
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate])

  const handleStartDateChange = (e) => {
    const selectedDate = new Date(e.target.value)
    const selectedStartOfDay = startOfDay(selectedDate)
    const currentEndDate = new Date(endDate)
    
    // Can't select a date after end date
    if (isAfter(selectedStartOfDay, currentEndDate)) {
      return
    }
    
    setStartDate(format(selectedStartOfDay, 'yyyy-MM-dd'))
  }

  const handleEndDateChange = (e) => {
    const selectedDate = new Date(e.target.value)
    const selectedStartOfDay = startOfDay(selectedDate)
    const currentToday = startOfDay(new Date())
    const currentStartDate = new Date(startDate)
    
    // Can't select a date beyond today
    if (isAfter(selectedStartOfDay, currentToday)) {
      return
    }
    
    // Can't select a date before start date
    if (isAfter(currentStartDate, selectedStartOfDay)) {
      return
    }
    
    setEndDate(format(selectedStartOfDay, 'yyyy-MM-dd'))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDrawArea = () => {
    setIsDrawing(true)
    setUploadedKML(null) // Clear KML when drawing
  }

  const handleGeometryComplete = (geometry) => {
    setDrawnGeometry(geometry)
    setIsDrawing(false)
    setKmlDownloadName('')
  }

  const handleCancelDrawing = () => {
    setIsDrawing(false)
  }

  const handleKMLUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.kml') && !file.name.toLowerCase().endsWith('.kmz')) {
      alert('Please upload a KML or KMZ file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedKML({
        name: file.name,
        displayName: file.name,
        content: event.target.result
      })
      setDrawnGeometry(null) // Clear drawn geometry when KML is uploaded
      setIsDrawing(false)
    }
    reader.readAsText(file)
    e.target.value = '' // Reset file input
  }

  const handleClearGeometry = () => {
    setDrawnGeometry(null)
    setUploadedKML(null)
    setIsDrawing(false)
    setKmlDownloadName('')
  }

  const geometryToKML = (geometry, name = 'Drawn Area') => {
    if (!geometry?.coordinates?.[0]?.length) return null

    const coords = geometry.coordinates[0]
      .map(([lng, lat]) => `${lng},${lat},0`)
      .join(' ')

    const safeName = String(name)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${safeName}</name>
    <Placemark>
      <name>${safeName}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`
  }

  const handleDownloadKML = () => {
    const trimmedName = kmlDownloadName.trim()
    if (!trimmedName) {
      alert('Please enter a KML file name')
      return
    }

    let geometry = drawnGeometry
    let kmlContent = null

    if (geometry) {
      kmlContent = geometryToKML(geometry, trimmedName)
    } else if (uploadedKML?.content) {
      kmlContent = uploadedKML.content
    }

    if (!kmlContent) {
      alert('No area available to download')
      return
    }

    const fileName = trimmedName.toLowerCase().endsWith('.kml')
      ? trimmedName
      : `${trimmedName}.kml`

    const blob = new Blob([kmlContent], {
      type: 'application/vnd.google-earth.kml+xml',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getMaxDate = () => {
    return format(today, 'yyyy-MM-dd')
  }

  // Date navigation functions
  const handlePreviousDate = async () => {
    if (!currentViewDate || loading) return
    
    const current = new Date(currentViewDate)
    const prev = subDays(current, 1)
    const start = new Date(startDate)
    
    // Don't go before start date
    if (isBefore(prev, start) && !isEqual(prev, start)) {
      return
    }
    
    const newDate = format(prev, 'yyyy-MM-dd')
    setCurrentViewDate(newDate)
    
    // Fetch data for the new date when button is clicked
    if (showAnalysis && (drawnGeometry || uploadedKML) && viewMode === 'live') {
      let geometry = drawnGeometry
      if (!geometry && uploadedKML) {
        geometry = parseKMLToGeometry(uploadedKML.content)
      }
      if (geometry) {
        const center = calculateGeometryCenter(geometry)
        if (center) {
          setLoading(true)
          try {
            await fetchDataForDate(center.latitude, center.longitude, newDate)
          } catch (err) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        }
      }
    }
  }

  const handleNextDate = async () => {
    if (!currentViewDate || loading) return
    
    const current = startOfDay(new Date(currentViewDate))
    const next = startOfDay(addDays(current, 1))
    const end = startOfDay(new Date(endDate))
    const todayDate = startOfDay(new Date())
    
    // The maximum date we can navigate to is the earlier of endDate or today
    const maxDate = isBefore(end, todayDate) ? end : todayDate
    
    let newDate
    // Don't go beyond the maximum date (allow going to maxDate itself)
    if (isAfter(next, maxDate)) {
      // If we can't go to next, but we're not at maxDate, go to maxDate
      if (isBefore(current, maxDate)) {
        newDate = format(maxDate, 'yyyy-MM-dd')
      } else {
        return
      }
    } else {
      // Allow navigation if next date is equal to or before maxDate
      newDate = format(next, 'yyyy-MM-dd')
    }
    
    setCurrentViewDate(newDate)
    
    // Fetch data for the new date when button is clicked
    if (showAnalysis && (drawnGeometry || uploadedKML) && viewMode === 'live') {
      let geometry = drawnGeometry
      if (!geometry && uploadedKML) {
        geometry = parseKMLToGeometry(uploadedKML.content)
      }
      if (geometry) {
        const center = calculateGeometryCenter(geometry)
        if (center) {
          setLoading(true)
          try {
            await fetchDataForDate(center.latitude, center.longitude, newDate)
          } catch (err) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        }
      }
    }
  }

  const canGoPrevious = () => {
    if (!currentViewDate) return false
    const current = startOfDay(new Date(currentViewDate))
    const start = startOfDay(new Date(startDate))
    return isAfter(current, start)
  }

  const canGoNext = () => {
    if (!currentViewDate) return false
    const current = startOfDay(new Date(currentViewDate))
    const end = startOfDay(new Date(endDate))
    const todayDate = startOfDay(new Date())
    const maxDate = isBefore(end, todayDate) ? end : todayDate
    // Can go next if current date is before or equal to maxDate (allow going to most recent date)
    return isBefore(current, maxDate) || isEqual(current, maxDate)
  }

  // Parse KML to geometry
  const parseKMLToGeometry = (kmlContent) => {
    try {
      const parser = new DOMParser()
      const kmlDoc = parser.parseFromString(kmlContent, 'text/xml')
      const errorNode = kmlDoc.querySelector('parsererror')
      
      if (errorNode) {
        console.error('KML parsing error:', errorNode.textContent)
        return null
      }

      const coordinatesElements = kmlDoc.querySelectorAll('coordinates')
      if (coordinatesElements.length > 0) {
        const coordsText = coordinatesElements[0].textContent.trim()
        const coordPairs = coordsText.split(/\s+/).filter(c => c.trim())
        
        const coordinates = coordPairs.map(coord => {
          const [lng, lat] = coord.split(',').map(Number)
          return [lng, lat] // GeoJSON format [lng, lat]
        })
        
        return {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    } catch (error) {
      console.error('Error parsing KML:', error)
    }
    return null
  }

  // Helper function to aggregate hourly data
  const aggregateHourlyData = (hourlyRecords, type) => {
    if (!hourlyRecords || hourlyRecords.length === 0) return null

    if (type === 'aqi') {
      const validRecords = hourlyRecords.filter(r => r.aqi !== null && r.aqi !== undefined)
      if (validRecords.length === 0) return null

      return {
        aqi: Math.round(validRecords.reduce((sum, r) => sum + r.aqi, 0) / validRecords.length),
        pm2_5: validRecords.reduce((sum, r) => sum + (r.pm2_5 || 0), 0) / validRecords.length,
        pm10: validRecords.reduce((sum, r) => sum + (r.pm10 || 0), 0) / validRecords.length,
        co: validRecords.reduce((sum, r) => sum + (r.co || 0), 0) / validRecords.length,
        so2: validRecords.reduce((sum, r) => sum + (r.so2 || 0), 0) / validRecords.length,
        no2: validRecords.reduce((sum, r) => sum + (r.no2 || 0), 0) / validRecords.length,
        o3: validRecords.reduce((sum, r) => sum + (r.o3 || 0), 0) / validRecords.length,
        date: hourlyRecords[hourlyRecords.length - 1]?.date || new Date().toISOString()
      }
    } else {
      const validRecords = hourlyRecords.filter(r => r.temperature !== null && r.temperature !== undefined)
      if (validRecords.length === 0) return null

      return {
        temperature: Math.round(validRecords.reduce((sum, r) => sum + r.temperature, 0) / validRecords.length),
        feels_like: validRecords.reduce((sum, r) => sum + (r.feels_like || r.temperature), 0) / validRecords.length,
        humidity: validRecords.reduce((sum, r) => sum + (r.humidity || 0), 0) / validRecords.length,
        wind_speed: validRecords.reduce((sum, r) => sum + (r.wind_speed || 0), 0) / validRecords.length,
        uv_index: validRecords.reduce((sum, r) => sum + (r.uv_index || 0), 0) / validRecords.length,
        condition: validRecords[validRecords.length - 1]?.condition || 'Unknown',
        icon: validRecords[validRecords.length - 1]?.icon || 'cloud',
        date: hourlyRecords[hourlyRecords.length - 1]?.date || new Date().toISOString()
      }
    }
  }

  // Fetch data based on view mode
  const fetchDataForMode = async (latitude, longitude) => {
    setLoading(true)
    setError(null)
    setWeatherData(null)
    setAqiData(null)

    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      if (viewMode === 'live') {
        // Live: Current data (no date parameter)
        const [weather, aqi] = await Promise.all([
          fetchWeatherData(latitude, longitude),
          fetchAQIData(latitude, longitude)
        ])
        setWeatherData(weather)
        setAqiData(aqi)
      } else if (viewMode === 'daily') {
        // Daily: Last 24 hours (today's hourly data)
        const [weatherHourly, aqiHourly] = await Promise.all([
          fetchHourlyWeatherData(latitude, longitude, today),
          fetchHourlyAQIData(latitude, longitude, today)
        ])
        
        const weatherAggregated = aggregateHourlyData(weatherHourly.hourly_records || [], 'weather')
        const aqiAggregated = aggregateHourlyData(aqiHourly.hourly_records || [], 'aqi')
        
        setWeatherData(weatherAggregated)
        setAqiData(aqiAggregated)
      } else if (viewMode === 'weekly') {
        // Weekly: Past 7 days
        const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
        
        // Fetch weather data for each day in the week
        const weatherPromises = []
        for (let i = 0; i < 7; i++) {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
          weatherPromises.push(fetchHourlyWeatherData(latitude, longitude, date))
        }
        
        const [weatherResults, aqiRange] = await Promise.all([
          Promise.all(weatherPromises),
          fetchHourlyAQIDataRange(latitude, longitude, weekAgo, today)
        ])
        
        const allWeatherRecords = weatherResults.flatMap(r => r.hourly_records || [])
        const weatherAggregated = aggregateHourlyData(allWeatherRecords, 'weather')
        const aqiAggregated = aggregateHourlyData(aqiRange.hourly_records || [], 'aqi')
        
        setWeatherData(weatherAggregated)
        setAqiData(aqiAggregated)
      } else if (viewMode === 'monthly') {
        // Monthly: Past 30 days
        const monthAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
        
        // Fetch weather data for each day in the month (limit to 30 days to avoid too many requests)
        const weatherPromises = []
        for (let i = 0; i < 30; i++) {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
          weatherPromises.push(fetchHourlyWeatherData(latitude, longitude, date))
        }
        
        const [weatherResults, aqiRange] = await Promise.all([
          Promise.all(weatherPromises),
          fetchHourlyAQIDataRange(latitude, longitude, monthAgo, today)
        ])
        
        const allWeatherRecords = weatherResults.flatMap(r => r.hourly_records || [])
        const weatherAggregated = aggregateHourlyData(allWeatherRecords, 'weather')
        const aqiAggregated = aggregateHourlyData(aqiRange.hourly_records || [], 'aqi')
        
        setWeatherData(weatherAggregated)
        setAqiData(aqiAggregated)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch data for a specific date (legacy function for date navigation)
  const fetchDataForDate = async (latitude, longitude, date) => {
    setLoading(true)
    setError(null)
    setWeatherData(null)
    setAqiData(null)

    try {
      const [weather, aqi] = await Promise.all([
        fetchWeatherData(latitude, longitude, date),
        fetchAQIData(latitude, longitude, date)
      ])

      setWeatherData(weather)
      setAqiData(aqi)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Unified live data fetcher: makes 3 API calls once and processes all chart data from shared results
  const fetchAllLiveData = async (latitude, longitude) => {
    setLoading(true)
    setLoadingChart(true)
    setLoadingTimeChart(true)
    setError(null)
    setWeatherData(null)
    setAqiData(null)
    setLiveHourlyChartData([])
    setAqiChartData([])
    setTimeChartData([])

    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const now = new Date()

      // Single Promise.all: weather summary + AQI summary + hourly AQI (shared by both charts)
      const [weather, aqi, aqiHourly] = await Promise.all([
        fetchWeatherData(latitude, longitude),
        fetchAQIData(latitude, longitude),
        fetchHourlyAQIData(latitude, longitude, today)
      ])

      setWeatherData(weather)
      setAqiData(aqi)

      // Process hourly records once for both charts
      const records = transformRecordsByHeight(aqiHourly.hourly_records || [], selectedHeight)
      const oneHourAgo = subHours(now, 1)
      const lastHourRecords = records
        .filter(r => {
          if (!r || r.aqi === null || r.aqi === undefined) return false
          const recordTime = parseISO(r.date)
          return recordTime >= oneHourAgo
        })
        .sort((a, b) => parseISO(a.date) - parseISO(b.date))

      const minuteBuckets = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]

      // AQI Trend chart data
      let aqiChartResult
      if (lastHourRecords.length > 0) {
        aqiChartResult = minuteBuckets.map(minute => {
          const targetTime = subHours(now, 1).getTime() + (60 - minute) * 60 * 1000
          const closestRecord = lastHourRecords.reduce((closest, record) => {
            const recordTime = parseISO(record.date).getTime()
            const closestTime = closest ? parseISO(closest.date).getTime() : null
            if (!closestTime) return record
            return Math.abs(recordTime - targetTime) < Math.abs(closestTime - targetTime) ? record : closest
          }, null)
          return {
            time: minute.toString(),
            aqi: closestRecord ? closestRecord.aqi : (lastHourRecords[0]?.aqi || 0),
            pm25: closestRecord?.pm2_5 ?? closestRecord?.pm25 ?? lastHourRecords[0]?.pm2_5 ?? lastHourRecords[0]?.pm25 ?? null,
            pm10: closestRecord?.pm10 ?? lastHourRecords[0]?.pm10 ?? null,
            fullTime: closestRecord ? closestRecord.date : now.toISOString(),
            minute
          }
        })
      } else {
        const fallback = records.slice(-12).filter(r => r && r.aqi !== null && r.aqi !== undefined)
        aqiChartResult = minuteBuckets.map((minute, idx) => {
          const rec = fallback[idx] || fallback[0]
          return {
            time: minute.toString(),
            aqi: rec?.aqi || 0,
            pm25: rec?.pm2_5 ?? rec?.pm25 ?? null,
            pm10: rec?.pm10 ?? null,
            fullTime: rec?.date || now.toISOString(),
            minute
          }
        })
      }
      setAqiChartData(aqiChartResult)

      // Time chart data (same shared records)
      const timeChartResult = minuteBuckets.map(minute => {
        const targetTime = subHours(now, 1).getTime() + (60 - minute) * 60 * 1000
        const closestRecord = lastHourRecords.reduce((closest, record) => {
          const recordTime = parseISO(record.date).getTime()
          const closestTime = closest ? parseISO(closest.date).getTime() : null
          if (!closestTime) return record
          return Math.abs(recordTime - targetTime) < Math.abs(closestTime - targetTime) ? record : closest
        }, null)
        const recordTime = closestRecord ? parseISO(closestRecord.date) : now
        const timeStr = format(recordTime, 'HH:mm')
        return {
          day: minute.toString(),
          time: timeStr,
          timeMinutes: timeToMinutes(timeStr),
          aqi: closestRecord ? closestRecord.aqi : 0,
          fullTime: closestRecord ? closestRecord.date : now.toISOString()
        }
      })
      setTimeChartData(timeChartResult)

    } catch (err) {
      setError(err.message)
      console.error('Error fetching live data:', err)
    } finally {
      setLoading(false)
      setLoadingChart(false)
      setLoadingTimeChart(false)
    }
  }

  // Handle view mode change
  const handleViewModeChange = async (mode) => {
    setViewMode(mode)
    // Clear all chart data immediately so previous mode's data is not shown
    setLiveHourlyChartData([])
    setAqiChartData([])
    setTimeChartData([])
    setLoadingChart(true)
    setLoadingTimeChart(true)

    if (showAnalysis && (drawnGeometry || uploadedKML)) {
      let geometry = drawnGeometry
      if (!geometry && uploadedKML) {
        geometry = parseKMLToGeometry(uploadedKML.content)
      }

      if (geometry) {
        const center = calculateGeometryCenter(geometry)
        if (center) {
          if (mode === 'live') {
            // Single unified fetch for live mode — avoids duplicate API calls
            await fetchAllLiveData(center.latitude, center.longitude)
          } else {
            setLoadingTimeChart(true)
            await Promise.all([
              fetchDataForMode(center.latitude, center.longitude),
              fetchAQIChartData(center.latitude, center.longitude),
              fetchTimeChartData(center.latitude, center.longitude)
            ])
          }
        }
      }
    } else {
      setLoadingChart(false)
      setLoadingTimeChart(false)
      setLiveHourlyChartData([])
      setAqiChartData([])
      setTimeChartData([])
    }
  }

  // Handle AQI Trend chart refresh
  const handleRefreshAQIChart = async () => {
    if (!showAnalysis || (!drawnGeometry && !uploadedKML)) return
    
    let geometry = drawnGeometry
    if (!geometry && uploadedKML) {
      geometry = parseKMLToGeometry(uploadedKML.content)
    }

    if (geometry) {
      const center = calculateGeometryCenter(geometry)
      if (center) {
        if (viewMode === 'live') {
          await fetchAllLiveData(center.latitude, center.longitude)
        } else {
          setLoadingChart(true)
          await fetchAQIChartData(center.latitude, center.longitude)
        }
      }
    }
  }

  // Handle Time chart refresh
  const handleRefreshTimeChart = async () => {
    if (!showAnalysis || (!drawnGeometry && !uploadedKML)) return
    
    let geometry = drawnGeometry
    if (!geometry && uploadedKML) {
      geometry = parseKMLToGeometry(uploadedKML.content)
    }

    if (geometry) {
      const center = calculateGeometryCenter(geometry)
      if (center) {
        if (viewMode === 'live') {
          await fetchAllLiveData(center.latitude, center.longitude)
        } else {
          setLoadingTimeChart(true)
          await fetchTimeChartData(center.latitude, center.longitude)
        }
      }
    }
  }

  // Handle analyse button click
  const handleAnalyse = async () => {
    if (!drawnGeometry && !uploadedKML) {
      alert('Please draw an area or upload a KML file first')
      return
    }

    setLoading(true)
    setError(null)
    setShowBodCodOverlay(false)
    setShowAqiOverlay(false)
    setShowFlood(false)
    setShowBathy(false)
    setShowGeologyOverlay(false)
    setShowFloodOverlay(false)

    try {
      // Get geometry (from drawing or KML)
      let geometry = drawnGeometry
      if (!geometry && uploadedKML) {
        geometry = parseKMLToGeometry(uploadedKML.content)
      }

      if (!geometry) {
        throw new Error('Could not parse geometry')
      }

      // Calculate center coordinates
      const center = calculateGeometryCenter(geometry)
      if (!center) {
        throw new Error('Could not calculate center coordinates')
      }

      // Set current view date to end date (last date)
      const viewDate = endDate
      setCurrentViewDate(viewDate)
      setShowAnalysis(true)
      // Reset to live mode when starting new analysis
      setViewMode('live')

      // Single unified fetch for live mode — avoids duplicate API calls
      await fetchAllLiveData(center.latitude, center.longitude)
    } catch (err) {
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAqiLayerToggle = useCallback(async (checked) => {
    if (!checked) {
      setShowAqiOverlay(false)
      return
    }
    if (!drawnGeometry && !uploadedKML) {
      alert('Please draw an area or upload a KML file first')
      return
    }
    setShowAqiOverlay(true)
    try {
      let geometry = drawnGeometry
      if (!geometry && uploadedKML) {
        geometry = parseKMLToGeometry(uploadedKML.content)
      }
      if (!geometry) throw new Error('Could not parse geometry')
      const center = calculateGeometryCenter(geometry)
      if (!center) throw new Error('Could not calculate center coordinates')
      await fetchAllLiveData(center.latitude, center.longitude)
    } catch (err) {
      setError(err.message)
      alert(`Error: ${err.message}`)
      setShowAqiOverlay(false)
    }
  }, [drawnGeometry, uploadedKML])

  // ?view= lets the hub land straight in a view. Applied once, then dropped from
  // the URL so the header buttons stay the only owner of which view is showing.
  useEffect(() => {
    if (!requestedView || appliedViewRef.current === requestedView) return
    if (location.state?.restoreAnalysis) return

    // Marked before any state change so StrictMode's second pass is a no-op.
    const clearParam = () => {
      appliedViewRef.current = requestedView
      setSearchParams({}, { replace: true })
    }

    if (
      requestedView === 'flood'
      || requestedView === 'bodcod'
      || requestedView === 'waterquality'
      || requestedView === 'salinity'
      || requestedView === 'landuse'
      || requestedView === 'biodiversity'
      || requestedView === 'climate'
      || requestedView === 'geology'
      || requestedView === 'pollution'
      || requestedView === 'corridors'
    ) {
      clearParam()
      if (requestedView === 'flood') setShowFlood(true)
      else if (requestedView === 'pollution') {
        setShowGarbageLayer(true)
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowNdsiSalinityLayer(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowBiodiversityOverlay(false)
        setShowClimateOverlay(false)
        setShowGeologyOverlay(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (requestedView === 'salinity') {
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowNdsiSalinityLayer(true)
        setShowWstLayer(false)
        setShowTssLayer(false)
        setShowNdciLayer(false)
        setShowNdwiLayer(false)
        setShowGarbageLayer(false)
        setShowWrdFloodlines(false)
        setShowFloodDepthLayer(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowLulcLayer(false)
        setShowUrbanVegLayer(false)
        setShowSiltClassLayer(false)
        setShowSiltVolumeLayer(false)
        setShowBiodiversityOverlay(false)
        setShowBiodiversityTypeLayer(false)
        setShowBiodiversityHealthLayer(false)
        setShowClimateOverlay(false)
        setShowClimateFloodHeat(false)
        setShowClimateWaterHeat(false)
        setShowGeologyOverlay(false)
        setShowTributaryLayer(false)
        setShowMainStemLayer(false)
        setShowErosionLayer(false)
        setShowLithologyLayer(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (
        requestedView === 'bodcod'
        || requestedView === 'waterquality'
      ) {
        // Water quality: TSS, NDCI, NDWI, WST, BOD–COD.
        setShowBodCod(false)
        setShowBodCodOverlay(true)
        setShowNdsiSalinityLayer(false)
        setShowTssLayer(true)
        setShowNdciLayer(false)
        setShowNdwiLayer(false)
        setShowWstLayer(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowBiodiversityOverlay(false)
        setShowClimateOverlay(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (requestedView === 'landuse') {
        // Soil & land use: LULC, silt classification, urban vegetation.
        setShowLandUseOverlay(true)
        setShowLulcLayer(true)
        setShowUrbanVegLayer(true)
        setShowSiltClassLayer(true)
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowBiodiversityOverlay(false)
        setShowClimateOverlay(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (requestedView === 'biodiversity') {
        // Biodiversity: vegetation type + health rasters from KMZ.
        setShowBiodiversityOverlay(true)
        setShowBiodiversityTypeLayer(true)
        setShowBiodiversityHealthLayer(false)
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowClimateOverlay(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (requestedView === 'climate') {
        setShowClimateOverlay(true)
        setShowClimateFloodHeat(true)
        setShowClimateWaterHeat(true)
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowBiodiversityOverlay(false)
        setShowBathy(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else if (requestedView === 'geology') {
        setShowGeologyOverlay(true)
        setShowTributaryLayer(true)
        setShowMainStemLayer(false)
        setShowErosionLayer(true)
        setShowLithologyLayer(false)
        setShowBathy(false)
        setShowBodCod(false)
        setShowBodCodOverlay(false)
        setShowFlood(false)
        setShowFloodOverlay(false)
        setShowLandUseOverlay(false)
        setShowBiodiversityOverlay(false)
        setShowClimateOverlay(false)
        setShowAnalysis(false)
        setShowAqiOverlay(false)
      }
      else setShowFloodOverlay(true)
      return
    }

    if (requestedView === 'aqi') {
      // handleAnalyse needs geometry, which arrives with the KML fetch on mount.
      if (!uploadedKML) return
      clearParam()
      handleAnalyse()
      return
    }

    clearParam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedView, uploadedKML, location.state])

  // Removed automatic API call on selectedHeight change
  // Data will only refresh when user explicitly clicks buttons or changes view mode
  // useEffect(() => {
  //   if (showAnalysis && currentViewDate && (drawnGeometry || uploadedKML)) {
  //     const geometry = drawnGeometry || (uploadedKML ? parseKMLToGeometry(uploadedKML.content) : null)
  //     if (geometry) {
  //       const center = calculateGeometryCenter(geometry)
  //       if (center) {
  //         if (viewMode === 'live') {
  //           fetchDataForDate(center.latitude, center.longitude, currentViewDate)
  //         } else {
  //           fetchDataForMode(center.latitude, center.longitude)
  //         }
  //         // Refresh chart data
  //         fetchAQIChartData(center.latitude, center.longitude)
  //         fetchTimeChartData(center.latitude, center.longitude)
  //       }
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedHeight])

  // Removed automatic API call on date change
  // Data will only refresh when user explicitly clicks date navigation buttons
  // useEffect(() => {
  //   if (showAnalysis && currentViewDate && (drawnGeometry || uploadedKML) && viewMode === 'live') {
  //     let geometry = drawnGeometry
  //     if (!geometry && uploadedKML) {
  //       geometry = parseKMLToGeometry(uploadedKML.content)
  //     }

  //     if (geometry) {
  //       const center = calculateGeometryCenter(geometry)
  //       if (center) {
  //         fetchDataForDate(center.latitude, center.longitude, currentViewDate)
  //       }
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [currentViewDate, showAnalysis])

  // Fetch AQI chart data based on view mode
  const fetchAQIChartData = async (latitude, longitude) => {
    setLoadingChart(true)
    setAqiChartData([])
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const now = new Date()
      let chartData = []

      if (viewMode === 'live') {
        // Live: Last 60 minutes - X-axis shows 1, 5, 10, ..., 60
        const aqiHourly = await fetchHourlyAQIData(latitude, longitude, today)
        const records = transformRecordsByHeight(aqiHourly.hourly_records || [], selectedHeight)
        
        // Get records from the last hour (60 minutes)
        const oneHourAgo = subHours(now, 1)
        const lastHourRecords = records
          .filter(r => {
            if (!r || r.aqi === null || r.aqi === undefined) return false
            const recordTime = parseISO(r.date)
            return recordTime >= oneHourAgo
          })
          .sort((a, b) => parseISO(a.date) - parseISO(b.date))
        
        // Create minute buckets (1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60)
        const minuteBuckets = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
        
        if (lastHourRecords.length > 0) {
          // Map records to closest minute bucket
          chartData = minuteBuckets.map(minute => {
            const targetTime = subHours(now, 1).getTime() + (60 - minute) * 60 * 1000
            const closestRecord = lastHourRecords.reduce((closest, record) => {
              const recordTime = parseISO(record.date).getTime()
              const closestTime = closest ? parseISO(closest.date).getTime() : null
              if (!closestTime) return record
              return Math.abs(recordTime - targetTime) < Math.abs(closestTime - targetTime) ? record : closest
            }, null)
            
            return {
              time: minute.toString(),
              aqi: closestRecord ? closestRecord.aqi : (lastHourRecords[0]?.aqi || 0),
              fullTime: closestRecord ? closestRecord.date : now.toISOString(),
              minute: minute
            }
          })
        } else {
          // Fallback: use last few records and map to minute positions
          const fallbackRecords = records.slice(-12).filter(r => r && r.aqi !== null && r.aqi !== undefined)
          chartData = minuteBuckets.map((minute, idx) => ({
            time: minute.toString(),
            aqi: fallbackRecords[idx]?.aqi || fallbackRecords[0]?.aqi || 0,
            fullTime: fallbackRecords[idx]?.date || now.toISOString(),
            minute: minute
          }))
        }
      } else if (viewMode === 'daily') {
        // Daily: Last 24 hours from current time - X-axis shows 1, 2, 3, ..., 24
        const twentyFourHoursAgo = subHours(now, 24)
        const startDate = format(twentyFourHoursAgo, 'yyyy-MM-dd')
        const endDate = today
        
        // Fetch data from 24 hours ago to today (may span 2 calendar days)
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, startDate, endDate)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Get last 24 hours of records from current time
        const last24HoursRecords = records
          .filter(r => {
            if (!r || r.aqi === null || r.aqi === undefined) return false
            const recordTime = parseISO(r.date)
            return recordTime >= twentyFourHoursAgo && recordTime <= now
          })
          .sort((a, b) => parseISO(a.date) - parseISO(b.date))
        
        // Create hour buckets (1-24) representing hours from 24 hours ago to now
        const hourBuckets = Array.from({ length: 24 }, (_, i) => i + 1)
        
        if (last24HoursRecords.length > 0) {
          // Map records to hour positions (1 = 24 hours ago, 24 = current hour)
          const hourMap = new Map()
          last24HoursRecords.forEach(record => {
            const recordTime = parseISO(record.date)
            const hoursDiff = Math.floor((now - recordTime) / (1000 * 60 * 60))
            const hourPosition = 24 - hoursDiff
            if (hourPosition >= 1 && hourPosition <= 24) {
              if (!hourMap.has(hourPosition)) {
                hourMap.set(hourPosition, [])
              }
              hourMap.get(hourPosition).push(record.aqi)
            }
          })
          
          chartData = hourBuckets.map(hour => {
            const aqis = hourMap.get(hour) || []
            const avgAqi = aqis.length > 0 
              ? Math.round(aqis.reduce((sum, val) => sum + val, 0) / aqis.length)
              : (last24HoursRecords[0]?.aqi || 0)
            
            // Calculate the actual time for this hour bucket
            const bucketTime = subHours(now, 24 - hour)
            const timeLabel = format(bucketTime, 'HH:mm')
            
            return {
              time: timeLabel,
              aqi: avgAqi,
              fullTime: bucketTime.toISOString(),
              hour: hour
            }
          })
        } else {
          // Fallback: use available records
          chartData = hourBuckets.map((hour, idx) => {
            const bucketTime = subHours(now, 24 - hour)
            const timeLabel = format(bucketTime, 'HH:mm')
            return {
              time: timeLabel,
              aqi: records[idx]?.aqi || records[0]?.aqi || 0,
              fullTime: records[idx]?.date || bucketTime.toISOString(),
              hour: hour
            }
          })
        }
      } else if (viewMode === 'weekly') {
        // Weekly: Last 7 days - X-axis shows 1st day, 2nd day, ..., 7th day
        const weekAgo = format(subDays(now, 6), 'yyyy-MM-dd') // 6 days ago + today = 7 days
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, weekAgo, today)
        console.log("7 Days data fetched", aqiRange)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Group by date and calculate daily averages
        const dailyData = {}
        records
          .filter(r => r && r.aqi !== null && r.aqi !== undefined)
          .forEach(record => {
            const date = parseISO(record.date)
            const dateKey = format(date, 'yyyy-MM-dd')
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { aqis: [], date: date }
            }
            dailyData[dateKey].aqis.push(record.aqi)
          })
        
        // Sort dates and map to actual dates
        const sortedDates = Object.keys(dailyData).sort()
        chartData = sortedDates.map((dateKey, index) => {
          const dayData = dailyData[dateKey]
          const avgAqi = Math.round(dayData.aqis.reduce((sum, val) => sum + val, 0) / dayData.aqis.length)
          const dayNumber = index + 1
          // Format date as "MMM dd" (e.g., "Jan 15")
          const dateLabel = format(dayData.date, 'MMM dd')
          
          return {
            time: dateLabel,
            aqi: avgAqi,
            fullTime: dateKey,
            day: dayNumber
          }
        })
      } else if (viewMode === 'monthly') {
        // Monthly: Last 30/31 days - X-axis shows 1, 2, 3, ..., 30/31
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const daysToShow = Math.min(31, daysInMonth)
        const monthAgo = format(subDays(now, daysToShow - 1), 'yyyy-MM-dd')
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, monthAgo, today)
        console.log("30 Days data fetched", aqiRange)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Group by date and calculate daily averages
        const dailyData = {}
        records
          .filter(r => r && r.aqi !== null && r.aqi !== undefined)
          .forEach(record => {
            const date = parseISO(record.date)
            const dateKey = format(date, 'yyyy-MM-dd')
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { aqis: [], date: date }
            }
            dailyData[dateKey].aqis.push(record.aqi)
          })
        
        // Sort dates and map to actual dates
        const sortedDates = Object.keys(dailyData).sort()
        chartData = sortedDates.map((dateKey, index) => {
          const dayData = dailyData[dateKey]
          const avgAqi = Math.round(dayData.aqis.reduce((sum, val) => sum + val, 0) / dayData.aqis.length)
          // Format date as "MMM dd" (e.g., "Jan 15")
          const dateLabel = format(dayData.date, 'MMM dd')
          
          return {
            time: dateLabel,
            aqi: avgAqi,
            fullTime: dateKey,
            day: index + 1
          }
        })
        
        // Ensure we have data points for all days with dates
        if (chartData.length < daysToShow) {
          const dateMap = new Map()
          chartData.forEach(d => dateMap.set(d.fullTime, d.aqi))
          
          const allDays = Array.from({ length: daysToShow }, (_, i) => {
            const dayDate = subDays(now, daysToShow - i - 1)
            const dateKey = format(dayDate, 'yyyy-MM-dd')
            const dateLabel = format(dayDate, 'MMM dd')
            return {
              time: dateLabel,
              aqi: dateMap.get(dateKey) || (chartData[0]?.aqi || 0),
              fullTime: dateKey,
              day: i + 1
            }
          })
          chartData = allDays
        }
      }

      setAqiChartData(chartData)
    } catch (err) {
      console.error('Error fetching AQI chart data:', err)
      setAqiChartData([])
    } finally {
      setLoadingChart(false)
    }
  }

  // Helper function to get day suffix (1st, 2nd, 3rd, etc.)
  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  // Helper function to convert time string (HH:mm) to minutes for Y-axis
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Helper function to convert minutes to time string (HH:mm)
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Fetch Time chart data based on view mode
  const fetchTimeChartData = async (latitude, longitude) => {
    setLoadingTimeChart(true)
    setTimeChartData([])
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const now = new Date()
      let chartData = []

      if (viewMode === 'live') {
        // Live: Last 60 minutes - X-axis: minutes (1-60), Y-axis: time (HH:mm)
        const aqiHourly = await fetchHourlyAQIData(latitude, longitude, today)
        console.log("60 Minutes data fetched", aqiHourly)
        const records = transformRecordsByHeight(aqiHourly.hourly_records || [], selectedHeight)
        
        const oneHourAgo = subHours(now, 1)
        const lastHourRecords = records
          .filter(r => {
            if (!r || r.aqi === null || r.aqi === undefined) return false
            const recordTime = parseISO(r.date)
            return recordTime >= oneHourAgo
          })
          .sort((a, b) => parseISO(a.date) - parseISO(b.date))
        
        const minuteBuckets = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
        
        chartData = minuteBuckets.map(minute => {
          const targetTime = subHours(now, 1).getTime() + (60 - minute) * 60 * 1000
          const closestRecord = lastHourRecords.reduce((closest, record) => {
            const recordTime = parseISO(record.date).getTime()
            const closestTime = closest ? parseISO(closest.date).getTime() : null
            if (!closestTime) return record
            return Math.abs(recordTime - targetTime) < Math.abs(closestTime - targetTime) ? record : closest
          }, null)
          
          const recordTime = closestRecord ? parseISO(closestRecord.date) : now
          const timeStr = format(recordTime, 'HH:mm')
          
          return {
            day: minute.toString(),
            time: timeStr,
            timeMinutes: timeToMinutes(timeStr),
            aqi: closestRecord ? closestRecord.aqi : 0,
            fullTime: closestRecord ? closestRecord.date : now.toISOString()
          }
        })
      } else if (viewMode === 'daily') {
        // Daily: Last 24 hours from current time - X-axis: hours (1-24), Y-axis: time (HH:mm)
        const twentyFourHoursAgo = subHours(now, 24)
        const startDate = format(twentyFourHoursAgo, 'yyyy-MM-dd')
        const endDate = today
        
        // Fetch data from 24 hours ago to today (may span 2 calendar days)
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, startDate, endDate)
        console.log("24 Hours data fetched", aqiRange)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Get last 24 hours of records from current time
        const last24HoursRecords = records
          .filter(r => {
            if (!r || r.aqi === null || r.aqi === undefined) return false
            const recordTime = parseISO(r.date)
            return recordTime >= twentyFourHoursAgo && recordTime <= now
          })
          .sort((a, b) => parseISO(a.date) - parseISO(b.date))
        
        const hourBuckets = Array.from({ length: 24 }, (_, i) => i + 1)
        
        chartData = hourBuckets.map(hour => {
          // Calculate the target time for this hour bucket (hour 1 = 24 hours ago, hour 24 = now)
          const targetTime = subHours(now, 24 - hour)
          const targetTimeMs = targetTime.getTime()
          
          // Find the closest record to this target time
          const closestRecord = last24HoursRecords.reduce((closest, record) => {
            const recordTime = parseISO(record.date).getTime()
            const closestTime = closest ? parseISO(closest.date).getTime() : null
            if (!closestTime) return record
            return Math.abs(recordTime - targetTimeMs) < Math.abs(closestTime - targetTimeMs) ? record : closest
          }, null)
          
          // Use the actual time of the record, or the target time if no record found
          const recordTime = closestRecord ? parseISO(closestRecord.date) : targetTime
          const timeStr = format(recordTime, 'HH:mm')
          
          return {
            day: hour.toString(),
            time: timeStr,
            timeMinutes: timeToMinutes(timeStr),
            aqi: closestRecord ? closestRecord.aqi : 0,
            fullTime: closestRecord ? closestRecord.date : targetTime.toISOString()
          }
        })
      } else if (viewMode === 'weekly') {
        // Weekly: Last 7 days - X-axis: days (1-7), Y-axis: AQI values
        const weekAgo = format(subDays(now, 6), 'yyyy-MM-dd')
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, weekAgo, today)
        console.log("7 Days data fetched", aqiRange)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Group by date and get all records with their times
        const dailyData = {}
        records
          .filter(r => r && r.aqi !== null && r.aqi !== undefined)
          .forEach(record => {
            const date = parseISO(record.date)
            const dateKey = format(date, 'yyyy-MM-dd')
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { records: [], date: date }
            }
            dailyData[dateKey].records.push({
              aqi: record.aqi,
              time: format(date, 'HH:mm'),
              fullTime: record.date
            })
          })
        
        const sortedDates = Object.keys(dailyData).sort()
        chartData = sortedDates.map((dateKey, index) => {
          const dayData = dailyData[dateKey]
          const dayNumber = index + 1
          // Get day name (Monday, Tuesday, etc.)
          const dayName = format(dayData.date, 'EEEE')
          
          // Get average AQI for this day
          const avgAqi = dayData.records.length > 0
            ? Math.round(dayData.records.reduce((sum, r) => sum + r.aqi, 0) / dayData.records.length)
            : 0
          
          // Get the time when AQI was recorded (use the record with closest AQI to average, or first record)
          const closestRecord = dayData.records.reduce((closest, record) => {
            if (!closest) return record
            return Math.abs(record.aqi - avgAqi) < Math.abs(closest.aqi - avgAqi) ? record : closest
          }, null)
          
          const timeStr = closestRecord ? closestRecord.time : format(dayData.date, 'HH:mm')
          
          return {
            day: dayName,
            time: timeStr,
            timeMinutes: timeToMinutes(timeStr),
            aqi: avgAqi,
            fullTime: dateKey,
            dayNumber: dayNumber
          }
        })
      } else if (viewMode === 'monthly') {
        // Monthly: Last 30/31 days - X-axis: days (1-30/31), Y-axis: AQI values
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const daysToShow = Math.min(31, daysInMonth)
        const monthAgo = format(subDays(now, daysToShow - 1), 'yyyy-MM-dd')
        const aqiRange = await fetchHourlyAQIDataRange(latitude, longitude, monthAgo, today)
        console.log("30 Days data fetched", aqiRange)
        const records = transformRecordsByHeight(aqiRange.hourly_records || [], selectedHeight)
        
        // Group by date and get all records with their times
        const dailyData = {}
        records
          .filter(r => r && r.aqi !== null && r.aqi !== undefined)
          .forEach(record => {
            const date = parseISO(record.date)
            const dateKey = format(date, 'yyyy-MM-dd')
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { records: [], date: date }
            }
            dailyData[dateKey].records.push({
              aqi: record.aqi,
              time: format(date, 'HH:mm'),
              fullTime: record.date
            })
          })
        
        const sortedDates = Object.keys(dailyData).sort()
        chartData = sortedDates.map((dateKey, index) => {
          const dayData = dailyData[dateKey]
          
          // Get average AQI for this day
          const avgAqi = dayData.records.length > 0
            ? Math.round(dayData.records.reduce((sum, r) => sum + r.aqi, 0) / dayData.records.length)
            : 0
          
          // Get the time when AQI was recorded (use the record with closest AQI to average, or first record)
          const closestRecord = dayData.records.reduce((closest, record) => {
            if (!closest) return record
            return Math.abs(record.aqi - avgAqi) < Math.abs(closest.aqi - avgAqi) ? record : closest
          }, null)
          
          const timeStr = closestRecord ? closestRecord.time : format(dayData.date, 'HH:mm')
          
          return {
            day: (index + 1).toString(),
            time: timeStr,
            timeMinutes: timeToMinutes(timeStr),
            aqi: avgAqi,
            fullTime: dateKey,
            dayNumber: index + 1
          }
        })
      }

      setTimeChartData(chartData)
    } catch (err) {
      console.error('Error fetching time chart data:', err)
      setTimeChartData([])
    } finally {
      setLoadingTimeChart(false)
    }
  }

  // Removed automatic API call on view mode change
  // Data will only refresh when user explicitly clicks view mode buttons (60 Minutes, 24 Hours, etc.)
  // useEffect(() => {
  //   if (showAnalysis && (drawnGeometry || uploadedKML)) {
  //     let geometry = drawnGeometry
  //     if (!geometry && uploadedKML) {
  //       geometry = parseKMLToGeometry(uploadedKML.content)
  //     }

  //     if (geometry) {
  //       const center = calculateGeometryCenter(geometry)
  //       if (center) {
  //         // Set loading state when view mode changes
  //         setLoadingChart(true)
  //         setLoadingTimeChart(true)
  //         Promise.all([
  //           fetchDataForMode(center.latitude, center.longitude),
  //           fetchAQIChartData(center.latitude, center.longitude),
  //           fetchTimeChartData(center.latitude, center.longitude)
  //         ])
  //       }
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [viewMode])

  const isMulaMuthaRiver =
    uploadedKML?.displayName === 'Mula-Mutha River' ||
    uploadedKML?.name?.toLowerCase().includes('mula-mutha')

  const geologyLayersOn =
    showErosionLayer ||
    showLithologyLayer ||
    showTributaryLayer ||
    showMainStemLayer ||
    showBathyMapLayer
  const waterQualityLayersOn =
    showTssLayer || showNdciLayer || showNdwiLayer || showWstLayer
  const landUseLayersOn =
    showSiltClassLayer || showSiltVolumeLayer || showUrbanVegLayer || showLulcLayer
  const biodiversityLayersOn =
    showBiodiversityTypeLayer || showBiodiversityHealthLayer
  const climateLayersOn = showClimateFloodHeat || showClimateWaterHeat || showWrdFloodlines

  const chainageLayer = {
    id: 'chainage',
    label: 'Chainage',
    hint: '100 m stations · 0+000 to 16+400',
    checked: showChainageLayer,
    onToggle: setShowChainageLayer,
  }

  const lulcYear = 2021 + (Number.isFinite(lulcPeriodId) ? lulcPeriodId : 4)
  const lulcLegend = legendForLayer(`lulc-${lulcYear}`) || legendForLayer('lulc')

  const layersByView = useMemo(() => ({
    aqi: [
      {
        id: 'aqi',
        label: 'Live AQI',
        hint: 'Gauge, pollutants and trend',
        checked: showAqiOverlay,
        onToggle: handleAqiLayerToggle,
      },
      ...(isMulaMuthaRiver ? [chainageLayer] : []),
    ],
    geology: [
      {
        id: 'lithology',
        label: 'Spectral lithology',
        hint: 'Provisional surface-material classes',
        checked: showLithologyLayer,
        onToggle: setShowLithologyLayer,
      },
      {
        id: 'erosion',
        label: 'Bank erosion hotspots',
        hint: '2016–2026 classified overlay',
        checked: showErosionLayer,
        onToggle: setShowErosionLayer,
      },
      {
        id: 'tributaries',
        label: 'Joining streams',
        hint: 'OSM waterways on the reach',
        checked: showTributaryLayer,
        onToggle: setShowTributaryLayer,
      },
      {
        id: 'mainstem',
        label: 'Main stem',
        hint: 'Mula / Mutha OSM ways',
        checked: showMainStemLayer,
        onToggle: setShowMainStemLayer,
      },
      {
        id: 'bathymetry',
        label: 'Bathymetry',
        hint: 'Satellite-derived depth 1.5–2.0 m MSL',
        checked: showBathyMapLayer,
        onToggle: setShowBathyMapLayer,
      },
      chainageLayer,
    ],
    salinity: [
      {
        id: 'ndsi-salinity',
        label: 'NDSI Salinity',
        hint: 'Odeh & Onus (2008) · river surface',
        checked: showNdsiSalinityLayer,
        onToggle: setShowNdsiSalinityLayer,
      },
      chainageLayer,
    ],
    pollution: [
      {
        id: 'garbage',
        label: 'Garbage locations',
        hint: '67 detected solid-waste sites',
        checked: showGarbageLayer,
        onToggle: setShowGarbageLayer,
      },
      chainageLayer,
    ],
    waterquality: [
      {
        id: 'tss',
        label: 'Turbidity / TSS',
        hint: 'July 2026 classified overlay',
        checked: showTssLayer,
        onToggle: setShowTssLayer,
      },
      {
        id: 'ndci',
        label: 'NDCI — Chlorophyll',
        hint: 'July 2026 classified overlay',
        checked: showNdciLayer,
        onToggle: setShowNdciLayer,
      },
      {
        id: 'ndwi',
        label: 'NDWI — Water Detection',
        hint: 'July 2026 classified overlay',
        checked: showNdwiLayer,
        onToggle: setShowNdwiLayer,
      },
      {
        id: 'wst',
        label: 'WST — Temperature',
        hint: 'Salinity thermal proxy',
        checked: showWstLayer,
        onToggle: setShowWstLayer,
      },
      chainageLayer,
    ],
    landuse: [
      {
        id: 'lulc',
        label: 'LULC',
        hint: `Land use / land cover · ${lulcYear}`,
        checked: showLulcLayer,
        onToggle: setShowLulcLayer,
        colors: lulcLegend?.colors,
      },
      {
        id: 'silt-class',
        label: 'Silt classification',
        hint: 'Monthly classed raster',
        checked: showSiltClassLayer,
        onToggle: setShowSiltClassLayer,
      },
      {
        id: 'silt-volume',
        label: 'Silt volume surface',
        hint: 'Monthly volume overlay',
        checked: showSiltVolumeLayer,
        onToggle: setShowSiltVolumeLayer,
      },
      {
        id: 'urban-veg',
        label: 'Vegetation extent',
        hint: '1 km urban vegetation box',
        checked: showUrbanVegLayer,
        onToggle: setShowUrbanVegLayer,
      },
      chainageLayer,
    ],
    biodiversity: [
      {
        id: 'type',
        label: 'Vegetation type',
        hint: 'Trees, shrub, grass, mixed',
        checked: showBiodiversityTypeLayer,
        onToggle: setShowBiodiversityTypeLayer,
      },
      {
        id: 'health',
        label: 'Vegetation health',
        hint: 'Score bands from KMZ',
        checked: showBiodiversityHealthLayer,
        onToggle: setShowBiodiversityHealthLayer,
      },
      chainageLayer,
    ],
    climate: [
      {
        id: 'flood-heat',
        label: 'Flood heatmap',
        hint: 'Classed flood points by image pair',
        checked: showClimateFloodHeat,
        onToggle: setShowClimateFloodHeat,
      },
      {
        id: 'water-heat',
        label: 'Surface-water heatmap',
        hint: 'Classed water points by image pair',
        checked: showClimateWaterHeat,
        onToggle: setShowClimateWaterHeat,
      },
      {
        id: 'wrd-floodlines',
        label: 'WRD flood lines',
        hint: 'Blue · red · green survey lines',
        checked: showWrdFloodlines,
        onToggle: setShowWrdFloodlines,
      },
      chainageLayer,
    ],
    flood: [
      {
        id: 'depth',
        label: 'Water depth',
        hint: 'Classed depth 1.5–2.0 m',
        checked: showFloodDepthLayer,
        onToggle: setShowFloodDepthLayer,
      },
      chainageLayer,
    ],
  }), [
    isMulaMuthaRiver,
    showAqiOverlay,
    handleAqiLayerToggle,
    showChainageLayer,
    showErosionLayer,
    showLithologyLayer,
    showTributaryLayer,
    showMainStemLayer,
    showBathyMapLayer,
    showTssLayer,
    showNdciLayer,
    showNdwiLayer,
    showWstLayer,
    showNdsiSalinityLayer,
    showSiltClassLayer,
    showSiltVolumeLayer,
    showLulcLayer,
    lulcPeriodId,
    lulcYear,
    lulcLegend,
    showUrbanVegLayer,
    showBiodiversityTypeLayer,
    showBiodiversityHealthLayer,
    showClimateFloodHeat,
    showClimateWaterHeat,
    showWrdFloodlines,
    showGarbageLayer,
    showFloodDepthLayer,
  ])

  return (
    <div className={`dashboard ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-container">
            <div className="logo-icon">
              <div className="logo-eye">
                <div className="eye-pupil"></div>
                <div className="eye-shine"></div>
              </div>
              <div className="logo-ring"></div>
            </div>
            <h1 className="logo-text">River Eye</h1>
          </div>
        </div>

        <div className="header-center">
          <div className="header-mode-switch" role="group" aria-label="Dashboard views">
            <button
              type="button"
              className={`header-mode-btn is-aqi ${showAnalysis ? 'active' : ''}`}
              onClick={handleAnalyse}
              disabled={loading}
              title="Open AQI analysis"
            >
              <span className="header-mode-icon" aria-hidden="true">
                <svg viewBox="0 0 32 18" fill="none">
                  <path d="M1 16h30" stroke="currentColor" strokeOpacity="0.28" />
                  <path d="M2 13c3-1 5-6 8-6s4 7 7 7 4-9 7-9 5 5 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="24" cy="5" r="1.6" fill="currentColor" />
                </svg>
              </span>
              <span className="header-mode-copy">
                <strong>{loading ? 'Loading' : 'AQI'}</strong>
                <small>Air quality</small>
              </span>
            </button>
            {(uploadedKML?.displayName === 'Mula-Mutha River' ||
              uploadedKML?.name?.toLowerCase().includes('mula-mutha')) && (
              <button
                type="button"
                className={`header-mode-btn is-bod ${showBodCod ? 'active' : ''}`}
                onClick={() => {
                  setShowBodCod(true)
                  setShowAnalysis(false)
                  setShowBodCodOverlay(false)
                  setShowAqiOverlay(false)
                  setShowBathy(false)
                  setShowGeologyOverlay(false)
                }}
                title="Open BOD-COD river dashboard"
              >
                <span className="header-mode-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 18" fill="none">
                    <path d="M1 16h30" stroke="currentColor" strokeOpacity="0.28" />
                    <rect x="4" y="9" width="4" height="7" rx="1" fill="currentColor" fillOpacity="0.45" />
                    <rect x="11" y="6" width="4" height="10" rx="1" fill="currentColor" fillOpacity="0.7" />
                    <rect x="18" y="3" width="4" height="13" rx="1" fill="currentColor" />
                    <rect x="25" y="7" width="4" height="9" rx="1" fill="currentColor" fillOpacity="0.55" />
                  </svg>
                </span>
                <span className="header-mode-copy">
                  <strong>BOD-COD</strong>
                  <small>Water quality</small>
                </span>
              </button>
            )}
            {(uploadedKML?.displayName === 'Mula-Mutha River' ||
              uploadedKML?.name?.toLowerCase().includes('mula-mutha')) && (
              <button
                type="button"
                className={`header-mode-btn is-flood ${showFlood ? 'active' : ''}`}
                onClick={() => {
                  setShowFlood(true)
                  setShowBodCod(false)
                  setShowAnalysis(false)
                  setShowBodCodOverlay(false)
                  setShowAqiOverlay(false)
                  setShowFloodOverlay(false)
                  setShowBathy(false)
                  setShowGeologyOverlay(false)
                }}
                title="Open digital twin and flood forecast dashboard"
              >
                <span className="header-mode-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 18" fill="none">
                    <path d="M1 5c3-2 5 2 8 0s5-2 8 0 5 2 8 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.45" />
                    <path d="M1 10c3-2 5 2 8 0s5-2 8 0 5 2 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M1 15c3-2 5 2 8 0s5-2 8 0 5 2 8 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.7" />
                  </svg>
                </span>
                <span className="header-mode-copy">
                  <strong>Digital Twin</strong>
                  <small>Flood · WSE</small>
                </span>
              </button>
            )}
            {(uploadedKML?.displayName === 'Mula-Mutha River' ||
              uploadedKML?.name?.toLowerCase().includes('mula-mutha')) && (
              <button
                type="button"
                className={`header-mode-btn is-bathy ${showBathy ? 'active' : ''}`}
                onClick={() => {
                  setShowBathy(true)
                  setShowFlood(false)
                  setShowBodCod(false)
                  setShowAnalysis(false)
                  setShowBodCodOverlay(false)
                  setShowAqiOverlay(false)
                  setShowFloodOverlay(false)
                  setShowGeologyOverlay(false)
                }}
                title="Open bathymetry dashboard"
              >
                <span className="header-mode-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 18" fill="none">
                    <path d="M1 4h30" stroke="currentColor" strokeOpacity="0.28" />
                    <path d="M2 5c4 6 7 10 10 10s5-7 8-7 5 6 9 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 14h28" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="header-mode-copy">
                  <strong>Bathymetry</strong>
                  <small>Depth survey</small>
                </span>
              </button>
            )}
          </div>
        </div>
        
        <div className="header-right">
          <button
            type="button"
            className="header-home-button"
            onClick={() => navigate('/home')}
            title="Back to home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10.5 12 3l9 7.5"></path>
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"></path>
            </svg>
            <span>Home</span>
          </button>
          <button className="logout-button" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <main className="main-content">
          {showBodCod || showFlood || showBathy ? (
            <div className="bod-cod-view">
              <button
                type="button"
                className="floating-back-button"
                onClick={() => {
                  const fromBathy = showBathy
                  setShowAnalysis(false)
                  setShowBodCod(false)
                  setShowFlood(false)
                  setShowBathy(false)
                  if (fromBathy) setShowGeologyOverlay(true)
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>Back to Map</span>
              </button>
              <iframe
                title={
                  showBathy
                    ? 'Mula-Mutha Bathymetry Dashboard'
                    : showFlood
                      ? 'Mula-Mutha Digital Twin'
                      : 'Mula-Mutha BOD-COD Dashboard'
                }
                src={
                  showBathy
                    ? '/asset/mula-mutha-bathymetry.html'
                    : showFlood
                      ? '/asset/mula-mutha-twin.html'
                      : '/asset/mula-mutha-bod-cod.html'
                }
                className="bod-cod-frame"
              />
            </div>
          ) : !showAnalysis ? (
            <LayerPanelSlotProvider>
            <div className="map-wrapper">
              <MapViewsControl
                loading={loading}
                isMulaMutha={isMulaMuthaRiver}
                layersByView={layersByView}
              />
              <MapLayersControl mapLayer={mapLayer} onLayerChange={setMapLayer} />
              {waterQualityLayersOn && (
                <BodCodMapOverlay
                  showTssLayer={showTssLayer}
                  showNdciLayer={showNdciLayer}
                  showNdwiLayer={showNdwiLayer}
                  showWstLayer={showWstLayer}
                  showChainageLayer={showChainageLayer}
                  focusChainage={focusChainage}
                  onSelectChainage={(station) => setFocusChainage({ ...station, at: Date.now() })}
                />
              )}
              {showFloodDepthLayer && (
                <FloodMapOverlay
                  onZonesChange={setFloodZones}
                  showChainageLayer={showChainageLayer}
                  showDepthLayer={showFloodDepthLayer}
                  focusChainage={focusChainage}
                />
              )}
              {landUseLayersOn && (
                <SoilLandUseMapOverlay
                  showExtentLayer={showUrbanVegLayer}
                  showSiltClassLayer={showSiltClassLayer}
                  showSiltVolumeLayer={showSiltVolumeLayer}
                  siltPeriodId={siltPeriodId}
                  onSiltPeriodChange={setSiltPeriodId}
                  showLulcLayer={showLulcLayer}
                  lulcPeriodId={lulcPeriodId}
                  onLulcPeriodChange={setLulcPeriodId}
                />
              )}
              {biodiversityLayersOn && (
                <BiodiversityMapOverlay
                  showTypeLayer={showBiodiversityTypeLayer}
                  showHealthLayer={showBiodiversityHealthLayer}
                />
              )}
              {climateLayersOn && (
                <ClimateImpactMapOverlay
                  periodId={climatePeriodId}
                  onPeriodChange={setClimatePeriodId}
                />
              )}
              {geologyLayersOn && (
                <GeologyMapOverlay
                  onOpenBathymetry={() => {
                    setShowBathy(true)
                    setShowFlood(false)
                    setShowBodCod(false)
                    setShowAnalysis(false)
                    setShowBodCodOverlay(false)
                    setShowAqiOverlay(false)
                    setShowFloodOverlay(false)
                    setShowGeologyOverlay(false)
                  }}
                />
              )}
              {showAqiOverlay && (
                <AqiMapOverlay
                  aqiData={aqiData}
                  chartData={aqiChartData}
                  loading={loading}
                  selectedHeight={selectedHeight}
                  showChainageLayer={showChainageLayer}
                  focusChainage={focusChainage}
                />
              )}
              <MapComponent 
                mapLayer={mapLayer}
                drawnGeometry={drawnGeometry}
                uploadedKML={uploadedKML}
                isDrawing={isDrawing}
                onGeometryComplete={handleGeometryComplete}
                onCancelDrawing={handleCancelDrawing}
                showTssLayer={showTssLayer}
                showNdciLayer={showNdciLayer}
                showNdwiLayer={showNdwiLayer}
                showWstLayer={showWstLayer}
                showDepthLayer={showFloodDepthLayer || showBathyMapLayer}
                showUrbanVegLayer={showUrbanVegLayer}
                showSiltClassLayer={showSiltClassLayer}
                showSiltVolumeLayer={showSiltVolumeLayer}
                siltPeriodId={siltPeriodId}
                showLulcLayer={showLulcLayer}
                lulcPeriodId={lulcPeriodId}
                showBiodiversityTypeLayer={showBiodiversityTypeLayer}
                showBiodiversityHealthLayer={showBiodiversityHealthLayer}
                showClimateFloodHeat={showClimateFloodHeat}
                showClimateWaterHeat={showClimateWaterHeat}
                climatePeriodId={climatePeriodId}
                showTributaryLayer={showTributaryLayer}
                showMainStemLayer={showMainStemLayer}
                showErosionLayer={showErosionLayer}
                showLithologyLayer={showLithologyLayer}
                showWrdFloodlines={showWrdFloodlines}
                showGarbageLayer={showGarbageLayer}
                showNdsiSalinityLayer={showNdsiSalinityLayer}
                showChainageLayer={
                  (uploadedKML?.displayName === 'Mula-Mutha River' ||
                    uploadedKML?.name?.toLowerCase().includes('mula-mutha')) &&
                  showChainageLayer
                }
                floodZones={showFloodDepthLayer ? floodZones : null}
                focusChainage={focusChainage}
                onSelectChainage={(station) => setFocusChainage({ ...station, at: Date.now() })}
              />
              {(uploadedKML?.displayName === 'Mula-Mutha River' ||
                uploadedKML?.name?.toLowerCase().includes('mula-mutha')) &&
                showChainageLayer && (
                  <ChainageScrubber
                    variant={
                      showFloodDepthLayer || (waterQualityLayersOn && showBodCodOverlay) || showAqiOverlay
                        ? 'above-ribbon'
                        : 'map-edge'
                    }
                    activeName={focusChainage?.name}
                    onSelect={(station) => setFocusChainage({ ...station, at: Date.now() })}
                  />
                )}
            </div>
            </LayerPanelSlotProvider>
          ) : (
            <div className="analysis-content">
              <button
                type="button"
                className="analysis-back-button"
                onClick={() => {
                  setShowAnalysis(false)
                  setShowBodCod(false)
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>Back to Map</span>
              </button>
              <div className="date-navigation-header">
                <button 
                  className="nav-arrow-button"
                  onClick={handlePreviousDate}
                  disabled={!canGoPrevious() || viewMode !== 'live'}
                  title="Previous Date"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                
                <div className="current-date-display">
                  <div className="date-label">Viewing Date</div>
                  <div className="date-value">
                    {viewMode === 'live' && currentViewDate 
                      ? format(new Date(currentViewDate), 'MMM dd, yyyy') 
                      : viewMode === 'daily' 
                        ? 'Last 24 Hours'
                        : viewMode === 'weekly'
                          ? 'Past 7 Days'
                          : viewMode === 'monthly'
                            ? 'Past 30 Days'
                            : 'N/A'}
                  </div>
                </div>
                
                <button 
                  className="nav-arrow-button"
                  onClick={handleNextDate}
                  disabled={!canGoNext() || viewMode !== 'live'}
                  title="Next Date"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>

              {/* View Mode Buttons */}
              <div className="view-mode-buttons">
                <button
                  className={`view-mode-button ${viewMode === 'live' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('live')}
                  disabled={loading}
                >
                  Live
                </button>
                <button
                  className={`view-mode-button ${viewMode === 'daily' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('daily')}
                  disabled={loading}
                >
                  Last 24 Hrs
                </button>
                <button
                  className={`view-mode-button ${viewMode === 'weekly' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('weekly')}
                  disabled={loading}
                >
                  Weekly
                </button>
                <button
                  className={`view-mode-button ${viewMode === 'monthly' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('monthly')}
                  disabled={loading}
                >
                  Monthly
                </button>
              </div>

              {error && (
                <div className="error-banner">
                  <p>Error: {error}</p>
                </div>
              )}

              {viewMode === 'live' ? (
                <LiveDashboardCards 
                  aqiData={aqiData}
                  weatherData={weatherData}
                  geometry={drawnGeometry || (uploadedKML ? parseKMLToGeometry(uploadedKML.content) : null)}
                  date={format(new Date(), 'yyyy-MM-dd')}
                  selectedHeight={selectedHeight}
                />
              ) : (
                <div className="analysis-sections">
                  <WeatherSection 
                    geometry={drawnGeometry || (uploadedKML ? parseKMLToGeometry(uploadedKML.content) : null)}
                    startDate={startDate}
                    endDate={endDate}
                    date={currentViewDate} 
                    data={weatherData}
                    isLive={viewMode === 'live'}
                    loading={loading}
                    viewMode={viewMode}
                    selectedHeight={selectedHeight}
                  />
                  <AQISection
                    geometry={drawnGeometry || (uploadedKML ? parseKMLToGeometry(uploadedKML.content) : null)}
                    startDate={startDate}
                    endDate={endDate} 
                    date={currentViewDate} 
                    data={aqiData}
                    isLive={viewMode === 'live'}
                    loading={loading}
                    viewMode={viewMode}
                    selectedHeight={selectedHeight}
                  />
                </div>
              )}

              {viewMode !== 'live' && (
                <>
                {/* AQI Chart */}
                <div className="aqi-chart-container">
                  <div className="chart-header">
                    <h3 className="chart-title">AQI Trend</h3>
                    <div className="chart-header-right">
                      <div className="chart-mode-indicator">
                        {viewMode === 'live' && <span>Last 1 Hour</span>}
                        {viewMode === 'daily' && <span>Last 24 Hours</span>}
                        {viewMode === 'weekly' && <span>Last 7 Days</span>}
                        {viewMode === 'monthly' && <span>Last 30 Days</span>}
                      </div>
                      <button 
                        className="chart-refresh-button"
                        onClick={handleRefreshAQIChart}
                        disabled={loadingChart || !showAnalysis}
                        title="Refresh AQI Trend Chart"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                          <path d="M21 3v5h-5"></path>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                          <path d="M3 21v-5h5"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {loadingChart ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p className="loading-message">Please wait, data is loading...</p>
                    </div>
                  ) : aqiChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart 
                        data={aqiChartData} 
                        margin={{ top: 10, right: 30, left: 0, bottom: viewMode === 'weekly' ? 60 : 40 }}
                      >
                        {/* AQI Category Background Sections - Render before grid so they appear behind */}
                        {/* Good: 0-50 (Green) */}
                        <ReferenceArea 
                          y1={0} 
                          y2={50} 
                          fill="#1c8a55" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        {/* Moderate: 51-100 (Orange) */}
                        <ReferenceArea 
                          y1={50} 
                          y2={100} 
                          fill="#96700a" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        {/* Poor: 101-150 (Dark Orange/Brown) */}
                        <ReferenceArea 
                          y1={100} 
                          y2={150} 
                          fill="#b3560f" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        {/* Unhealthy: 151-200 (Red) */}
                        <ReferenceArea 
                          y1={150} 
                          y2={200} 
                          fill="#c2372a" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        {/* Severe: 201-300 (Purple) */}
                        <ReferenceArea 
                          y1={200} 
                          y2={300} 
                          fill="#6d28d9" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        {/* Hazardous: 301+ (Dark Red) */}
                        <ReferenceArea 
                          y1={300} 
                          y2={400} 
                          fill="#7f1d1d" 
                          fillOpacity={0.2}
                          stroke="none"
                        />
                        
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 37, 64, 0.12)" />
                        
                        <XAxis 
                          dataKey="time" 
                          stroke="#6b8798"
                          style={{ fontSize: '11px' }}
                          angle={viewMode === 'weekly' ? -45 : viewMode === 'monthly' ? -45 : 0}
                          textAnchor={viewMode === 'weekly' ? 'end' : viewMode === 'monthly' ? 'end' : 'middle'}
                          height={viewMode === 'weekly' ? 70 : viewMode === 'monthly' ? 60 : 40}
                          interval={viewMode === 'live' ? 4 : viewMode === 'daily' ? 2 : viewMode === 'weekly' ? 0 : viewMode === 'monthly' ? 2 : 0}
                        />
                        <YAxis 
                          stroke="#6b8798"
                          style={{ fontSize: '12px' }}
                          label={{ value: 'AQI', angle: -90, position: 'insideLeft', style: { fill: '#6b8798' } }}
                          domain={[0, 400]}
                          ticks={[0, 50, 100, 150, 200, 300, 400]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            border: '1px solid #d5e3ee',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(15, 37, 64, 0.12)',
                            color: '#0d2436'
                          }}
                          labelStyle={{ color: '#0d4d88', fontWeight: 'bold' }}
                          formatter={(value) => [`AQI: ${value}`, '']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="aqi" 
                          stroke="#0d4d88"
                          strokeWidth={2.4}
                          dot={{ r: 4, fill: '#0d4d88', stroke: '#ffffff', strokeWidth: 1.5 }}
                          activeDot={{ r: 6, fill: '#0d4d88', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-no-data">
                      <p>No chart data available</p>
                    </div>
                  )}
                </div>

                {/* Time Chart */}
                {/* <div className="aqi-chart-container">
                  <div className="chart-header">
                    <h3 className="chart-title">Time Chart</h3>
                    <div className="chart-header-right">
                      <div className="chart-mode-indicator">
                        {viewMode === 'live' && <span>Last 1 Hour</span>}
                        {viewMode === 'daily' && <span>Last 24 Hours</span>}
                        {viewMode === 'weekly' && <span>Last 7 Days</span>}
                        {viewMode === 'monthly' && <span>Last 30 Days</span>}
                      </div>
                      <button 
                        className="chart-refresh-button"
                        onClick={handleRefreshTimeChart}
                        disabled={loadingTimeChart || !showAnalysis}
                        title="Refresh Time Chart"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                          <path d="M21 3v5h-5"></path>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                          <path d="M3 21v-5h5"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  
                  {loadingTimeChart ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p className="loading-message">Please wait, data is loading...</p>
                    </div>
                  ) : timeChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart 
                        data={timeChartData} 
                        margin={{ top: 10, right: 30, left: 0, bottom: viewMode === 'weekly' ? 60 : 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(20, 184, 166, 0.2)" />
                        <XAxis 
                          type="category"
                          dataKey="day" 
                          stroke="#9ca3af"
                          style={{ fontSize: '11px' }}
                          angle={viewMode === 'weekly' ? -45 : viewMode === 'monthly' ? -45 : 0}
                          textAnchor={viewMode === 'weekly' ? 'end' : viewMode === 'monthly' ? 'end' : 'middle'}
                          height={viewMode === 'weekly' ? 70 : viewMode === 'monthly' ? 60 : 40}
                          interval={viewMode === 'live' ? 4 : viewMode === 'daily' ? 2 : viewMode === 'weekly' ? 0 : viewMode === 'monthly' ? 2 : 0}
                          label={{ 
                            value: viewMode === 'live' ? 'Minutes' : viewMode === 'daily' ? 'Hours' : viewMode === 'weekly' ? 'Days' : viewMode === 'monthly' ? 'Days' : 'Hours', 
                            position: 'insideBottom', 
                            offset: -5, 
                            style: { fill: '#9ca3af' } 
                          }}
                        />
                        <YAxis 
                          type="number"
                          dataKey="aqi"
                          stroke="#9ca3af"
                          style={{ fontSize: '12px' }}
                          label={{ 
                            value: 'AQI', 
                            angle: -90, 
                            position: 'insideLeft', 
                            style: { fill: '#9ca3af' } 
                          }}
                          domain={[0, 400]}
                          ticks={[0, 50, 100, 150, 200, 300, 400]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(26, 31, 58, 0.95)', 
                            border: '1px solid rgba(20, 184, 166, 0.4)',
                            borderRadius: '8px',
                            color: '#ffffff'
                          }}
                          labelStyle={{ color: '#14b8a6', fontWeight: 'bold' }}
                          formatter={(value) => [`AQI: ${value}`, '']}
                          labelFormatter={(label) => {
                            if (viewMode === 'live') return `Minute: ${label}`
                            if (viewMode === 'daily') return `Hour: ${label}`
                            if (viewMode === 'weekly') return `Day: ${label}`
                            if (viewMode === 'monthly') return `Day: ${label}`
                            return `Day: ${label}`
                          }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              let labelText = ''
                              if (viewMode === 'live') {
                                labelText = `Minute: ${label}`
                              } else if (viewMode === 'daily') {
                                labelText = `Hour: ${label}`
                              } else if (viewMode === 'weekly' || viewMode === 'monthly') {
                                labelText = `Day: ${label}`
                              } else {
                                labelText = `Day: ${label}`
                              }
                              
                              return (
                                <div style={{
                                  backgroundColor: 'rgba(26, 31, 58, 0.95)',
                                  border: '1px solid rgba(20, 184, 166, 0.4)',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  color: '#ffffff'
                                }}>
                                  <p style={{ margin: '4px 0', color: '#14b8a6' }}>AQI: {data.aqi}</p>
                                  <p style={{ margin: '4px 0' }}>Time: {data.time}</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar 
                          dataKey="aqi"
                          radius={[4, 4, 0, 0]}
                        >
                          {timeChartData.map((entry, index) => {
                            const getAQIColor = (aqi) => {
                              if (aqi <= 50) return '#10b981' // Green - Excellent
                              if (aqi <= 100) return '#f59e0b' // Orange - Good
                              if (aqi <= 150) return '#f97316' // Orange - Fair
                              if (aqi <= 200) return '#ef4444' // Red - Poor
                              if (aqi <= 300) return '#8b5cf6' // Purple - Very Poor
                              return '#7f1d1d' // Dark Red - Hazardous
                            }
                            return (
                              <Cell key={`cell-${index}`} fill={getAQIColor(entry.aqi || 0)} />
                            )
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-no-data">
                      <p>No time chart data available</p>
                    </div>
                  )}
                </div> */}
                </>
              )}
            </div>
          )}
        </main>
      </div>
      <button
        type="button"
        className="app-fullscreen-button"
        onClick={toggleAppFullscreen}
        title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
        aria-pressed={isFullscreen}
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v3H5M16 3v3h3M8 21v-3H5M16 21v-3h3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5v3M16 3h3v3M8 21H5v-3M16 21h3v-3" />
          </svg>
        )}
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </button>
    </div>
  )
}

export default Dashboard

