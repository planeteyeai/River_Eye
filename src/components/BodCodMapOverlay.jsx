import React, { useEffect, useMemo, useState } from 'react'
import './BodCodMapOverlay.css'
import ChainageLayerCard from './ChainageLayerCard'
import { LayerPanelPortal } from './LayerPanelSlots'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import {
  chainageFromRibbonKm,
  formatChainage,
  reachForRibbonKm,
  ribbonKmFromChainage,
  stationsFromChainageGeojson,
} from '../lib/chainageBins'

const CLS = ['A', 'B', 'C', 'D', 'E']

const OBSERVED = '#0e8f9c'
const FORECAST = '#b3761a'
const SELECT = '#1668b3'
const INK = '#0d2436'
const INK_2 = '#3a5c73'
const INK_MUTED = '#6b8798'
const GRID_LINE = '#b8cfe0'
const SURFACE = '#ffffff'
const MONO = { fontFamily: 'var(--rv-font-mono)' }
const DISPLAY = { fontFamily: 'var(--rv-font-display)' }

const formatMetric = (value) => {
  if (value == null) return '—'
  if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2)
  return value
}

const formatSkill = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`

const LIGHT_CLASS_COLORS = {
  A: '#1668b3',
  B: '#1c8a55',
  C: '#b8860b',
  D: '#d2701a',
  E: '#c2372a',
  NA: '#6b8798',
}

const timelineLabel = (value) => {
  if (!value) return ''
  const text = String(value)
  if (text.includes('T') || text.includes(':')) return text.replace('T', ' ').slice(0, 16)
  return text
}

const dayKey = (value) => String(value || '').slice(0, 10)

const pickChartIndexes = (length, todayIdx, scrubIdx, isHourly) => {
  if (!isHourly || length <= 220) return Array.from({ length }, (_, index) => index)
  const picked = new Set()
  for (let index = 0; index < length; index += 12) picked.add(index)
  picked.add(Math.max(0, length - 1))
  picked.add(Math.min(Math.max(0, todayIdx), length - 1))
  if (Number.isFinite(scrubIdx)) picked.add(Math.min(Math.max(0, scrubIdx), length - 1))
  return [...picked].sort((a, b) => a - b)
}

const classBands = (edges, colors) => {
  const caps = [...edges, Math.max(edges[edges.length - 1] + 6, 16)]
  let from = 0
  return CLS.map((cls, index) => {
    const band = { from, to: caps[index], label: cls, color: colors[cls] }
    from = caps[index]
    return band
  })
}

const ReachHistoryChart = ({ reach, edges, colors, todayIdx, scrubIdx = todayIdx, isHourly = false }) => {
  const width = 560
  const height = 168
  const left = 38
  const right = 12
  const top = 16
  const bottom = 22
  const rawP50 = reach.history.p50.concat(reach.forecast.p50)
  const rawP10 = reach.history.p10.concat(reach.forecast.p10)
  const rawP90 = reach.history.p90.concat(reach.forecast.p90)
  const hasCod = Boolean(reach.history.cod_p50 && reach.forecast.cod_p50)
  const rawCod = hasCod ? reach.history.cod_p50.concat(reach.forecast.cod_p50) : null
  const sourceIndexes = pickChartIndexes(rawP50.length, todayIdx, scrubIdx, isHourly)
  const p50 = sourceIndexes.map((index) => rawP50[index])
  const p10 = sourceIndexes.map((index) => rawP10[index])
  const p90 = sourceIndexes.map((index) => rawP90[index])
  const cod50 = rawCod ? sourceIndexes.map((index) => rawCod[index]) : null
  const n = p50.length
  const chartToday = sourceIndexes.findIndex((index) => index === todayIdx)
  const chartScrub = sourceIndexes.findIndex((index) => index === scrubIdx)
  const ymax = Math.max(...p90, ...(cod50 || []), edges[2], 6) * 1.12
  const xOf = (index) => left + (index / Math.max(n - 1, 1)) * (width - left - right)
  const yOf = (value) => top + (1 - value / ymax) * (height - top - bottom)
  const bands = classBands(edges, colors)

  let band = `M${xOf(0)} ${yOf(p90[0])}`
  for (let i = 1; i < n; i += 1) band += ` L${xOf(i)} ${yOf(p90[i])}`
  for (let i = n - 1; i >= 0; i -= 1) band += ` L${xOf(i)} ${yOf(p10[i])}`
  band += ' Z'

  const linePath = (series, from, to) => {
    let d = `M${xOf(from)} ${yOf(series[from])}`
    for (let i = from + 1; i <= to; i += 1) d += ` L${xOf(i)} ${yOf(series[i])}`
    return d
  }

  const areaUnder = (from, to) => {
    let d = `M${xOf(from)} ${yOf(0)} L${xOf(from)} ${yOf(p50[from])}`
    for (let i = from + 1; i <= to; i += 1) d += ` L${xOf(i)} ${yOf(p50[i])}`
    d += ` L${xOf(to)} ${yOf(0)} Z`
    return d
  }

  const yTicks = [0, Math.round(ymax / 2), Math.round(ymax)]
  const split = chartToday >= 0 ? chartToday : n - 1

  return (
    <svg className="bod-cod-reach-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="BOD fused history chart">
      <defs>
        <linearGradient id="bodHistFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={OBSERVED} stopOpacity="0.24" />
          <stop offset="100%" stopColor={OBSERVED} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="bodFcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={FORECAST} stopOpacity="0.18" />
          <stop offset="100%" stopColor={FORECAST} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {bands.filter((item) => item.from < ymax).map((item) => (
        <rect
          key={item.label}
          x={left}
          y={yOf(Math.min(item.to, ymax))}
          width={width - left - right}
          height={Math.max(0, yOf(item.from) - yOf(Math.min(item.to, ymax)))}
          fill={item.color}
          fillOpacity="0.09"
        />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={left}
          x2={width - right}
          y1={yOf(ymax * frac)}
          y2={yOf(ymax * frac)}
          stroke={GRID_LINE}
          strokeDasharray="3 3"
        />
      ))}
      {bands.map((item) => (
        item.to < ymax ? (
          <text
            key={`lbl-${item.label}`}
            x={width - right - 2}
            y={yOf(item.to) - 3}
            textAnchor="end"
            fill={INK_2}
            fontSize="10"
            style={MONO}
          >
            ≤{item.to} {item.label}
          </text>
        ) : null
      ))}
      <path d={band} fill={OBSERVED} fillOpacity="0.14" />
      <path d={areaUnder(0, split)} fill="url(#bodHistFill)" />
      <path d={areaUnder(split, n - 1)} fill="url(#bodFcFill)" />
      <path d={linePath(p50, 0, split)} fill="none" stroke={OBSERVED} strokeWidth="2.4" />
      <path
        d={linePath(p50, split, n - 1)}
        fill="none"
        stroke={FORECAST}
        strokeWidth="2.2"
        strokeDasharray="5 4"
      />
      {cod50 && (
        <path
          d={linePath(cod50, 0, n - 1)}
          fill="none"
          stroke={SELECT}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          opacity="0.9"
        />
      )}
      <line
        x1={xOf(split)}
        x2={xOf(split)}
        y1={top}
        y2={height - bottom}
        stroke={FORECAST}
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />
      <circle cx={xOf(split)} cy={yOf(p50[split])} r="4" fill={FORECAST} stroke={SURFACE} strokeWidth="2" />
      {chartScrub >= 0 && chartScrub !== split && (
        <>
          <line
            x1={xOf(chartScrub)}
            x2={xOf(chartScrub)}
            y1={top}
            y2={height - bottom}
            stroke={INK}
            strokeWidth="1.2"
            strokeOpacity="0.45"
          />
          <circle cx={xOf(chartScrub)} cy={yOf(p50[chartScrub])} r="4" fill={FORECAST} stroke={SURFACE} strokeWidth="2" />
          {cod50 && (
            <circle cx={xOf(chartScrub)} cy={yOf(cod50[chartScrub])} r="3.2" fill={SELECT} stroke={SURFACE} strokeWidth="1.5" />
          )}
        </>
      )}
      <text
        x={xOf(split) + 6}
        y={top + 11}
        fill={FORECAST}
        fontSize="10"
        style={MONO}
      >
        today
      </text>
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke={GRID_LINE} />
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke={GRID_LINE} />
      {yTicks.map((tick) => (
        <text
          key={tick}
          x={left - 5}
          y={yOf(tick) + 3}
          textAnchor="end"
          fill={INK_MUTED}
          fontSize="10"
          style={MONO}
        >
          {tick}
        </text>
      ))}
      <text x={left - 26} y={top + 8} fill={INK_MUTED} fontSize="10" style={MONO}>
        mg/L
      </text>
    </svg>
  )
}

const WQ_LAYERS = [
  {
    id: 'tss',
    title: 'Turbidity / TSS',
    subtitle: 'July 2026 · classified overlay',
    rows: [
      { color: '#2196F3', label: '1 Low TSS ≤ 0.62' },
      { color: '#FFC107', label: '2 Medium 0.62–1.17' },
      { color: '#F44336', label: '3 High > 1.17' },
    ],
  },
  {
    id: 'ndci',
    title: 'NDCI — Chlorophyll',
    subtitle: 'July 2026 · classified overlay',
    rows: [
      { color: '#C8E6C9', label: '1 Low Chlorophyll NDCI < 0' },
      { color: '#1B5E20', label: '2 High Chlorophyll NDCI ≥ 0' },
    ],
  },
  {
    id: 'ndwi',
    title: 'NDWI — Water Detection',
    subtitle: 'July 2026 · classified overlay',
    rows: [
      { color: '#8D6E63', label: '1 Non-water NDWI ≤ 0' },
      { color: '#0D47A1', label: '2 Water NDWI > 0' },
    ],
  },
  {
    id: 'wst',
    title: 'WST — Temperature',
    subtitle: 'Salinity · thermal proxy · July 2026 · °C',
    rows: [
      { color: '#1565C0', label: '1 Very Low <27 °C' },
      { color: '#64B5F6', label: '2 Low 27–<30 °C' },
      { color: '#FFD54F', label: '3 Moderate 30–<33 °C' },
      { color: '#E53935', label: '4 High 33–<36 °C' },
      { color: '#8E0000', label: '5 Very High ≥36 °C' },
    ],
  },
]

const BodCodMapOverlay = ({
  showTssLayer = true,
  showNdciLayer = false,
  showNdwiLayer = false,
  showWstLayer = false,
  showChainageLayer = false,
  focusChainage = null,
  onSelectChainage,
}) => {
  const [data, setData] = useState(null)
  const [stations, setStations] = useState([])
  const [scrubIndex, setScrubIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [openInfoId, setOpenInfoId] = useState('tss')

  const layerOn = {
    tss: showTssLayer,
    ndci: showNdciLayer,
    ndwi: showNdwiLayer,
    wst: showWstLayer,
  }

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const json = await fetchAssetJson('/asset/dashboard_data.json', 'BOD-COD data')
        if (cancelled) return
        setData(json)
        setSelected(json.kml_reach_id || json.reaches?.[0]?.id || null)
        const todayIdx = (json.reaches?.[0]?.history?.dates?.length || 1) - 1
        setScrubIndex(todayIdx)
      } catch (error) {
        console.error(error)
      }
    }
    load()
    fetchAssetJson('/asset/mula-mutha-chainage.geojson', 'Chainage layer')
      .then((geojson) => {
        if (!cancelled) setStations(stationsFromChainageGeojson(geojson))
      })
      .catch(() => {
        if (!cancelled) setStations([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const timeline = useMemo(() => {
    if (!data?.reaches?.length) return []
    return data.reaches[0].history.dates.concat(data.reaches[0].forecast.dates)
  }, [data])

  const isHourly = Boolean(
    data?.timeline_resolution === 'hourly' ||
      (data?.reaches?.[0]?.history?.dates?.[0] && String(data.reaches[0].history.dates[0]).includes('T')),
  )

  const todayIdx = data?.reaches?.[0]?.history?.dates?.length
    ? data.reaches[0].history.dates.length - 1
    : 0

  const km0 = data?.reaches?.[0]?.km?.[0]
  const km1 = data?.reaches?.[(data.reaches?.length || 1) - 1]?.km?.[1]
  const playheadKm = useMemo(() => {
    if (!focusChainage || !Number.isFinite(km0) || !Number.isFinite(km1)) return null
    return ribbonKmFromChainage(focusChainage.chainage_m, km0, km1)
  }, [focusChainage, km0, km1])

  useEffect(() => {
    if (!data?.reaches || playheadKm == null) return
    const reach = reachForRibbonKm(data.reaches, playheadKm)
    if (reach && reach.id !== selected) setSelected(reach.id)
  }, [playheadKm, data])

  if (!data) return null

  const colors = { ...data.class_colors, ...LIGHT_CLASS_COLORS }
  const edges = data.bod_edges
  const margin = { l: 58, r: 24 }
  const width = 1200
  const cy = 62
  const xOf = (km) => margin.l + ((km - km0) / (km1 - km0)) * (width - margin.l - margin.r)

  const bandOf = (value) => {
    for (let i = 0; i < edges.length; i += 1) {
      if (value <= edges[i]) return CLS[i]
    }
    return 'E'
  }

  const isTodayIndex = (index) => (
    index < data.reaches[0].history.dates.length &&
    dayKey(timeline[index]) === data.generated
  )

  const valAt = (reach, index) => {
    if (index < reach.history.dates.length) {
      return {
        p10: reach.history.p10[index],
        p50: reach.history.p50[index],
        p90: reach.history.p90[index],
        mode: isTodayIndex(index) ? 'today' : 'history',
        support: reach.history.support[index],
      }
    }
    const j = index - reach.history.dates.length
    return {
      p10: reach.forecast.p10[j],
      p50: reach.forecast.p50[j],
      p90: reach.forecast.p90[j],
      mode: 'forecast',
      support: 'forecast',
    }
  }

  const valAtCod = (reach, index) => {
    const history = reach.history
    const forecast = reach.forecast
    if (!history.cod_p50) return null
    if (index < history.dates.length) {
      return {
        p10: history.cod_p10[index],
        p50: history.cod_p50[index],
        p90: history.cod_p90[index],
      }
    }
    if (!forecast.cod_p50) return null
    const j = index - history.dates.length
    return {
      p10: forecast.cod_p10[j],
      p50: forecast.cod_p50[j],
      p90: forecast.cod_p90[j],
    }
  }

  const current = valAt(data.reaches[0], scrubIndex)
  const modeLabel =
    current.mode === 'forecast'
      ? 'FORECAST'
      : current.mode === 'today'
        ? 'TODAY'
        : 'HISTORY'

  const fcCount = isHourly
    ? (data.forecast_hours || data.reaches[0].forecast.dates.length)
    : (data.forecast_days || data.reaches[0].forecast.dates.length)
  const fcUnit = isHourly ? 'h' : 'd'
  const bm = data.blind_metrics
  const skillCount = data.skill.length
  const skillWidth = 280
  const skillHeight = 148
  const skillZero = 76
  const skillGap = Math.max(3, (skillWidth - 20) / skillCount)
  const skillBarWidth = Math.min(14, skillGap - 3)
  const selectedReach = data.reaches.find((reach) => reach.id === selected) || data.reaches[0]
  const selectedValue = valAt(selectedReach, scrubIndex)
  const selectedCod = valAtCod(selectedReach, scrubIndex)
  const selectedCls = selectedValue.mode === 'today' && !isHourly
    ? selectedReach.today.cls
    : bandOf(selectedValue.p50)
  const selectedClassColor = colors[selectedCls] || colors.NA
  const histCount = isHourly
    ? (data.history_hours || selectedReach.history.dates.length)
    : (data.history_days || selectedReach.history.dates.length)
  const histUnit = isHourly ? 'h' : 'd'

  const pickReach = (reach) => {
    setSelected(reach.id)
    if (!onSelectChainage || !stations.length || !Number.isFinite(km0) || !Number.isFinite(km1)) return
    const mid = (reach.km[0] + reach.km[1]) / 2
    const metres = chainageFromRibbonKm(mid, km0, km1)
    const station = stations.reduce((best, row) =>
      Math.abs(row.chainage_m - metres) < Math.abs(best.chainage_m - metres) ? row : best,
    )
    if (station) onSelectChainage(station)
  }

  const scoreBars = [
    { label: 'BOD R²', value: bm.bod.r2, max: 1, color: OBSERVED },
    { label: 'Class accuracy', value: bm.bod.class_accuracy, max: 1, color: '#1c8a55' },
    { label: '90% coverage', value: bm.bod.interval_coverage, max: 1, color: SELECT },
    { label: 'COD R²', value: bm.cod.r2, max: 1, color: FORECAST },
    { label: 'Abstention', value: bm.bod.abstention_rate, max: 1, color: '#6d28d9' },
  ]

  return (
    <>
    <LayerPanelPortal viewId="waterquality">
      <div className="wq-embed panel-embed" aria-label="Water quality detail">
        {WQ_LAYERS.filter((layer) => layerOn[layer.id]).map((layer) => {
          const isOpen = openInfoId === layer.id
          return (
            <div
              key={layer.id}
              className={`wq-info-drop${isOpen ? ' is-open' : ''}`}
            >
              <div className="wq-info-head">
                <span className="wq-layer-check-text">{layer.title}</span>
                <button
                  type="button"
                  className="wq-info-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`wq-info-${layer.id}`}
                  onClick={() => toggleInfo(layer.id)}
                >
                  Info
                  <span className="wq-info-caret" aria-hidden="true" />
                </button>
              </div>
              {isOpen ? (
                <div className="wq-info-body" id={`wq-info-${layer.id}`}>
                  {layer.subtitle ? <small className="wq-dropdown-sub">{layer.subtitle}</small> : null}
                  <div className="tss-map-legend-rows">
                    {layer.rows.map((row) => (
                      <span key={row.label}>
                        <i style={{ background: row.color }} />
                        {row.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
        {showChainageLayer && (
          <ChainageLayerCard inputId="layer-wq-chainage" focusChainage={focusChainage} />
        )}
      </div>
    </LayerPanelPortal>
    <div className="bod-cod-map-overlays">
      <aside className="bod-cod-map-accuracy" aria-label="Accuracy measure">
        <div className="bod-acc-head">
          <h3>
            Accuracy
            <small>Blind holdout · bad months included</small>
          </h3>
          <span className="bod-live-pill">
            <span className="bod-live-dot" />
            BLIND
          </span>
        </div>

        <div className="bod-stat-chips">
          <span><em>BOD RMSE</em> {formatMetric(bm.bod.rmse)}</span>
          <span><em>COD RMSE</em> {formatMetric(bm.cod.rmse)}</span>
          <span><em>Pairs</em> {formatMetric(bm.bod.n)}</span>
        </div>

        <div className="bod-score-bars">
          {scoreBars.map((item) => (
            <div className="bod-score" key={item.label}>
              <div className="bod-score-meta">
                <span>{item.label}</span>
                <strong>{formatMetric(item.value)}</strong>
              </div>
              <div className="bod-score-track">
                <div
                  className="bod-score-fill"
                  style={{ width: `${Math.min((Number(item.value) / item.max) * 100, 100)}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bod-cod-skill-block">
          <div className="bod-cod-skill-caption">
            {fcCount}-{isHourly ? 'hour' : 'day'} skill vs persistence · {data.anomaly_count_30d} anomalies / 30d
          </div>
          <svg className="bod-cod-skill-svg" viewBox={`0 0 ${skillWidth} ${skillHeight}`} preserveAspectRatio="xMidYMid meet">
            <line x1="8" x2={skillWidth - 4} y1={skillZero} y2={skillZero} stroke={GRID_LINE} />
            {data.skill.map((row, index) => {
              const value = row.skill_vs_persistence
              const height = Math.min(Math.abs(value) * 100, 58)
              const up = value >= 0
              const y = up ? skillZero - height : skillZero
              const bx = 10 + index * skillGap
              const fill = up ? '#1c8a55' : '#c2372a'
              return (
                <g key={row.day}>
                  <rect
                    x={bx}
                    y={y}
                    width={skillBarWidth}
                    height={Math.max(height, 1)}
                    rx="3"
                    fill={fill}
                    opacity="0.92"
                  />
                  <text
                    x={bx + skillBarWidth / 2}
                    y={up ? y - 4 : y + height + 11}
                    textAnchor="middle"
                    fill={fill}
                    fontSize="8"
                    style={MONO}
                  >
                    {formatSkill(value)}
                  </text>
                  <text
                    x={bx + skillBarWidth / 2}
                    y={skillHeight - 4}
                    textAnchor="middle"
                    fill={INK_MUTED}
                    fontSize="8"
                    style={MONO}
                  >
                    D{row.day}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </aside>

      <section className="bod-cod-map-ribbon" aria-label="River end to end">
        <div className="bod-cod-ribbon-main">
          <div className="bod-cod-ribbon-head">
            <h2>The river, end to end</h2>
            <span className="bod-cod-ribbon-date">{timelineLabel(timeline[scrubIndex])}</span>
            <span className={`bod-mode-pill${current.mode === 'today' ? ' is-live' : ''}`}>
              {current.mode === 'today' && <span className="bod-live-dot" />}
              {modeLabel}
            </span>
          </div>

          <svg
            className="bod-cod-ribbon-svg"
            viewBox="0 0 1200 118"
            role="img"
            aria-label="River ribbon coloured by pollution class per reach"
          >
            <defs>
              <filter id="bod-seg-glow" x="-20%" y="-40%" width="140%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern
                id="bod-cod-hatch"
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill="rgba(255,255,255,0)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(13,36,54,.42)" strokeWidth="3" />
              </pattern>
            </defs>

            {data.reaches.map((reach) => {
              const value = valAt(reach, scrubIndex)
              const cls = value.mode === 'today' && !isHourly ? reach.today.cls : bandOf(value.p50)
              const h = Math.max(12, Math.min(32, reach.width_m / 32))
              const isKml = data.kml_reach_id && reach.id === data.kml_reach_id
              const isSelected = reach.id === selected
              const fill = colors[cls] || colors.NA
              return (
                <g key={reach.id}>
                  <rect
                    x={xOf(reach.km[0]) + 1}
                    y={cy - h / 2}
                    width={xOf(reach.km[1]) - xOf(reach.km[0]) - 2}
                    height={h}
                    rx="6"
                    fill={fill}
                    className={`bod-cod-seg${isSelected ? ' sel' : ''}`}
                    filter={isSelected ? 'url(#bod-seg-glow)' : undefined}
                    stroke={isKml ? OBSERVED : isSelected ? SELECT : value.mode === 'forecast' ? 'rgba(13,36,54,.45)' : 'none'}
                    strokeWidth={isSelected ? 2.6 : isKml || value.mode === 'forecast' ? 2 : 0}
                    strokeDasharray={value.mode === 'forecast' ? '5 4' : undefined}
                    fillOpacity={value.mode === 'forecast' ? 0.78 : 1}
                    onClick={() => pickReach(reach)}
                  />
                  {value.support === 'prior' && (
                    <rect
                      x={xOf(reach.km[0]) + 1}
                      y={cy - h / 2}
                      width={xOf(reach.km[1]) - xOf(reach.km[0]) - 2}
                      height={h}
                      rx="6"
                      fill="url(#bod-cod-hatch)"
                      pointerEvents="none"
                    />
                  )}
                  <text
                    x={(xOf(reach.km[0]) + xOf(reach.km[1])) / 2}
                    y={cy + h / 2 + 16}
                    textAnchor="middle"
                    fill={isSelected ? SELECT : INK_2}
                    fontSize="14"
                    style={MONO}
                    fontWeight="700"
                  >
                    {reach.id}
                  </text>
                </g>
              )
            })}

            <text x={6} y={cy + 5} fill={OBSERVED} fontSize="13" fontWeight="700">
              flow →
            </text>

            {(data.landmarks || []).map(([name, km]) => (
              <g key={`${name}-${km}`}>
                <line x1={xOf(km)} y1={cy - 26} x2={xOf(km)} y2={cy - 16} stroke={INK_MUTED} strokeWidth="1" />
                <text
                  x={xOf(km)}
                  y={cy - 32}
                  textAnchor="middle"
                  fill={INK}
                  fontSize="15"
                  style={DISPLAY}
                  fontWeight="500"
                >
                  {name}
                </text>
              </g>
            ))}
            {playheadKm != null && (
              <g className="bod-chainage-playhead" pointerEvents="none">
                <line
                  x1={xOf(playheadKm)}
                  x2={xOf(playheadKm)}
                  y1={18}
                  y2={cy + 20}
                  stroke="#f4c430"
                  strokeWidth="2.4"
                />
                <polygon
                  points={`${xOf(playheadKm)},14 ${xOf(playheadKm) - 7},24 ${xOf(playheadKm) + 7},24`}
                  fill="#f4c430"
                />
                <text
                  x={xOf(playheadKm)}
                  y={14}
                  textAnchor="middle"
                  fill="#0d2436"
                  fontSize="11"
                  fontWeight="700"
                  style={MONO}
                >
                  {focusChainage?.name || formatChainage(focusChainage.chainage_m)}
                </text>
              </g>
            )}
          </svg>

          <div className="bod-cod-scrub-row">
            <span className="bod-cod-scrub-lab">{timelineLabel(timeline[0])}</span>
            <input
              type="range"
              min="0"
              max={Math.max(timeline.length - 1, 0)}
              value={scrubIndex}
              aria-label="Time scrubber across history and forecast"
              onChange={(event) => setScrubIndex(Number(event.target.value))}
            />
            <span className="bod-cod-scrub-lab">
              {timelineLabel(timeline[timeline.length - 1])} (+{fcCount}{fcUnit})
            </span>
          </div>

          <div className="bod-cod-legend">
            {CLS.map((cls) => (
              <span key={cls} className="bod-legend-pill">
                <span className="sw" style={{ background: colors[cls] }} />
                Class {cls}
              </span>
            ))}
            <span className="bod-legend-pill">
              <span className="sw dashed" />
              forecast
            </span>
            <span className="bod-legend-pill">
              <span className="sw hatched" />
              prior only
            </span>
            {data.kml_reach_id && (
              <span className="bod-legend-pill">
                <span className="sw kml" />
                KML {data.kml_reach_id}
              </span>
            )}
          </div>
        </div>

        <aside className="bod-cod-reach-panel" aria-label="Reach detail">
          <div className="bod-cod-reach-meta">
            <h3>
              Reach detail
              <small>Click any segment</small>
            </h3>
            <div className="bod-cod-reach-name">{selectedReach.name}</div>
            <div className="bod-cod-reach-num" style={{ color: selectedClassColor }}>
              {selectedValue.p50.toFixed(1)} <small>mg/L BOD</small>
            </div>
            {selectedCod && (
              <div className="bod-cod-reach-num is-cod">
                {selectedCod.p50.toFixed(1)} <small>mg/L COD</small>
              </div>
            )}
            <div className="bod-gauge-status" style={{ borderColor: selectedClassColor }}>
              Class {selectedCls}
            </div>
            <div className="bod-stat-chips">
              <span><em>BOD P10</em> {selectedValue.p10.toFixed(1)}</span>
              <span><em>BOD P50</em> {selectedValue.p50.toFixed(1)}</span>
              <span><em>BOD P90</em> {selectedValue.p90.toFixed(1)}</span>
              {selectedCod && (
                <span><em>COD P50</em> {selectedCod.p50.toFixed(1)}</span>
              )}
            </div>
            <div className="bod-cod-chips">
              <span className="chip tier">
                {(selectedValue.mode === 'today' ? selectedReach.today.tier : 'Estimated').toUpperCase()}
              </span>
              <span className="chip">support: {selectedValue.support}</span>
              {data.kml_reach_id && selectedReach.id === data.kml_reach_id && (
                <span className="chip kml">KML</span>
              )}
            </div>
          </div>
          <div className="bod-cod-reach-graph">
            <ReachHistoryChart
              reach={selectedReach}
              edges={edges}
              colors={colors}
              todayIdx={todayIdx}
              scrubIdx={scrubIndex}
              isHourly={isHourly}
            />
            <div className="bod-cod-reach-caption">
              {histCount}{histUnit} fused history · teal = BOD · blue dashed = COD · gold dashed = forecast
            </div>
          </div>
        </aside>
      </section>
    </div>
    </>
  )
}

export default BodCodMapOverlay
