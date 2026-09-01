import React, { useEffect, useMemo, useState } from 'react'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import './TimeSeriesBar.css'

const SERIES = {
  silt: {
    title: 'Month',
    url: '/asset/mula-mutha-silt.json',
    name: 'Silt',
    toOptions: (doc) =>
      (doc?.periods || []).map((row) => ({
        id: row.id,
        label: shortMonth(row.label || row.month),
      })),
  },
  lulc: {
    title: 'Year',
    url: '/asset/mula-mutha-lulc.json',
    name: 'LULC',
    toOptions: (doc) =>
      (doc?.periods || []).map((row) => ({
        id: row.id,
        label: String(row.year ?? row.label ?? row.id),
      })),
  },
  climate: {
    title: 'Period',
    url: '/asset/mula-mutha-flood-water.json',
    name: 'Flood water',
    toOptions: (doc) =>
      (doc?.periods || []).map((row) => ({
        id: row.id,
        label: shortPair(row.pre_date, row.post_date),
      })),
  },
  twin: {
    title: 'Lead',
    url: null,
    name: 'Twin',
    staticOptions: [
      { id: 6, label: '6 h' },
      { id: 24, label: '24 h' },
      { id: 48, label: '48 h' },
      { id: 72, label: '72 h' },
    ],
  },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortMonth(value) {
  if (!value) return '—'
  // "Jan 2026" or "2026-01"
  const named = String(value).match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)
  if (named) return named[1].slice(0, 3)
  const iso = String(value).match(/^(\d{4})-(\d{2})/)
  if (iso) return MONTHS[Number(iso[2]) - 1] || value
  return String(value)
}

function shortPair(pre, post) {
  const fmt = (d) => {
    if (!d) return ''
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return d
    return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`
  }
  const a = fmt(pre)
  const b = fmt(post)
  if (!a || !b) return a || b || '—'
  return `${a}–${b}`
}

/**
 * Top-of-map period chips. Only renders when an active layer has a time series.
 * Shows Jan/Feb/… or 2021/2022/… depending on the layer.
 */
const TimeSeriesBar = ({
  seriesKey = null,
  periodId = null,
  onPeriodChange,
}) => {
  const config = seriesKey ? SERIES[seriesKey] : null
  const [options, setOptions] = useState(config?.staticOptions || [])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!config) {
      setOptions([])
      setLoadError(null)
      return undefined
    }
    if (config.staticOptions) {
      setOptions(config.staticOptions)
      setLoadError(null)
      return undefined
    }
    if (!config.url) return undefined

    let cancelled = false
    setLoadError(null)
    fetchAssetJson(config.url, config.name)
      .then((doc) => {
        if (cancelled) return
        setOptions(config.toOptions(doc))
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
        setOptions([])
        setLoadError('Unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [config])

  const activeId = useMemo(() => {
    if (periodId == null || !options.length) return options[0]?.id
    const match = options.find((row) => row.id === periodId)
    return match ? match.id : options[0]?.id
  }, [periodId, options])

  if (!config || (!options.length && !loadError)) return null

  return (
    <div className="time-series-bar" role="toolbar" aria-label={`${config.name} time span`}>
      <span className="time-series-bar-label">
        {config.name}
        <em>{config.title}</em>
      </span>
      <div className="time-series-bar-track">
        {loadError ? (
          <span className="time-series-empty">{loadError}</span>
        ) : (
          options.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`time-series-chip${row.id === activeId ? ' is-on' : ''}`}
              aria-pressed={row.id === activeId}
              title={row.label}
              onClick={() => onPeriodChange?.(row.id)}
            >
              {row.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default TimeSeriesBar
