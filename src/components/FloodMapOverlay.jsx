import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  STATUS_COLORS,
  advanceSim,
  cellForChainage,
  downsample,
  fetchHydrograph,
  fetchMargins,
  fetchMeta,
  fetchProfile,
  fetchRivers,
  fetchState,
  shortName,
  worstStatus,
} from '../lib/floodApi'
import { fetchDepthSummary } from '../lib/depthSummary'
import {
  RETURN_PERIODS,
  ZONE_STYLES,
  buildFloodZones,
  getReturnPeriods,
} from '../lib/floodZones'
import { useMapStageFooter, useMapStageRight } from './MapStage'
import './FloodMapOverlay.css'

const LEAD_OPTIONS = [6, 24, 48, 72]
const REFRESH_OPTIONS = [
  { value: 30, label: '30 s' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 0, label: 'Off' },
]
const AUTO_ADV_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '+1 h / refresh' },
  { value: 3, label: '+3 h / refresh' },
  { value: 6, label: '+6 h / refresh' },
  { value: 12, label: '+12 h / refresh' },
  { value: 24, label: '+24 h / refresh' },
]

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const OBSERVED = '#0e8f9c'
const FORECAST = '#b3761a'
const DANGER = '#c2372a'
const SELECT = '#1668b3'
const INK_2 = '#3a5c73'
const INK_MUTED = '#6b8798'
const GRID_LINE = '#b8cfe0'
const SURFACE = '#ffffff'
const MONO = { fontFamily: 'var(--rv-font-mono)' }

