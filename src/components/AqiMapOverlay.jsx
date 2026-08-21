import React, { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import { extractDataByHeight } from '../utils/dataTransformers'
import './AqiMapOverlay.css'
import ChainageLayerCard from './ChainageLayerCard'
import { LayerPanelPortal } from './LayerPanelSlots'

const INK_MUTED = '#6b8798'
const GRID_LINE = '#b8cfe0'
const SURFACE = '#ffffff'

const AQI_BANDS = [
  { from: 0, to: 50, label: 'Good', color: '#1c8a55' },
  { from: 50, to: 100, label: 'Moderate', color: '#b8860b' },
  { from: 100, to: 150, label: 'Poor', color: '#d2701a' },
  { from: 150, to: 200, label: 'Unhealthy', color: '#c2372a' },
  { from: 200, to: 300, label: 'Severe', color: '#6d28d9' },
  { from: 300, to: 500, label: 'Hazardous', color: '#7f1d1d' },
]

const POLLUTANTS = [
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', max: 75, color: '#c2372a' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', max: 150, color: '#b3761a' },
  { key: 'no2', label: 'NO₂', unit: 'µg/m³', max: 200, color: '#1668b3' },
  { key: 'so2', label: 'SO₂', unit: 'µg/m³', max: 125, color: '#6d28d9' },
  { key: 'o3', label: 'O₃', unit: 'µg/m³', max: 180, color: '#1c8a55' },
  { key: 'co', label: 'CO', unit: 'ppm', max: 10, color: '#c02a72' },
]

const SERIES = [
  { key: 'aqi', label: 'AQI', color: '#0e8f9c' },
  { key: 'pm25', label: 'PM2.5', color: '#c2372a' },
  { key: 'pm10', label: 'PM10', color: '#b3761a' },
]

const getAQICategory = (aqi) => {
  if (aqi == null) return { label: 'N/A', color: INK_MUTED, from: 0, to: 50 }
  return AQI_BANDS.find((band) => aqi <= band.to) || AQI_BANDS[AQI_BANDS.length - 1]
}

const formatValue = (value, digits = 1) => {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return Number.isInteger(num) ? String(num) : num.toFixed(digits)
}

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const arcPath = (cx, cy, r, start, end) => {
  const s = polar(cx, cy, r, start)
  const e = polar(cx, cy, r, end)
  const large = end - start <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

const AqiGauge = ({ aqi, category }) => {
  const cx = 88
  const cy = 86
  const r = 58
  const start = 210
  const sweep = 240
  const clamped = Math.max(0, Math.min(aqi ?? 0, 400))
  const needle = start + (clamped / 400) * sweep

  return (
    <svg className="aqi-gauge" viewBox="0 0 176 132" role="img" aria-label={`AQI ${aqi == null ? 'unavailable' : Math.round(aqi)}, ${category.label}`}>
      {AQI_BANDS.map((band) => {
        const from = start + (band.from / 400) * sweep
        const to = start + (Math.min(band.to, 400) / 400) * sweep
        return (
          <path
            key={band.label}
            d={arcPath(cx, cy, r, from, to)}
            fill="none"
            stroke={band.color}
            strokeWidth="11"
            strokeLinecap="butt"
            opacity="0.22"
          />
        )
      })}
      <path
        d={arcPath(cx, cy, r, start, needle)}
        fill="none"
        stroke={category.color}
        strokeWidth="11"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(15, 37, 64, 0.28))' }}
      />
      <circle cx={polar(cx, cy, r, needle).x} cy={polar(cx, cy, r, needle).y} r="5" fill={category.color} />
      <text x={cx} y={cy - 4} textAnchor="middle" className="aqi-gauge-value" fill={category.color}>
        {aqi == null ? '—' : Math.round(aqi)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="aqi-gauge-unit" fill={INK_MUTED}>
        AQI
      </text>
    </svg>
  )
}

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const cat = getAQICategory(point.aqi)
  return (
    <div className="aqi-chart-tooltip">
      <div className="aqi-chart-tooltip-kicker">{point.minute} min ago</div>
      <div className="aqi-chart-tooltip-aqi" style={{ color: cat.color }}>
        {Math.round(point.aqi)} <span>{cat.label}</span>
      </div>
      {point.pm25 != null && <div>PM2.5 · {formatValue(point.pm25)} µg/m³</div>}
      {point.pm10 != null && <div>PM10 · {formatValue(point.pm10)} µg/m³</div>}
    </div>
  )
}

const AqiMapOverlay = ({
  aqiData,
  chartData = [],
  loading = false,
  selectedHeight,
  showChainageLayer = false,
  focusChainage = null,
}) => {
  const [visible, setVisible] = useState({ aqi: true, pm25: true, pm10: false })
  const processed = aqiData ? extractDataByHeight(aqiData, selectedHeight) : null
  const aqi = processed?.aqi ?? null
  const category = getAQICategory(aqi)

  const pollutants = POLLUTANTS.map((item) => {
    const raw =
      item.key === 'pm25'
        ? processed?.pm2_5 ?? processed?.pm25
        : processed?.[item.key]
    return { ...item, value: raw == null ? null : Number(raw) }
  })

  const stats = useMemo(() => {
    const values = chartData.map((d) => Number(d.aqi)).filter((n) => Number.isFinite(n))
    if (!values.length) return null
    const sum = values.reduce((acc, n) => acc + n, 0)
    return {
      min: Math.round(Math.min(...values)),
      max: Math.round(Math.max(...values)),
      avg: Math.round(sum / values.length),
    }
  }, [chartData])

  const yMax = useMemo(() => {
    const keys = SERIES.filter((s) => visible[s.key]).map((s) => s.key)
    const nums = chartData.flatMap((d) => keys.map((k) => Number(d[k]))).filter((n) => Number.isFinite(n))
    const peak = nums.length ? Math.max(...nums, aqi || 0) : 100
    return Math.max(100, Math.ceil(peak / 25) * 25)
  }, [chartData, visible, aqi])

  const markerPct = aqi == null ? 0 : Math.min((aqi / 400) * 100, 100)

  const toggleSeries = (key) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (!next.aqi && !next.pm25 && !next.pm10) return prev
      return next
    })
  }

  return (
    <>
    <LayerPanelPortal viewId="aqi">
      <div className="aqi-embed panel-embed" aria-label="AQI detail">
        {showChainageLayer && (
          <ChainageLayerCard inputId="layer-aqi-chainage" focusChainage={focusChainage} />
        )}
      </div>
    </LayerPanelPortal>
    <div className="aqi-map-overlays">
      <aside className="aqi-map-metrics" aria-label="Air quality metrics">
        <div className="aqi-metrics-head">
          <h3>
            Air Quality
            <small>Live reading · selected area</small>
          </h3>
          <span className="aqi-live-pill">
            <span className="aqi-live-dot" />
            LIVE
          </span>
        </div>

        {loading && !processed ? (
          <div className="aqi-map-loading">Loading AQI…</div>
        ) : (
          <>
            <div className="aqi-gauge-wrap">
              <AqiGauge aqi={aqi} category={category} />
              <div className="aqi-gauge-status" style={{ color: category.color, borderColor: category.color }}>
                {category.label}
              </div>
            </div>

            <div className="aqi-pollutant-head">Pollutant mix</div>
            <div className="aqi-pollutant-bars">
              {pollutants.map((item) => {
                const pct = item.value == null ? 0 : Math.min((item.value / item.max) * 100, 100)
                return (
                  <div className="aqi-pollutant" key={item.key}>
                    <div className="aqi-pollutant-meta">
                      <span>{item.label}</span>
                      <strong>
                        {formatValue(item.value)} <em>{item.unit}</em>
                      </strong>
                    </div>
                    <div className="aqi-pollutant-track">
                      <div
                        className="aqi-pollutant-fill"
                        style={{ width: `${pct}%`, background: item.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </aside>

      <section className="aqi-map-ribbon" aria-label="AQI trend">
        <div className="aqi-ribbon-main">
          <div className="aqi-ribbon-head">
            <h2>60-minute trend</h2>
            <span className="aqi-ribbon-mode">FUSED LIVE HISTORY</span>
          </div>
          <div className="aqi-ribbon-hero">
            <div className="aqi-ribbon-num" style={{ color: category.color }}>
              {aqi == null ? '—' : Math.round(aqi)}
              <small>AQI</small>
            </div>
            <div className="aqi-ribbon-cat" style={{ color: category.color }}>
              {category.label}
            </div>
          </div>
          {stats && (
            <div className="aqi-stat-chips">
              <span><em>Min</em> {stats.min}</span>
              <span><em>Avg</em> {stats.avg}</span>
              <span><em>Max</em> {stats.max}</span>
            </div>
          )}
          <div className="aqi-scale" aria-hidden="true">
            {AQI_BANDS.slice(0, 5).map((band) => (
              <span key={band.label} style={{ background: band.color }} title={`${band.label} ${band.from}–${band.to}`} />
            ))}
            <i className="aqi-scale-marker" style={{ left: `${markerPct}%`, background: category.color }} />
          </div>
          <div className="aqi-series-toggles">
            {SERIES.map((series) => (
              <button
                key={series.key}
                type="button"
                className={visible[series.key] ? 'is-on' : ''}
                style={{ '--series': series.color }}
                onClick={() => toggleSeries(series.key)}
              >
                {series.label}
              </button>
            ))}
          </div>
        </div>

        <div className="aqi-ribbon-graph">
          {loading && chartData.length === 0 ? (
            <div className="aqi-map-loading">Loading trend…</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="aqiAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={category.color} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={category.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {AQI_BANDS.filter((band) => band.from < yMax).map((band) => (
                  <ReferenceArea
                    key={band.label}
                    y1={band.from}
                    y2={Math.min(band.to, yMax)}
                    fill={band.color}
                    fillOpacity={0.07}
                    stroke="none"
                  />
                ))}
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={INK_MUTED}
                  tick={{ fontSize: 10, fill: INK_MUTED, fontFamily: 'var(--rv-font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_LINE }}
                  tickFormatter={(value) => `${value}m`}
                />
                <YAxis
                  stroke={INK_MUTED}
                  tick={{ fontSize: 10, fill: INK_MUTED, fontFamily: 'var(--rv-font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  domain={[0, yMax]}
                />
                <Tooltip content={ChartTooltip} cursor={{ stroke: 'rgba(14,143,156,0.45)' }} />
                {visible.aqi && (
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    stroke="#0e8f9c"
                    strokeWidth={2.4}
                    fill="url(#aqiAreaFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#0e8f9c', stroke: SURFACE, strokeWidth: 2 }}
                  />
                )}
                {visible.pm25 && (
                  <Line type="monotone" dataKey="pm25" stroke="#c2372a" strokeWidth={1.8} dot={false} />
                )}
                {visible.pm10 && (
                  <Line type="monotone" dataKey="pm10" stroke="#b3761a" strokeWidth={1.8} dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="aqi-map-loading">No trend data yet</div>
          )}
        </div>
      </section>
    </div>
    </>
  )
}

export default AqiMapOverlay
