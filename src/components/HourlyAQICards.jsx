import React, { useState, useEffect } from 'react'
import { format, parseISO, subHours, startOfHour } from 'date-fns'
import { fetchHourlyAQIData, fetchHourlyAQIDataRange, calculateGeometryCenter } from '../services/api'
import { transformRecordsByHeight } from '../utils/dataTransformers'
import './HourlyAQICards.css'

const HourlyAQICards = ({ geometry, date, selectedHeight }) => {
  const [hourlyData, setHourlyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coordinates, setCoordinates] = useState(null)

  useEffect(() => {
    if (geometry) {
      const center = calculateGeometryCenter(geometry)
      if (center) {
        setCoordinates(center)
      }
    }
  }, [geometry])

  useEffect(() => {
    if (coordinates) {
      fetchHourlyAQIDataForLast24Hours()
    }
  }, [coordinates, selectedHeight])

  const fetchHourlyAQIDataForLast24Hours = async () => {
    if (!coordinates) return

    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      const currentHour = startOfHour(now)
      const twentyFourHoursAgo = subHours(currentHour, 24)
      
      // Calculate date range (might span two days)
      const today = format(now, 'yyyy-MM-dd')
      const yesterday = format(twentyFourHoursAgo, 'yyyy-MM-dd')
      
      // Fetch data for both today and yesterday to cover the 24-hour period
      let allRecords = []
      
      try {
        // Try using range API first
        const rangeResponse = await fetchHourlyAQIDataRange(
          coordinates.latitude, 
          coordinates.longitude, 
          yesterday, 
          today
        )
        allRecords = rangeResponse.hourly_records || []
      } catch (rangeError) {
        // Fallback: fetch both days separately
        const [todayData, yesterdayData] = await Promise.all([
          fetchHourlyAQIData(coordinates.latitude, coordinates.longitude, today).catch(() => ({ hourly_records: [] })),
          fetchHourlyAQIData(coordinates.latitude, coordinates.longitude, yesterday).catch(() => ({ hourly_records: [] }))
        ])
        allRecords = [
          ...(todayData.hourly_records || []),
          ...(yesterdayData.hourly_records || [])
        ]
      }
      
      // Transform records based on selected height
      const transformedRecords = transformRecordsByHeight(allRecords, selectedHeight)
      
      // Filter records to only include those in the last 24 hours
      const filteredRecords = transformedRecords.filter(record => {
        if (!record || !record.date || record.aqi === null || record.aqi === undefined) return false
        try {
          const recordDate = parseISO(record.date)
          return recordDate >= twentyFourHoursAgo && recordDate <= currentHour
        } catch (e) {
          return false
        }
      })
      
      // Create 24 hour slots representing the previous 24 hours
      // Slot 0 = 24 hours ago, Slot 23 = 1 hour ago (current hour)
      const hourlySlots = Array.from({ length: 24 }, (_, i) => {
        const slotTime = subHours(currentHour, 23 - i)
        return {
          hour: i,
          hourLabel: format(slotTime, 'HH:mm'),
          dateTime: slotTime,
          aqi: null,
          records: []
        }
      })

      // Map records to their respective hour slots
      filteredRecords.forEach(record => {
        try {
          const recordDate = parseISO(record.date)
          const recordHour = startOfHour(recordDate)
          
          // Find the matching slot (within the same hour)
          const slotIndex = hourlySlots.findIndex(slot => {
            const timeDiff = Math.abs(recordHour.getTime() - slot.dateTime.getTime())
            return timeDiff < 3600000 // Within 1 hour (3600000 ms)
          })
          
          if (slotIndex >= 0) {
            hourlySlots[slotIndex].records.push(record)
          }
        } catch (e) {
          console.warn('Error parsing record date:', record.date, e)
        }
      })

      // For each hour slot, calculate average AQI
      hourlySlots.forEach(slot => {
        if (slot.records.length > 0) {
          const validAqis = slot.records
            .map(r => r.aqi)
            .filter(aqi => aqi !== null && aqi !== undefined)
          
          if (validAqis.length > 0) {
            const avgAqi = validAqis.reduce((sum, aqi) => sum + aqi, 0) / validAqis.length
            slot.aqi = Math.round(avgAqi)
          }
        }
      })

      setHourlyData(hourlySlots)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching hourly AQI data:', err)
    } finally {
      setLoading(false)
    }
  }

  // AQI category colours keep their green → yellow → orange → red → purple
  // meaning, darkened for legibility with a soft tint behind them on white.
  const getAQICategory = (aqi) => {
    if (!aqi || aqi === null) return { label: 'N/A', color: '#b8cfe0', bgColor: '#f4f9fc' }
    if (aqi <= 50) return { label: 'Good', color: '#1c8a55', bgColor: '#e0f4ea' }
    if (aqi <= 100) return { label: 'Moderate', color: '#96700a', bgColor: '#fbf1d6' }
    if (aqi <= 150) return { label: 'Poor', color: '#b3560f', bgColor: '#fdeddc' }
    if (aqi <= 200) return { label: 'Unhealthy', color: '#c2372a', bgColor: '#fbe5e2' }
    if (aqi <= 300) return { label: 'Severe', color: '#6d28d9', bgColor: '#ede7fb' }
    return { label: 'Hazardous', color: '#7f1d1d', bgColor: '#f6e2e0' }
  }

  if (loading) {
    return (
      <div className="hourly-aqi-cards-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading hourly AQI data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hourly-aqi-cards-container">
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hourly-aqi-cards-container">
      <div className="hourly-aqi-header">
        <h2 className="hourly-aqi-title">Last 24 Hours AQI</h2>
        <p className="hourly-aqi-subtitle">Air Quality Index for the previous 24 hours from current time</p>
      </div>
      <div className="hourly-aqi-cards-grid">
        {hourlyData.map((slot, index) => {
          const category = getAQICategory(slot.aqi)
          return (
            <div 
              key={index} 
              className="hourly-aqi-card"
              style={{ 
                borderColor: category.color,
                backgroundColor: slot.aqi !== null ? category.bgColor : '#f4f9fc'
              }}
            >
              <div className="hourly-aqi-card-header">
                <span className="hour-label">{slot.hourLabel}</span>
              </div>
              <div className="hourly-aqi-card-content">
                {slot.aqi !== null ? (
                  <>
                    <div className="aqi-value" style={{ color: category.color }}>
                      {slot.aqi}
                    </div>
                    <div className="aqi-category" style={{ color: category.color }}>
                      {category.label}
                    </div>
                  </>
                ) : (
                  <div className="aqi-no-data">No Data</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HourlyAQICards

