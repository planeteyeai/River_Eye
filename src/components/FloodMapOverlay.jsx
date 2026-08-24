import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STATUS_COLORS,
  advanceSim,
  cellForChainage,
  countByStatus,
  downsample,
  fetchHydrograph,
  fetchMargins,
  fetchMeta,
  fetchProfile,
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
import { binBoundsForChainage, formatChainage } from '../lib/chainageBins'
import { LayerPanelPortal } from './LayerPanelSlots'
import './FloodMapOverlay.css'

const LEAD_OPTIONS = [6, 24, 48, 72]

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

const TwinLayerPicker = ({
  activeZones,
  onToggleZone,
  showDepthLayer,
  showChainageLayer,
  returnPeriods,
  zones,
  depthSummary,
  openLayerId,
  onToggleInfo,
  chainageSelection = null,
}) => {
  const layers = [
    ...RETURN_PERIODS.map((years) => {
      const style = ZONE_STYLES[years]
      const stats = zones?.summary?.find((row) => row.years === years)
      return {
        id: String(years),
        title: `${style.label} flood`,
        checked: activeZones.includes(years),
        onChange: (checked) => {
          if (checked !== activeZones.includes(years)) onToggleZone(years)
        },
        subtitle: style.note,
        rows: [
          {
            label: `${Math.round(returnPeriods.levels[years])} m³/s`,
            color: style.color,
          },
          stats
            ? {
                label: `${Math.round(stats.meanWidthM)} m · ${stats.areaKm2.toFixed(1)} km²`,
                color: style.color,
              }
            : null,
        ].filter(Boolean),
      }
    }),
    {
      id: 'depth',
      title: 'Water depth',
      checked: showDepthLayer,
      hideCheck: true,
      subtitle: 'Classed depth 1.5–2.0 m · smoothed raster',
      rows: (depthSummary?.classes || []).map((row) => ({
        label: `${row.label} · ${row.range_label}`,
        color: row.color,
      })),
    },
    {
      id: 'chainage',
      title: 'Chainage',
      checked: showChainageLayer,
      hideCheck: true,
      subtitle: chainageSelection
        ? `Selected ${chainageSelection.bin.name} · station ${chainageSelection.station}`
        : 'Centreline stations every 100 m · 0+000 to 16+400',
      rows: [{ label: 'km marks and 100 m ticks', color: '#ffd166' }],
    },
    // The zone rows carry their own checkbox, so they stay listed when off.
  ].filter((layer) => !layer.hideCheck || layer.checked)

  return (
    <div className="flood-map-layers panel-embed" aria-label="Digital twin layers">
      {layers.map((layer) => {
        const isOpen = openLayerId === layer.id
        const inputId = `twin-layer-${layer.id}`
        return (
          <div
            key={layer.id}
            className={`flood-layer-card${layer.checked ? '' : ' is-off'}${isOpen ? ' is-open' : ''}`}
          >
            <div className="flood-layer-head">
              {layer.hideCheck ? (
                <span className="flood-layer-check-text">{layer.title}</span>
              ) : (
                <label className="flood-layer-check" htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={Boolean(layer.checked)}
                    onChange={(event) => layer.onChange(event.target.checked)}
                  />
                  <span className="flood-layer-check-text">{layer.title}</span>
                </label>
              )}
              <button
                type="button"
                className="flood-layer-info"
                aria-expanded={isOpen}
                aria-controls={`twin-info-${layer.id}`}
                onClick={() => onToggleInfo(layer.id)}
              >
                Info
                <span className="flood-layer-caret" aria-hidden="true" />
              </button>
            </div>
            {isOpen ? (
              <div className="flood-layer-body" id={`twin-info-${layer.id}`}>
                {layer.subtitle ? <small className="flood-layer-sub">{layer.subtitle}</small> : null}
                <div className="flood-layer-rows">
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
    </div>
  )
}

const FloodMapOverlay = ({
  onZonesChange,
  onAssetsChange,
  selectedAssetId = null,
  onSelectedAssetChange,
  showChainageLayer = true,
  showDepthLayer = true,
  focusChainage = null,
}) => {
  const [meta, setMeta] = useState(null)
  const [state, setState] = useState(null)
  const [margins, setMargins] = useState([])
  const [profile, setProfile] = useState(null)
  const [hydro, setHydro] = useState(null)
  const [selected, setSelected] = useState(null)
  const [lead, setLead] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [depthSummary, setDepthSummary] = useState(null)
  const [activeZones, setActiveZones] = useState(RETURN_PERIODS)
  const [openLayerId, setOpenLayerId] = useState('10')

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

  const loadLive = useCallback(async (metaData) => {
    const [stateData, marginData] = await Promise.all([fetchState(), fetchMargins()])
    setState(stateData)
    setMargins(marginData)
    onAssetsChange?.(marginData)
    if (metaData) setMeta(metaData)
    return marginData
  }, [onAssetsChange])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const metaData = await fetchMeta()
        if (cancelled) return
        setMeta(metaData)
        const marginData = await loadLive(metaData)
        if (cancelled) return
        const worst = [...marginData].sort(
          (a, b) => (b.p_exceed_72h ?? 0) - (a.p_exceed_72h ?? 0) || a.margin_now_m - b.margin_now_m
        )[0]
        setSelected(worst?.id || marginData[0]?.id || null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
      onAssetsChange?.(null)
      onSelectedAssetChange?.(null)
    }
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
    fetchProfile(lead)
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [lead, state])

  const asset = useMemo(
    () => margins.find((row) => row.id === selected) || margins[0] || null,
    [margins, selected]
  )

  const chainageSelection = useMemo(() => {
    if (!focusChainage) return null
    const bin = binBoundsForChainage(focusChainage.chainage_m)
    if (!bin) return null
    const isLast = bin.end_m >= 16400
    const inBin = margins.filter((row) => {
      const metres = Number(row.chainage_m)
      if (!Number.isFinite(metres)) return false
      return isLast
        ? metres >= bin.start_m && metres <= bin.end_m
        : metres >= bin.start_m && metres < bin.end_m
    })
    const nearest = [...inBin].sort(
      (a, b) =>
        Math.abs(a.chainage_m - focusChainage.chainage_m) -
        Math.abs(b.chainage_m - focusChainage.chainage_m),
    )[0]
    return {
      bin,
      station: focusChainage.name || formatChainage(focusChainage.chainage_m),
      chainage_m: focusChainage.chainage_m,
      lng: focusChainage.lng,
      lat: focusChainage.lat,
      assets: inBin,
      nearest,
      cell: meta ? cellForChainage(meta, focusChainage.chainage_m) : null,
    }
  }, [focusChainage, margins, meta])

  useEffect(() => {
    if (!chainageSelection?.nearest) return
    setSelected(chainageSelection.nearest.id)
  }, [chainageSelection])

  useEffect(() => {
    if (!selectedAssetId || selectedAssetId === selected) return
    if (!margins.some((row) => row.id === selectedAssetId)) return
    setSelected(selectedAssetId)
  }, [selectedAssetId, selected, margins])

  useEffect(() => {
    if (selected) onSelectedAssetChange?.(selected)
  }, [selected, onSelectedAssetChange])

  const selectAsset = (id) => {
    if (!id) return
    setSelected(id)
    onSelectedAssetChange?.(id)
  }

  useEffect(() => {
    if (!meta || !asset) return undefined
    let cancelled = false
    setHydro(null)
    fetchHydrograph(cellForChainage(meta, asset.chainage_m))
      .then((data) => !cancelled && setHydro(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [meta, asset, state])

  const toggleZone = (years) => {
    setActiveZones((current) =>
      current.includes(years) ? current.filter((v) => v !== years) : [...current, years]
    )
  }

  const toggleLayerInfo = (id) => {
    setOpenLayerId((current) => (current === id ? null : id))
  }

  const handleAdvance = async () => {
    setBusy(true)
    try {
      await advanceSim(6)
      await loadLive()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const layerPicker = (
    <LayerPanelPortal viewId="flood">
      <TwinLayerPicker
        activeZones={activeZones}
        onToggleZone={toggleZone}
        showDepthLayer={showDepthLayer}
        showChainageLayer={showChainageLayer}
        returnPeriods={returnPeriods}
        zones={zones}
        depthSummary={depthSummary}
        openLayerId={openLayerId}
        onToggleInfo={toggleLayerInfo}
        chainageSelection={chainageSelection}
      />
    </LayerPanelPortal>
  )

  if (error && !meta) {
    return (
      <div className="flood-map-overlays">
        {layerPicker}
        <aside className="flood-map-panel">
          <div className="flood-panel-head">
            <h3>
              Flood risk
              <small>Live twin unavailable</small>
            </h3>
          </div>
          <div className="flood-loading">{error}</div>
        </aside>
      </div>
    )
  }

  if (!meta || !margins.length) {
    return <div className="flood-map-overlays">{layerPicker}</div>
  }

  const overall = worstStatus(margins)
  const counts = countByStatus(margins)
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

  return (
    <div className="flood-map-overlays">
      {layerPicker}
      <aside className="flood-map-panel" aria-label="Flood forecast summary">
        <div className="flood-panel-head">
          <h3>
            Digital twin
            <small>Modelled discharge · WSE · margins · alerts</small>
          </h3>
          <span className="flood-provenance is-model">Model</span>
        </div>

        <div className="flood-stat-chips">
          <span>
            <em>Sim hour</em>t+{meta.sim_hour}
          </span>
          <span>
            <em>Discharge</em>
            {Number.isFinite(state?.q_now) ? `${state.q_now} m³/s` : '—'}
          </span>
          <span>
            <em>Lead</em>+{lead}h
          </span>
        </div>

        <div className="flood-lead-pills">
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

        <button type="button" className="flood-advance" onClick={handleAdvance} disabled={busy}>
          {busy ? 'Advancing…' : 'Advance simulation +6 h ▸'}
        </button>

        <div className="flood-panel-label">Overall status</div>
        <div className="flood-stat-chips">
          <span
            style={{
              color: STATUS_COLORS[overall],
              borderColor: STATUS_COLORS[overall],
            }}
          >
            <em>Worst asset</em>
            {overall}
          </span>
        </div>

        <div className="flood-panel-label">Assets by status</div>
        <div className="flood-status-bars">
          {['DANGER', 'WARNING', 'WATCH', 'SAFE'].map((status) => (
            <div className="flood-status-row" key={status}>
              <div className="flood-status-meta">
                <span>{status}</span>
                <strong>{counts[status] || 0}</strong>
              </div>
              <div className="flood-status-track">
                <div
                  className="flood-status-fill"
                  style={{
                    width: `${((counts[status] || 0) / margins.length) * 100}%`,
                    background: STATUS_COLORS[status],
                  }}
                />
              </div>
            </div>
          ))}
        </div>

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

        <div className="flood-panel-divider" />

        <div className="flood-live-section-head">
          <div>
            <h4>Chainage</h4>
            <small>
              {chainageSelection
                ? `Selected section ${chainageSelection.bin.name}`
                : 'Centreline stations every 100 m · 0+000 to 16+400'}
            </small>
          </div>
          {chainageSelection ? <span className="flood-provenance is-derived">Estimated</span> : null}
        </div>
        <div className="flood-zone-rows">
          <div className="flood-zone-row">
            <label className="flood-zone-check" htmlFor="flood-chainage">
              <input
                id="flood-chainage"
                type="checkbox"
                checked={showChainageLayer}
                onChange={() => onToggleChainage?.(!showChainageLayer)}
              />
              <span className="sw" style={{ background: '#ffd166' }} />
              <strong>Show chainage on map</strong>
            </label>
            <em>km boxes + 100 m ticks</em>
          </div>
        </div>
        {chainageSelection ? (
          <>
            <div className="flood-mini-grid">
              <span>
                <em>Section</em>
                {chainageSelection.bin.name}
              </span>
              <span>
                <em>Station</em>
                {chainageSelection.station}
              </span>
              <span>
                <em>Length</em>
                {(chainageSelection.bin.length_m / 1000).toFixed(1)} km
              </span>
              <span>
                <em>Twin cell</em>
                {chainageSelection.cell ?? '—'}
              </span>
            </div>
            <div className="flood-stat-chips" style={{ marginTop: 8 }}>
              <span>
                <em>Assets in section</em>
                {chainageSelection.assets.length}
              </span>
              <span>
                <em>Worst</em>
                {chainageSelection.assets.length
                  ? worstStatus(chainageSelection.assets)
                  : '—'}
              </span>
              {Number.isFinite(chainageSelection.lng) ? (
                <span>
                  <em>Location</em>
                  {chainageSelection.lat.toFixed(4)}, {chainageSelection.lng.toFixed(4)}
                </span>
              ) : null}
            </div>
            {chainageSelection.assets.length ? (
              <div className="flood-chainage-assets">
                {chainageSelection.assets.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`flood-chainage-asset${row.id === asset?.id ? ' is-on' : ''}`}
                    onClick={() => selectAsset(row.id)}
                  >
                    <span className="sw" style={{ background: STATUS_COLORS[row.status] }} />
                    <strong>{shortName(row.name || row.id)}</strong>
                    <em>{row.margin_now_m > 0 ? '+' : ''}{Number(row.margin_now_m).toFixed(2)} m</em>
                  </button>
                ))}
              </div>
            ) : (
              <p className="flood-depth-note">No twin assets sit in this kilometre.</p>
            )}
          </>
        ) : (
          <p className="flood-depth-note">
            Click a yellow kilometre box, a station, or the scale to see that section here.
          </p>
        )}

        <div className="flood-panel-divider" />

        <div className="flood-live-section-head">
          <div>
            <h4>Return-period flood zones</h4>
            <small>
              Khadakwasla annual peaks {returnPeriods.firstYear}–{returnPeriods.lastYear}
            </small>
          </div>
          <span className="flood-provenance is-derived">Estimated</span>
        </div>

        <div className="flood-zone-rows">
          {RETURN_PERIODS.map((years) => {
            const style = ZONE_STYLES[years]
            const stats = zones?.summary.find((row) => row.years === years)
            const inputId = `flood-zone-${years}`
            return (
              <div className="flood-zone-row" key={years}>
                <label className="flood-zone-check" htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={activeZones.includes(years)}
                    onChange={() => toggleZone(years)}
                  />
                  <span className="sw" style={{ background: style.color }} />
                  <strong>{style.label}</strong>
                </label>
                <em>{Math.round(returnPeriods.levels[years])} m³/s</em>
                {stats && (
                  <>
                    <span>{Math.round(stats.meanWidthM)} m wide</span>
                    <span>{stats.areaKm2.toFixed(1)} km²</span>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="flood-zone-caveat">
          Gumbel fit on {returnPeriods.years} published annual peaks, corridor scaled from the KML
          channel width · no DEM, not a surveyed flood line
        </div>

        <div className="flood-panel-label">Reach</div>
        <div className="flood-mini-grid">
          <span>
            <em>Length</em>{meta.reach_km} km
          </span>
          <span>
            <em>Cells</em>{meta.n_cells}
          </span>
          <span>
            <em>Members</em>{meta.members}
          </span>
          <span>
            <em>Horizon</em>{meta.forecast_hours}h
          </span>
        </div>
      </aside>

      <section className="flood-map-ribbon" aria-label="Flood margin board">
        <div className="flood-ribbon-main">
          <div className="flood-ribbon-head">
            <h2>Margin to threshold, end to end</h2>
            <span className="flood-provenance is-model">Model</span>
            <span className="flood-ribbon-lead">+{lead} h lead</span>
            <span
              className="flood-mode-pill"
              style={{ color: STATUS_COLORS[overall], borderColor: STATUS_COLORS[overall] }}
            >
              {overall}
            </span>
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
      </section>
    </div>
  )
}

export default FloodMapOverlay