const AssetHydrograph = ({ hydro, meta, threshold }) => {
  const width = 560
  const height = 168
  const left = 46
  const right = 12
  const top = 16
  const bottom = 22

  if (!hydro) return <div className="flood-loading">Loading hydrograph…</div>

  const observed = hydro.observed || []
  const median = hydro.forecast?.median || []
  const p10 = hydro.forecast?.p10 || []
  const p90 = hydro.forecast?.p90 || []
  const pastH = meta.past_hours
  const fcH = meta.forecast_hours

  const values = [...observed, ...median, ...p10, ...p90, threshold].filter((v) => Number.isFinite(v))
  if (!values.length) return <div className="flood-loading">No hydrograph data</div>
  const lo = Math.min(...values) - 0.25
  const hi = Math.max(...values) + 0.25

  const xOf = (h) => left + ((h + pastH) / (pastH + fcH)) * (width - left - right)
  const yOf = (v) => top + (1 - (v - lo) / (hi - lo)) * (height - top - bottom)

  const obsPath = observed
    .map((v, i) => `${i ? 'L' : 'M'}${xOf(i - pastH).toFixed(1)} ${yOf(v).toFixed(1)}`)
    .join(' ')
  const medPath = median
    .map((v, i) => `${i ? 'L' : 'M'}${xOf(i + 1).toFixed(1)} ${yOf(v).toFixed(1)}`)
    .join(' ')
  const fog =
    p10.length && p90.length
      ? `${p90.map((v, i) => `${i ? 'L' : 'M'}${xOf(i + 1).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')} ${[...p10]
          .reverse()
          .map((v, i) => `L${xOf(p10.length - i).toFixed(1)} ${yOf(v).toFixed(1)}`)
          .join(' ')} Z`
      : ''

  return (
    <svg
      className="flood-hydro-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Hydrograph at selected asset"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={left}
          x2={width - right}
          y1={yOf(lo + (hi - lo) * frac)}
          y2={yOf(lo + (hi - lo) * frac)}
          stroke={GRID_LINE}
          strokeDasharray="3 3"
        />
      ))}
      {fog && <path d={fog} fill={FORECAST} fillOpacity="0.18" />}
      {Number.isFinite(threshold) && (
        <>
          <line
            x1={left}
            x2={width - right}
            y1={yOf(threshold)}
            y2={yOf(threshold)}
            stroke={DANGER}
            strokeWidth="1.6"
            strokeDasharray="6 4"
          />
          <text
            x={width - right - 3}
            y={yOf(threshold) - 4}
            textAnchor="end"
            fill={DANGER}
            fontSize="9.5"
            style={MONO}
          >
            threshold {threshold.toFixed(2)} m
          </text>
        </>
      )}
      <path d={medPath} fill="none" stroke={FORECAST} strokeWidth="2.1" />
      <path d={obsPath} fill="none" stroke={OBSERVED} strokeWidth="2.3" />
      <line x1={xOf(0)} x2={xOf(0)} y1={top} y2={height - bottom} stroke={OBSERVED} strokeDasharray="3 3" />
      <text x={xOf(0) + 4} y={top + 10} fill="#0a6f7a" fontSize="9.5" style={MONO}>
        now
      </text>
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke={GRID_LINE} />
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke={GRID_LINE} />
      {[lo, (lo + hi) / 2, hi].map((tick) => (
        <text
          key={tick}
          x={left - 5}
          y={yOf(tick) + 3}
          textAnchor="end"
          fill={INK_MUTED}
          fontSize="9.5"
          style={MONO}
        >
          {tick.toFixed(1)}
        </text>
      ))}
      {[-pastH, 0, fcH].map((tick) => (
        <text
          key={tick}
          x={xOf(tick)}
          y={height - 7}
          textAnchor="middle"
          fill={INK_MUTED}
          fontSize="9.5"
          style={MONO}
        >
          {tick > 0 ? `+${tick}h` : `${tick}h`}
        </text>
      ))}
    </svg>
  )
}

const FloodMapOverlay = ({
  onZonesChange,
  onAssetsChange,
  selectedAssetId = null,
  onSelectedAssetChange,
  showDepthLayer = false,
  showTwinLayer = false,
  leadH = null,
  onLeadChange = null,
  preferPanelsOpen = false,
  activeZones: activeZonesProp = null,
}) => {
  const [meta, setMeta] = useState(null)
  const [state, setState] = useState(null)
  const [margins, setMargins] = useState([])
  const [profile, setProfile] = useState(null)
  const [hydro, setHydro] = useState(null)
  const [selected, setSelected] = useState(null)
  const [leadInternal, setLeadInternal] = useState(24)
  const lead = leadH != null ? leadH : leadInternal
  const setLead = (value) => {
    if (typeof onLeadChange === 'function') onLeadChange(value)
    else setLeadInternal(value)
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fetchingTwin, setFetchingTwin] = useState(true)
  const [depthSummary, setDepthSummary] = useState(null)
  const activeZones = activeZonesProp ?? []
  const [showSummaryPanel, setShowSummaryPanel] = useState(Boolean(preferPanelsOpen))
  const [showRibbon, setShowRibbon] = useState(Boolean(preferPanelsOpen))
  const [refreshEverySec, setRefreshEverySec] = useState(60)
  const [autoAdvH, setAutoAdvH] = useState(6)
  const [stepHours, setStepHours] = useState(6)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [nextInSec, setNextInSec] = useState(null)
  const [clockPulse, setClockPulse] = useState(false)
  const [rivers, setRivers] = useState([])
  const [activeRiver, setActiveRiver] = useState(null)
  const [simHour, setSimHour] = useState(null)
  const footerNode = useMapStageFooter()
  const rightNode = useMapStageRight()
  const activeRiverRef = useRef(null)
  const autoAdvRef = useRef(autoAdvH)

  useEffect(() => {
    activeRiverRef.current = activeRiver
  }, [activeRiver])

  useEffect(() => {
    autoAdvRef.current = autoAdvH
  }, [autoAdvH])

  // Right summary + bottom margin/asset panels follow the Digital Twin layer toggle.
  useEffect(() => {
    setShowSummaryPanel(Boolean(preferPanelsOpen))
    setShowRibbon(Boolean(preferPanelsOpen))
  }, [preferPanelsOpen])

  useEffect(() => {
    let cancelled = false
    fetchDepthSummary()
      .then((data) => {
        if (!cancelled) setDepthSummary(data)
      })
      .catch(() => {
        if (!cancelled) setDepthSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const markUpdated = useCallback(() => {
    setLastUpdated(new Date())
  }, [])

  const loadLive = useCallback(async (metaData, river = activeRiverRef.current) => {
    const [stateData, marginData] = await Promise.all([
      fetchState(river),
      fetchMargins(river),
    ])
    setState(stateData)
    setMargins(marginData)
    onAssetsChange?.(marginData)
    if (metaData) {
      setMeta(metaData)
      if (Number.isFinite(metaData.sim_hour)) setSimHour(metaData.sim_hour)
    }
    markUpdated()
    return marginData
  }, [onAssetsChange, markUpdated])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFetchingTwin(true)
      setError(null)
      try {
        const riverList = await fetchRivers()
        if (cancelled) return
        setRivers(riverList)
        const riverName = riverList[0]?.name || null
        if (riverName) {
          setActiveRiver(riverName)
          activeRiverRef.current = riverName
        }
        const metaData = await fetchMeta(riverName)
        if (cancelled) return
        setMeta(metaData)
        if (Number.isFinite(metaData.sim_hour)) setSimHour(metaData.sim_hour)
        const marginData = await loadLive(metaData, riverName)
        if (cancelled) return
        const worst = [...marginData].sort(
          (a, b) => (b.p_exceed_72h ?? 0) - (a.p_exceed_72h ?? 0) || a.margin_now_m - b.margin_now_m
        )[0]
        // Only seed a default once — do not fight map / user selection.
        setSelected((current) => current || selectedAssetId || worst?.id || marginData[0]?.id || null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setFetchingTwin(false)
      }
    }
    load()
    return () => {
      cancelled = true
      onAssetsChange?.(null)
      onSelectedAssetChange?.(null)
    }
    // selectedAssetId is read only for the initial seed; do not re-fetch when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / loader identity only
  }, [loadLive, onAssetsChange, onSelectedAssetChange])

  // The return periods come from a fixed published gauge record, so the fit is a
  // constant; only the reach geometry and the visible selection change.
  const returnPeriods = useMemo(() => getReturnPeriods(), [])

  const zones = useMemo(() => {
    if (!meta || !activeZones.length) return null
    return buildFloodZones(meta, returnPeriods, activeZones)
  }, [meta, returnPeriods, activeZones])

  useEffect(() => {
    onZonesChange?.(zones?.collection || null)
  }, [zones, onZonesChange])

  useEffect(() => () => onZonesChange?.(null), [onZonesChange])

  useEffect(() => {
    let cancelled = false
    fetchProfile(lead, activeRiver)
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [lead, state, activeRiver])

  const asset = useMemo(
    () => margins.find((row) => row.id === selected) || margins[0] || null,
    [margins, selected]
  )

  const selectedEmitRef = useRef(null)

  useEffect(() => {
    if (!selectedAssetId || selectedAssetId === selected) return
    // Ignore echo of what we just pushed to the parent.
    if (selectedAssetId === selectedEmitRef.current) return
    if (!margins.some((row) => row.id === selectedAssetId)) return
    setSelected(selectedAssetId)
  }, [selectedAssetId, selected, margins])

  useEffect(() => {
    if (!selected || selected === selectedEmitRef.current) return
    selectedEmitRef.current = selected
    onSelectedAssetChange?.(selected)
  }, [selected, onSelectedAssetChange])

  const selectAsset = (id) => {
    if (!id) return
    selectedEmitRef.current = id
    setSelected(id)
    onSelectedAssetChange?.(id)
  }

  const hydroCell = meta && asset ? cellForChainage(meta, asset.chainage_m) : null
  const hydroSimKey = simHour ?? state?.sim_hour ?? state?.t ?? ''

  useEffect(() => {
    if (!meta || hydroCell == null || !showTwinLayer) return undefined
    let cancelled = false
    fetchHydrograph(hydroCell, activeRiver)
      .then((data) => !cancelled && setHydro(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [meta, hydroCell, hydroSimKey, showTwinLayer, activeRiver])

  const handleAdvance = useCallback(async (hours) => {
    const step = Number(hours)
    if (!Number.isFinite(step) || step === 0) return
    setBusy(true)
    try {
      const result = await advanceSim(step, activeRiverRef.current)
      if (Number.isFinite(result?.sim_hour)) {
        setSimHour(result.sim_hour)
        setClockPulse(true)
        window.setTimeout(() => setClockPulse(false), 500)
      }
      await loadLive()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [loadLive])

  const switchRiver = useCallback(async (name) => {
    if (!name || name === activeRiverRef.current) return
    setBusy(true)
    setError(null)
    try {
      setActiveRiver(name)
      activeRiverRef.current = name
      const metaData = await fetchMeta(name)
      setMeta(metaData)
      if (Number.isFinite(metaData.sim_hour)) setSimHour(metaData.sim_hour)
      const marginData = await loadLive(metaData, name)
      const worst = [...marginData].sort(
        (a, b) => (b.p_exceed_72h ?? 0) - (a.p_exceed_72h ?? 0) || a.margin_now_m - b.margin_now_m
      )[0]
      setSelected(worst?.id || marginData[0]?.id || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [loadLive])

  // Periodic refresh (+ optional auto-advance), matching the twin HTML dashboard.
  useEffect(() => {
    if (!showTwinLayer || !meta) return undefined
    if (!refreshEverySec || refreshEverySec <= 0) {
      setNextInSec(null)
      return undefined
    }

    let nextAt = Date.now() + refreshEverySec * 1000
    setNextInSec(refreshEverySec)

    const tickCountdown = () => {
      setNextInSec(Math.max(0, Math.round((nextAt - Date.now()) / 1000)))
    }

    const doRefresh = async () => {
      nextAt = Date.now() + refreshEverySec * 1000
      const advH = autoAdvRef.current
      if (advH > 0) {
        try {
          const result = await advanceSim(advH, activeRiverRef.current)
          if (Number.isFinite(result?.sim_hour)) {
            setSimHour(result.sim_hour)
            setClockPulse(true)
            window.setTimeout(() => setClockPulse(false), 500)
          }
        } catch (err) {
          setError(err.message)
        }
      }
      try {
        await loadLive()
      } catch (err) {
        setError(err.message)
      }
      tickCountdown()
    }

    const refreshTimer = window.setInterval(doRefresh, refreshEverySec * 1000)
    const countdownTimer = window.setInterval(tickCountdown, 1000)
    tickCountdown()

    return () => {
      window.clearInterval(refreshTimer)
      window.clearInterval(countdownTimer)
    }
  }, [refreshEverySec, showTwinLayer, meta, loadLive])

  const twinLoading = showTwinLayer && fetchingTwin
  const twinUiReady = showTwinLayer && !fetchingTwin && Boolean(meta) && margins.length > 0

  const twinLoadingRight = (
    <aside className="flood-map-panel is-stage-sidebar is-loading" aria-label="Flood forecast summary" aria-busy="true">
      <div className="flood-panel-head">
        <h3>
          Digital twin
          <small>Fetching modelled discharge · WSE · margins</small>
        </h3>
        <div className="flood-panel-head-actions">
          <span className="flood-provenance is-model">Model</span>
        </div>
      </div>
      <div className="flood-loading-block">
        <span className="flood-spinner" aria-hidden="true" />
        <p>Loading twin data…</p>
      </div>
    </aside>
  )

  const twinLoadingFooter = (
    <section className="flood-map-ribbon is-stage-footer is-loading" aria-label="Flood margin board" aria-busy="true">
      <div className="flood-loading-block is-ribbon">
        <span className="flood-spinner" aria-hidden="true" />
        <p>Loading margin board…</p>
      </div>
    </section>
  )

  if (error && !meta && !fetchingTwin) {
    const errorPanel = (
      <aside className="flood-map-panel is-stage-sidebar" aria-label="Flood forecast summary">
        <div className="flood-panel-head">
          <h3>
            Flood risk
            <small>Live twin unavailable</small>
          </h3>
        </div>
        <div className="flood-loading">{error}</div>
      </aside>
    )

    return (
      <>
        {showTwinLayer && rightNode && showSummaryPanel ? createPortal(errorPanel, rightNode) : null}
        {showTwinLayer && footerNode && showRibbon ? createPortal(
          <section className="flood-map-ribbon is-stage-footer is-loading" aria-label="Flood margin board">
            <div className="flood-loading-block is-ribbon">
              <p>Twin data unavailable</p>
            </div>
          </section>,
          footerNode,
        ) : null}
      </>
    )
  }

  if (twinLoading) {
    return (
      <>
        {rightNode && showSummaryPanel ? createPortal(twinLoadingRight, rightNode) : null}
        {footerNode && showRibbon ? createPortal(twinLoadingFooter, footerNode) : null}
      </>
    )
  }

  if (!meta) {
    return null
  }

  const overall = margins.length ? worstStatus(margins) : 'SAFE'
  const reachM = meta.reach_km * 1000

  const width = 1200
  const marginX = { l: 56, r: 24 }
  const cy = 40
  const xOf = (chainageM) => marginX.l + (chainageM / reachM) * (width - marginX.l - marginX.r)

  const spark = downsample(profile?.median || [], 160)
  const sparkLo = spark.length ? Math.min(...spark) : 0
  const sparkHi = spark.length ? Math.max(...spark) : 1
  const riverPath = spark.length
    ? spark
        .map((v, i) => {
          const x = marginX.l + (i / (spark.length - 1)) * (width - marginX.l - marginX.r)
          const y = cy - 10 + (1 - (v - sparkLo) / (sparkHi - sparkLo || 1)) * 20
          return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join(' ')
    : `M${marginX.l} ${cy} L${width - marginX.r} ${cy}`

  const displaySimHour = Number.isFinite(simHour) ? simHour : meta.sim_hour
  const ensembleMembers = meta.members ?? 50
  const forecastHorizon = meta.forecast_hours ?? 72
  const riverOptions = rivers.length
    ? rivers
    : [{ name: 'Mula-Mutha', reach_km: meta.reach_km }]
  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString()
    : '—'
  const nextRefreshLabel =
    refreshEverySec > 0
      ? nextInSec != null && nextInSec > 0
        ? `next in ${nextInSec}s`
        : 'refreshing…'
      : ''

  return (
    <>
    {twinUiReady && rightNode && showSummaryPanel && createPortal(
      <aside className="flood-map-panel is-stage-sidebar" aria-label="Flood forecast summary">
        <div className="flood-panel-head">
          <h3>
            Digital twin
            <small>Modelled discharge · WSE · margins · alerts</small>
          </h3>
          <div className="flood-panel-head-actions">
            <span className="flood-provenance is-model">Model</span>
            <button
              type="button"
              className="flood-panel-icon-btn"
              onClick={() => setShowSummaryPanel(false)}
              aria-label="Hide twin summary"
              title="Hide"
            >
              <IconClose />
            </button>
          </div>
        </div>

        <div className="flood-refresh-bar">
          <span className="flood-live-status">
            <span className="flood-live-pulse" aria-hidden="true" />
            <strong>Live</strong>
          </span>
          <span>
            Last updated: <b>{lastUpdatedLabel}</b>
          </span>
          <label className="flood-refresh-field">
            Refresh every
            <select
              value={refreshEverySec}
              onChange={(event) => setRefreshEverySec(Number(event.target.value))}
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`flood-aa-pill${autoAdvH === 0 ? ' is-off' : ''}`}>
            Auto-advance sim
            <select
              value={autoAdvH}
              onChange={(event) => setAutoAdvH(Number(event.target.value))}
            >
              {AUTO_ADV_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {nextRefreshLabel ? (
            <span className="flood-next-refresh">{nextRefreshLabel}</span>
          ) : null}
        </div>

        <div className="flood-twin-stats">
          <div className={`flood-twin-stat${clockPulse ? ' is-advancing' : ''}`}>
            Simulation clock
            <b>{Number.isFinite(displaySimHour) ? `${displaySimHour} h` : '—'}</b>
          </div>
          <div className="flood-twin-stat">
            Upstream discharge now
            <b>{Number.isFinite(state?.q_now) ? `${state.q_now} m³/s` : '—'}</b>
          </div>
          <div className="flood-twin-stat">
            Reach
            <b>
              {meta.reach_km} km · {meta.n_cells} stations
            </b>
          </div>
          <div className="flood-twin-stat">
            Ensemble
            <b>
              {ensembleMembers} members · {forecastHorizon} h
            </b>
          </div>
        </div>

        <div className="flood-twin-controls">
          <label className="flood-river-sel">
            <span>River</span>
            <select
              value={activeRiver || riverOptions[0]?.name || ''}
              onChange={(event) => switchRiver(event.target.value)}
              disabled={busy || riverOptions.length <= 1}
            >
              {riverOptions.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name} ({row.reach_km ?? meta.reach_km} km)
                </option>
              ))}
            </select>
          </label>

          <div className="flood-stepper" role="group" aria-label="Manual simulation step">
            <span className="flood-stepper-label">Manual step</span>
            <button
              type="button"
              onClick={() => handleAdvance(-Math.max(1, Number(stepHours) || 6))}
              disabled={busy}
              title="Go back"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={24}
              value={stepHours}
              onChange={(event) => setStepHours(Math.max(1, Math.min(24, Number(event.target.value) || 1)))}
              aria-label="Hours per manual step"
            />
            <button
              type="button"
              onClick={() => handleAdvance(Math.max(1, Number(stepHours) || 6))}
              disabled={busy}
              title="Go forward"
            >
              +
            </button>
          </div>
        </div>

        {showDepthLayer ? (
          <>
            <div className="flood-panel-divider" />
            <div className="flood-panel-label">Water depth distribution</div>
            {depthSummary ? (
          <>
            <div className="flood-stat-chips">
              <span>
                <em>Range</em>
                {depthSummary.classes[0]?.range_min?.toFixed(1)}–
                {depthSummary.classes[depthSummary.classes.length - 1]?.range_max?.toFixed(1)} m
              </span>
            </div>
            <div className="flood-depth-distribution">
              {depthSummary.classes.map((row) => (
                <div className="flood-depth-row" key={row.class}>
                  <div className="flood-depth-meta">
                    <span className="sw" style={{ background: row.color }} />
                    <span>
                      <strong>{row.label}</strong>
                      <em>{row.range_label}</em>
                    </span>
                    <strong className="flood-depth-count">
                      <small>{row.pct}%</small>
                    </strong>
                  </div>
                  <div className="flood-status-track">
                    <div
                      className="flood-status-fill"
                      style={{
                        width: `${row.pct}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="flood-depth-note">Colour on map matches depth class · smoothed raster overlay</p>
          </>
            ) : (
              <div className="flood-loading">Loading depth distribution…</div>
            )}
          </>
        ) : null}
      </aside>,
      rightNode,
    )}

    {twinUiReady && footerNode && showRibbon && createPortal(
      <section
        className="flood-map-ribbon is-stage-footer"
        aria-label="Flood margin board"
      >
        <div className="flood-ribbon-main">
          <div className="flood-ribbon-head">
            <h2>Margin to threshold, end to end</h2>
            <span className="flood-provenance is-model">Model</span>
            <div className="flood-lead-pills flood-ribbon-leads" aria-label="Forecast lead">
              {LEAD_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === lead ? 'is-on' : ''}
                  onClick={() => setLead(option)}
                >
                  +{option}h
                </button>
              ))}
            </div>
            <span
              className="flood-mode-pill"
              style={{ color: STATUS_COLORS[overall], borderColor: STATUS_COLORS[overall] }}
            >
              {overall}
            </span>
            <button
              type="button"
              className="flood-panel-icon-btn"
              onClick={() => setShowRibbon(false)}
              aria-label="Hide margin board"
              title="Hide"
            >
              <IconClose />
            </button>
          </div>

          <svg
            className="flood-ribbon-svg"
            viewBox="0 0 1200 96"
            role="img"
            aria-label="Protected assets along the reach coloured by exceedance status"
          >
            <defs>
              <filter id="flood-glow" x="-30%" y="-60%" width="160%" height="220%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d={riverPath} fill="none" stroke="#cfe3f0" strokeWidth="11" strokeLinecap="round" />
            <path d={riverPath} fill="none" stroke={OBSERVED} strokeWidth="2.2" strokeOpacity="0.9" />
            <text x={6} y={cy + 4} fill="#0a6f7a" fontSize="12" fontWeight="700">
              flow →
            </text>
            {([...margins].sort((a, b) => {
              if (a.id === asset?.id) return 1
              if (b.id === asset?.id) return -1
              return a.chainage_m - b.chainage_m
            })).map((row) => {
              const color = STATUS_COLORS[row.status] || INK_MUTED
              const isSelected = row.id === asset?.id
              const x = xOf(row.chainage_m)
              return (
                <g
                  key={row.id}
                  className={`flood-asset-mark${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectAsset(row.id)}
                  filter={isSelected ? 'url(#flood-glow)' : undefined}
                >
                  <line x1={x} x2={x} y1={cy - 16} y2={cy + 16} stroke={color} strokeOpacity="0.4" />
                  <circle
                    cx={x}
                    cy={cy}
                    r={isSelected ? 9 : 7}
                    fill={color}
                    stroke={isSelected ? SELECT : SURFACE}
                    strokeWidth={isSelected ? 2.4 : 1.6}
                  />
                  <text
                    x={x}
                    y={cy - 22}
                    textAnchor="middle"
                    fill={isSelected ? SELECT : INK_2}
                    fontSize="12"
                    style={MONO}
                    fontWeight="700"
                  >
                    {row.id}
                  </text>
                  <text x={x} y={cy + 30} textAnchor="middle" fill={INK_MUTED} fontSize="11">
                    {shortName(row.name)}
                  </text>
                  <text
                    x={x}
                    y={cy + 46}
                    textAnchor="middle"
                    fill={color}
                    fontSize="11.5"
                    style={MONO}
                    fontWeight="700"
                  >
                    {row.margin_now_m > 0 ? '+' : ''}
                    {row.margin_now_m} m
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="flood-legend">
            {['SAFE', 'WATCH', 'WARNING', 'DANGER'].map((status) => (
              <span className="flood-legend-pill" key={status}>
                <span className="sw" style={{ background: STATUS_COLORS[status] }} />
                {status}
              </span>
            ))}
            <span className="flood-legend-pill">
              {meta.members} members · {meta.past_hours}h past · {meta.forecast_hours}h ahead
            </span>
          </div>
        </div>

        <aside className="flood-detail-panel" aria-label="Asset detail">
          {asset && (
            <>
              <div className="flood-detail-meta">
                <h3>
                  Asset detail
                  <small>Click any marker</small>
                </h3>
                <div className="flood-detail-name">
                  {asset.id} · {shortName(asset.name)}
                </div>
                <div className="flood-detail-num" style={{ color: STATUS_COLORS[asset.status] }}>
                  {asset.margin_now_m > 0 ? '+' : ''}
                  {asset.margin_now_m} <small>m margin</small>
                </div>
                <div
                  className="flood-status-chip"
                  style={{ color: STATUS_COLORS[asset.status], borderColor: STATUS_COLORS[asset.status] }}
                >
                  {asset.status}
                </div>
                <div className="flood-stat-chips">
                  <span>
                    <em>P 72h</em>{Math.round((asset.p_exceed_72h || 0) * 100)}%
                  </span>
                  <span>
                    <em>To thr.</em>
                    {asset.time_to_threshold_h != null ? `${asset.time_to_threshold_h}h` : '—'}
                  </span>
                  <span>
                    <em>WSE</em>{asset.wse_now}
                  </span>
                </div>
              </div>
              <div className="flood-detail-graph">
                <AssetHydrograph hydro={hydro} meta={meta} threshold={asset.threshold} />
                <div className="flood-detail-caption">
                  <span className="flood-provenance is-model">Model</span>
                  {' '}
                  teal = observed {meta.past_hours} h · gold = ensemble median · fog = P10–P90 · red = threshold
                </div>
              </div>
            </>
          )}
        </aside>
      </section>,
      footerNode,
    )}
    </>
  )
}

export default FloodMapOverlay
