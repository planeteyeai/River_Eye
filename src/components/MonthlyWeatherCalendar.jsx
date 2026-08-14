import React, { useState, useEffect, useRef } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, getMonth, getYear, startOfDay, subMonths, addMonths } from 'date-fns'
import { calculateGeometryCenter, fetchHourlyAQIData, fetchHourlyWeatherData } from '../services/api'
import { transformRecordsByHeight } from '../utils/dataTransformers'
import './MonthlyWeatherCalendar.css'

const MonthlyWeatherCalendar = ({ geometry, selectedDate, weeklyMode = false, startDate, endDate, selectedHeight }) => {
  const [monthlyData, setMonthlyData] = useState(null)
  const [aqiData, setAqiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coordinates, setCoordinates] = useState(null)
  const isFetchingRef = useRef(false)
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Track the currently displayed month

  useEffect(() => {
    if (geometry) {
      const center = calculateGeometryCenter(geometry)
      if (center) {
        setCoordinates(center)
      }
    }
  }, [geometry])

  // Initialize current month from selectedDate or use current date
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(parseISO(selectedDate))
    }
  }, [selectedDate])

  // Fetch data when weeklyMode is enabled and coordinates are available
  useEffect(() => {
    if (weeklyMode && coordinates && startDate && endDate) {
      console.log(`[USE EFFECT] fetchWeeklyData triggered for weekly mode`)
      fetchWeeklyData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyMode, coordinates, startDate, endDate])

  // Fetch data for monthly mode when coordinates and month are available
  useEffect(() => {
    if (!weeklyMode && coordinates && currentMonth) {
      console.log(`[USE EFFECT] fetchData triggered for: ${format(currentMonth, 'MMMM yyyy')}`)
      fetchData(currentMonth)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates, weeklyMode, currentMonth ? getMonth(currentMonth) : null, currentMonth ? getYear(currentMonth) : null])

  const fetchData = async (monthOverride) => {
    const targetMonth = monthOverride || currentMonth
    if (!coordinates || !targetMonth) {
      console.log('[FETCH DATA] Missing coordinates or currentMonth, returning early')
      return
    }

    // Prevent duplicate calls
    if (isFetchingRef.current) {
      console.log('[FETCH DATA] Already fetching, skipping')
      return
    }
    isFetchingRef.current = true

    const today = startOfDay(new Date())
    const monthStart = startOfMonth(targetMonth)
    const monthEnd = endOfMonth(targetMonth)
    const monthLabel = format(targetMonth, 'MMMM yyyy')

    console.log(`[FETCH DATA] Starting day-by-day fetch for: ${monthLabel}`)
    setLoading(true)
    setError(null)

    // Clamp the end date to today so we never request future days
    const fetchEnd = monthEnd < today ? monthEnd : today

    // If the entire month is in the future, show a friendly message immediately
    if (monthStart > today) {
      setMonthlyData({ daily_records: [], summary: null })
      setAqiData(null)
      setError(`No data available for ${monthLabel} (future month).`)
      setLoading(false)
      isFetchingRef.current = false
      return
    }

    // If the month is older than 3 months, block it
    const monthsDiff =
      (targetMonth.getFullYear() - today.getFullYear()) * 12 +
      (targetMonth.getMonth() - today.getMonth())
    if (monthsDiff < -2) {
      setMonthlyData({ daily_records: [], summary: null })
      setAqiData(null)
      setError(`No data available for ${monthLabel}. Only data for the last 3 months is available.`)
      setLoading(false)
      isFetchingRef.current = false
      return
    }

    try {
      const allDays = eachDayOfInterval({ start: monthStart, end: fetchEnd })
      console.log(`[FETCH DATA] Fetching ${allDays.length} days (${format(monthStart, 'yyyy-MM-dd')} → ${format(fetchEnd, 'yyyy-MM-dd')})`)

      // Fetch weather + AQI for every day in parallel
      const weatherPromises = allDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        return fetchHourlyWeatherData(coordinates.latitude, coordinates.longitude, dayStr)
          .then(result => ({ date: dayStr, data: result }))
          .catch(() => ({ date: dayStr, data: null }))
      })

      const aqiPromises = allDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        return fetchHourlyAQIData(coordinates.latitude, coordinates.longitude, dayStr)
          .then(result => ({ date: dayStr, data: result }))
          .catch(() => ({ date: dayStr, data: null }))
      })

      const [weatherResults, aqiResults] = await Promise.all([
        Promise.all(weatherPromises),
        Promise.all(aqiPromises),
      ])

      // Build daily_records from hourly weather data (same logic as fetchWeeklyData)
      const dailyRecords = weatherResults
        .map(({ date, data }) => {
          if (!data || !data.hourly_records || data.hourly_records.length === 0) return null
          const recs = data.hourly_records
          const temps = recs.map(r => r.temperature).filter(t => t != null)
          const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null
          const maxTemp = temps.length ? Math.max(...temps) : null
          const minTemp = temps.length ? Math.min(...temps) : null
          const humidities = recs.map(r => r.humidity).filter(h => h != null)
          const avgHumidity = humidities.length ? humidities.reduce((a, b) => a + b, 0) / humidities.length : null
          const winds = recs.map(r => r.wind_speed).filter(w => w != null)
          const avgWind = winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : null

          // Pick the most common icon from the hourly records
          const iconCounts = {}
          recs.forEach(r => { if (r.icon) iconCounts[r.icon] = (iconCounts[r.icon] || 0) + 1 })
          const icon = Object.keys(iconCounts).sort((a, b) => iconCounts[b] - iconCounts[a])[0] || null

          return {
            date,
            temperature: avgTemp,
            temperature_max: maxTemp,
            temperature_min: minTemp,
            humidity: avgHumidity,
            wind_speed: avgWind,
            icon,
          }
        })
        .filter(r => r !== null)

      setMonthlyData({ daily_records: dailyRecords, summary: null })
      console.log(`[FETCH DATA] Built ${dailyRecords.length} daily weather records`)

      // Build dailyMaxAQI map
      const dailyMaxAQI = {}
      aqiResults.forEach(({ date, data }) => {
        if (!data || !data.hourly_records) return
        const records = transformRecordsByHeight(data.hourly_records, selectedHeight)
        records.forEach(r => {
          if (r.aqi != null) {
            if (!dailyMaxAQI[date] || r.aqi > dailyMaxAQI[date]) {
              dailyMaxAQI[date] = r.aqi
            }
          }
        })
      })

      setAqiData(Object.keys(dailyMaxAQI).length > 0 ? dailyMaxAQI : null)
      console.log(`[FETCH DATA] AQI data for ${Object.keys(dailyMaxAQI).length} days`)

    } catch (err) {
      console.error('[FETCH DATA] Unexpected error:', err)
      setError(`Error loading data for ${monthLabel}: ${err.message}`)
      setMonthlyData({ daily_records: [] })
      setAqiData(null)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  // Fetch data for weekly mode (last 7 days)
  const fetchWeeklyData = async () => {
    if (!coordinates || !startDate || !endDate) {
      console.log('[FETCH WEEKLY DATA] Missing coordinates or date range, returning early')
      return
    }

    console.log(`[FETCH WEEKLY DATA] Starting fetchWeeklyData for: ${startDate} to ${endDate}`)
    setLoading(true)
    setError(null)

    try {
      // Fetch weather and AQI data for each day in the range
      const weekStart = parseISO(startDate)
      const weekEnd = parseISO(endDate)
      const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
      
      const weatherPromises = []
      const aqiPromises = []
      
      for (const dayDate of allDays) {
        const dayStr = format(dayDate, 'yyyy-MM-dd')
        weatherPromises.push(
          fetchHourlyWeatherData(coordinates.latitude, coordinates.longitude, dayStr)
            .then(result => ({ date: dayStr, data: result }))
            .catch(err => {
              console.warn(`Failed to fetch weather for ${dayStr}:`, err.message)
              return { date: dayStr, data: null }
            })
        )
        aqiPromises.push(
          fetchHourlyAQIData(coordinates.latitude, coordinates.longitude, dayStr)
            .then(result => ({ date: dayStr, data: result }))
            .catch(err => {
              console.warn(`Failed to fetch AQI for ${dayStr}:`, err.message)
              return { date: dayStr, data: null }
            })
        )
      }
      
      const [weatherResults, aqiResults] = await Promise.all([
        Promise.all(weatherPromises),
        Promise.all(aqiPromises)
      ])
      
      // Process weather data into daily records format
      const dailyRecords = weatherResults.map(({ date, data }) => {
        if (!data || !data.hourly_records || data.hourly_records.length === 0) {
          return null
        }
        
        const records = data.hourly_records
        // Calculate daily averages
        const avgTemp = records.reduce((sum, r) => sum + (r.temperature || 0), 0) / records.length
        const avgHumidity = records.reduce((sum, r) => sum + (r.humidity || 0), 0) / records.length
        const avgWindSpeed = records.reduce((sum, r) => sum + (r.wind_speed || 0), 0) / records.length
        const maxTemp = Math.max(...records.map(r => r.temperature || -Infinity).filter(t => t !== -Infinity))
        const minTemp = Math.min(...records.map(r => r.temperature || Infinity).filter(t => t !== Infinity))
        
        return {
          date,
          temperature: avgTemp,
          temperature_max: maxTemp,
          temperature_min: minTemp,
          humidity: avgHumidity,
          wind_speed: avgWindSpeed,
        }
      }).filter(r => r !== null)
      
      setMonthlyData({ daily_records: dailyRecords, summary: null })
      
      // Process AQI data
      const dailyMaxAQI = {}
      aqiResults.forEach(({ date, data }) => {
        if (data && data.hourly_records) {
          const maxAqi = Math.max(...data.hourly_records.map(r => r.aqi || 0).filter(aqi => aqi > 0))
          if (maxAqi > 0) {
            dailyMaxAQI[date] = maxAqi
          }
        }
      })
      setAqiData(dailyMaxAQI)
      
    } catch (err) {
      setError(`Error loading weekly data: ${err.message}`)
      console.error('Error fetching weekly weather data:', err)
      setMonthlyData({ daily_records: [] })
      setAqiData(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    const newYear = newMonth.getFullYear()
    const newMonthNum = newMonth.getMonth() + 1
    
    // Calculate months difference
    const monthsDiff = (newYear - todayYear) * 12 + (newMonthNum - todayMonth)
    
    // Only allow going back 2 months (current month = 0, -1 = 1 month ago, -2 = 2 months ago)
    if (monthsDiff >= -2) {
      setCurrentMonth(newMonth)
      // fetchData will be triggered automatically by the useEffect watching currentMonth
    } else {
      console.log(`[NAVIGATION] Cannot go back further than 3 months. MonthsDiff: ${monthsDiff}`)
    }
  }

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    const newYear = newMonth.getFullYear()
    const newMonthNum = newMonth.getMonth() + 1
    
    // Check if it's a future month
    const isFutureMonth = newYear > todayYear || 
                          (newYear === todayYear && newMonthNum > todayMonth)
    
    // Only allow going to current month or future (but future will show error)
    if (!isFutureMonth || (newYear === todayYear && newMonthNum === todayMonth)) {
      setCurrentMonth(newMonth)
      // fetchData will be triggered automatically by the useEffect watching currentMonth
    } else {
      console.log(`[NAVIGATION] Cannot go to future months beyond current month`)
    }
  }

  // Check if Previous button should be disabled (at 3-month limit)
  const canGoPrevious = () => {
    if (!currentMonth) return false
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    const selectedYear = currentMonth.getFullYear()
    const selectedMonth = currentMonth.getMonth() + 1
    
    const monthsDiff = (selectedYear - todayYear) * 12 + (selectedMonth - todayMonth)
    // Can go previous if monthsDiff > -2 (not at the 3-month limit yet)
    return monthsDiff > -2
  }

  // Check if Next button should be disabled (at current month)
  const canGoNext = () => {
    if (!currentMonth) return false
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    const selectedYear = currentMonth.getFullYear()
    const selectedMonth = currentMonth.getMonth() + 1
    
    // Can go next if not at current month yet
    return selectedYear < todayYear || 
           (selectedYear === todayYear && selectedMonth < todayMonth)
  }

  // Get AQI border/accent color based on value
  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#1c8a55' // Good - Green
    if (aqi <= 100) return '#b8860b' // Moderate - Amber
    if (aqi <= 150) return '#d2701a' // Poor - Orange
    if (aqi <= 200) return '#b02f22' // Unhealthy - Red
    if (aqi <= 300) return '#5d2c78' // Severe - Purple
    return '#6f1b12' // Hazardous - Dark Red
  }

  // Heat-cell fill: ramps from a pale tint up to a saturated dark tone
  const getAQIBgColor = (aqi) => {
    if (aqi <= 50) return '#e0f4ea' // Good
    if (aqi <= 100) return '#fbf1d6' // Moderate
    if (aqi <= 150) return '#fdeddc' // Poor
    if (aqi <= 200) return '#f2b8b1' // Unhealthy
    if (aqi <= 300) return '#7b3f9d' // Severe
    return '#96261a' // Hazardous
  }

  // Text colour for content sitting on a heat cell: dark ink on the pale end,
  // white only on the two darkest fills
  const getAQITextColor = (aqi) => {
    if (aqi <= 50) return '#0b5c37'
    if (aqi <= 100) return '#7a5405'
    if (aqi <= 150) return '#8a4409'
    if (aqi <= 200) return '#7d1a11'
    return '#ffffff'
  }

  const getWeatherIcon = (icon) => {
    switch (icon) {
      case 'sun':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="#f0a202" stroke="#8a5c05" strokeWidth="1.5"></circle>
            <line x1="12" y1="1" x2="12" y2="3" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="12" y1="21" x2="12" y2="23" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="1" y1="12" x2="3" y2="12" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="21" y1="12" x2="23" y2="12" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="#b3761a" strokeWidth="2" strokeLinecap="round"></line>
          </svg>
        )
      case 'partly-cloudy':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="10" cy="10" r="4" fill="#f0a202" stroke="#8a5c05" strokeWidth="1"></circle>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#dbe4ec" stroke="#3a5c73" strokeWidth="1.5"></path>
          </svg>
        )
      case 'rain':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#b8cfe0" stroke="#3a5c73" strokeWidth="1.5"></path>
            <line x1="8" y1="20" x2="8" y2="22" stroke="#1668b3" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="12" y1="20" x2="12" y2="22" stroke="#1668b3" strokeWidth="2" strokeLinecap="round"></line>
            <line x1="16" y1="20" x2="16" y2="22" stroke="#1668b3" strokeWidth="2" strokeLinecap="round"></line>
          </svg>
        )
      case 'snow':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#dcf0fb" stroke="#3a5c73" strokeWidth="1.5"></path>
            <circle cx="8" cy="20" r="1.5" fill="#1668b3"></circle>
            <circle cx="12" cy="20" r="1.5" fill="#1668b3"></circle>
            <circle cx="16" cy="20" r="1.5" fill="#1668b3"></circle>
            <path d="M7 19l2-2M11 19l2-2M15 19l2-2" stroke="#2f9bd6" strokeWidth="1.5" strokeLinecap="round"></path>
          </svg>
        )
      default:
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#c6d4e0" stroke="#3a5c73" strokeWidth="1.5"></path>
          </svg>
        )
    }
  }

  if (!coordinates) {
    return null
  }

  if (loading) {
    return (
      <div className="monthly-weather-calendar">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading monthly forecast...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="monthly-weather-calendar">
        <div className="error-message">
          <p>Error loading monthly forecast: {error}</p>
        </div>
      </div>
    )
  }

  // In weekly mode, handle empty data differently
  if (weeklyMode) {
    if (!monthlyData || !monthlyData.daily_records || monthlyData.daily_records.length === 0) {
      return (
        <div className="monthly-weather-calendar">
          <div className="calendar-header">
            <h2 className="calendar-title">Last 7 Days</h2>
          </div>
          <div className="loading-state">
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                <p>Loading weekly data...</p>
              </>
            ) : (
              <p>No data available for the selected week.</p>
            )}
          </div>
        </div>
      )
    }
  } else {
    if (!monthlyData) {
      return null
    }

    // Handle case where daily_records might be empty or undefined
    if (!monthlyData.daily_records || monthlyData.daily_records.length === 0) {
      return (
        <div className="monthly-weather-calendar">
          <div className="error-message">
            <p>No weather data available for {format(currentMonth, 'MMMM yyyy')}.</p>
          </div>
        </div>
      )
    }
  }

  // Weekly mode: only show last 7 days
  let allDays, firstDayOfWeek, monthName, calendarDays = []
  
  if (weeklyMode && startDate && endDate) {
    const weekStart = parseISO(startDate)
    const weekEnd = parseISO(endDate)
    allDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    firstDayOfWeek = weekStart.getDay()
    monthName = `Last 7 Days (${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')})`
    
    // Add empty cells for days before week starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push(null)
    }
  } else {
    // Normal monthly mode
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    firstDayOfWeek = monthStart.getDay()
    monthName = format(currentMonth, 'MMMM yyyy')
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push(null)
    }
  }
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  // Add all days of the month
  allDays.forEach(day => {
    // Normalize the day to start of day for consistent matching
    const normalizedDay = startOfDay(day)
    const dayStr = format(normalizedDay, 'yyyy-MM-dd')
    
    // Try to find record - check both exact match and normalized date
    let record = monthlyData.daily_records.find(r => {
      if (!r || !r.date) return false
      // Normalize the record date for comparison
      try {
        const recordDate = parseISO(r.date)
        const normalizedRecordDate = startOfDay(recordDate)
        const recordDateStr = format(normalizedRecordDate, 'yyyy-MM-dd')
        return recordDateStr === dayStr
      } catch (e) {
        // Fallback to string comparison
        return r.date === dayStr || r.date.startsWith(dayStr)
      }
    }) || null
    
    // Debug logging for last day (only in monthly mode)
    if (!weeklyMode) {
      const monthEnd = endOfMonth(currentMonth)
      if (day.getDate() === monthEnd.getDate() && day.getMonth() === monthEnd.getMonth()) {
        console.log(`[LAST DAY DEBUG] Day: ${dayStr}, Found record:`, record ? 'YES' : 'NO')
        console.log(`[LAST DAY DEBUG] Available dates in daily_records:`, monthlyData.daily_records.map(r => r.date).slice(-5))
      }
    }
    
    calendarDays.push({
      date: normalizedDay,
      record: record
    })
  })

  return (
    <div className="monthly-weather-calendar">
      <div className="calendar-header">
        {!weeklyMode && (
          <>
            <button 
              className={`month-nav-button prev ${!canGoPrevious() ? 'disabled' : ''}`} 
              onClick={handlePreviousMonth}
              disabled={!canGoPrevious()}
              title={!canGoPrevious() ? 'Only data for the last 3 months is available' : 'Previous Month'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Previous Month
            </button>
            <h2 className="calendar-title">{monthName}</h2>
            <button 
              className={`month-nav-button next ${!canGoNext() ? 'disabled' : ''}`} 
              onClick={handleNextMonth}
              disabled={!canGoNext()}
              title={!canGoNext() ? 'Already at current month' : 'Next Month'}
            >
              Next Month
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </>
        )}
        {weeklyMode && (
          <h2 className="calendar-title">{monthName}</h2>
        )}
      </div>
      
      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {weekDays.map(day => (
            <div key={day} className="weekday-header">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days">
          {calendarDays.map((dayData, index) => {
            // Render empty cells for days before month starts
            if (!dayData) {
              return <div key={`empty-${index}`} className="calendar-day empty"></div>
            }
            
            const { date: dayDate, record } = dayData
            const isTodayDate = isToday(dayDate)
            const dayStr = format(startOfDay(dayDate), 'yyyy-MM-dd')
            const dayAQI = aqiData && aqiData[dayStr] !== undefined ? aqiData[dayStr] : null
            
            // In weekly mode, only show days within the date range
            if (weeklyMode && startDate && endDate) {
              if (dayStr < startDate || dayStr > endDate) {
                return null
              }
            } else {
              // In monthly mode, only render if it's a valid day of the current month
              if (!isSameMonth(dayDate, currentMonth)) {
                return null
              }
            }
            
            // Get background color based on AQI
            const aqiBgColor = dayAQI !== null ? getAQIBgColor(dayAQI) : null
            const aqiColor = dayAQI !== null ? getAQIColor(dayAQI) : null
            const aqiTextColor = dayAQI !== null ? getAQITextColor(dayAQI) : null
            
            return (
              <div 
                key={format(dayDate, 'yyyy-MM-dd')} 
                className={`calendar-day ${isTodayDate ? 'today' : ''}`}
                style={aqiBgColor ? { backgroundColor: aqiBgColor, borderColor: aqiColor, color: aqiTextColor } : {}}
              >
                <div className="day-number">{dayDate.getDate()}</div>
                {dayAQI !== null && dayAQI !== undefined ? (
                  <div className="aqi-value" style={{ color: aqiTextColor, fontSize: '1rem' }}>
                    AQI: {Math.round(dayAQI)}
                  </div>
                ) : (
                  <div className="aqi-value" style={{ color: 'var(--rv-faint)', opacity: 0.9, fontSize: '1rem' }}>
                    AQI: -
                  </div>
                )}
                {record ? (
                  <>
                    <div className="weather-icon">
                      {getWeatherIcon(record.icon)}
                    </div>
                    <div className="temperatures">
                      <span className="temp-high">{record.temperature_max}°</span>
                      <span className="temp-low">/{record.temperature_min}°</span>
                    </div>
                  </>
                ) : (
                  <div className="no-data">no weather data</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      <div className="calendar-footer">
        {monthlyData.summary && (
          <div className="month-summary">
            <span className="summary-item sunny">{monthlyData.summary.sunny} Sunny</span>
            <span className="summary-item cloudy">{monthlyData.summary.cloudy} Cloudy</span>
            <span className="summary-item rainy">{monthlyData.summary.rainy} Rainy</span>
            <span className="summary-item snowy">{monthlyData.summary.snowy} Snowy</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default MonthlyWeatherCalendar

