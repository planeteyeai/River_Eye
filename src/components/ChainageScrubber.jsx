import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { formatChainage } from '../lib/chainageBins'
import './ChainageScrubber.css'

const CHAINAGE_GEOJSON_URL = '/asset/mula-mutha-chainage.geojson'
const STEP_M = 100

const stationsFromGeojson = (geojson) =>
  (geojson?.features || [])
    .filter((feature) => feature?.properties?.kind === 'station' && feature.geometry?.coordinates)
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates
      return {
        name: feature.properties.name,
        chainage_m: Number(feature.properties.chainage_m) || 0,
        major: Boolean(feature.properties.major),
        lng,
        lat,
      }
    })
    .filter((station) => Number.isFinite(station.lng) && Number.isFinite(station.lat))
    .sort((a, b) => a.chainage_m - b.chainage_m)

/** Interpolate map position along the station polyline for any chainage. */
const pointAtMetres = (stations, metres) => {
  if (!stations.length) return null
  const maxM = stations[stations.length - 1].chainage_m
  const clamped = Math.max(0, Math.min(maxM, metres))
  if (clamped <= stations[0].chainage_m) {
    const s = stations[0]
    return { ...s, chainage_m: clamped, name: formatChainage(clamped) }
  }
  for (let i = 1; i < stations.length; i += 1) {
    const a = stations[i - 1]
    const b = stations[i]
    if (clamped > b.chainage_m) continue
    const span = Math.max(1, b.chainage_m - a.chainage_m)
    const t = (clamped - a.chainage_m) / span
    return {
      name: formatChainage(clamped),
      chainage_m: clamped,
      major: clamped % 1000 === 0,
      lng: a.lng + (b.lng - a.lng) * t,
      lat: a.lat + (b.lat - a.lat) * t,
      nearestName: Math.abs(clamped - a.chainage_m) <= Math.abs(clamped - b.chainage_m) ? a.name : b.name,
    }
  }
  const last = stations[stations.length - 1]
  return { ...last, chainage_m: clamped, name: formatChainage(clamped) }
}

/**
 * Bottom chainage scrubber — visual design matches the product bar
 * (CHAINAGE · white scale · yellow square · value pill).
 */
const ChainageScrubber = ({ variant = 'map-edge', activeName, activeMetres, onSelect }) => {
  const [stations, setStations] = useState([])
  const trackRef = useRef(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(CHAINAGE_GEOJSON_URL, 'Chainage layer')
      .then((geojson) => {
        if (!cancelled) setStations(stationsFromGeojson(geojson))
      })
      .catch((error) => {
        console.error('Failed to load chainage bar', error)
        if (!cancelled) setStations([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxM = stations.length ? stations[stations.length - 1].chainage_m || 1 : 1

  const currentM = useMemo(() => {
    if (Number.isFinite(activeMetres)) return Math.max(0, Math.min(maxM, activeMetres))
    const byName = stations.find((station) => station.name === activeName)
    return byName ? byName.chainage_m : 0
  }, [activeMetres, activeName, stations, maxM])

  const playheadPct = maxM > 0 ? (currentM / maxM) * 100 : 0
  const valueLabel = formatChainage(currentM)

  const emitMetres = useCallback(
    (metres, scrub = false) => {
      const snapped = Math.round(metres / STEP_M) * STEP_M
      const exact = stations.find((station) => station.chainage_m === snapped)
      const point = exact
        ? { ...exact, nearestName: exact.name }
        : pointAtMetres(stations, snapped)
      if (!point) return
      onSelect?.({ ...point, scrub, at: Date.now() })
    },
    [stations, onSelect],
  )

  useEffect(() => {
    if (!stations.length) return
    if (Number.isFinite(activeMetres) || activeName) return
    emitMetres(0, false)
  }, [stations, activeName, activeMetres, emitMetres])

  const selectFromClientX = useCallback(
    (clientX, scrub) => {
      const track = trackRef.current
      if (!track || !stations.length) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      emitMetres(t * maxM, scrub)
    },
    [stations, maxM, emitMetres],
  )

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    selectFromClientX(event.clientX, true)
  }

  const onPointerMove = (event) => {
    if (!draggingRef.current) return
    selectFromClientX(event.clientX, true)
  }

  const onPointerUp = (event) => {
    draggingRef.current = false
    selectFromClientX(event.clientX, false)
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      /* already released */
    }
  }

  if (!stations.length) return null

  const pct = (metres) => `${(metres / maxM) * 100}%`

  return (
    <nav className={`chainage-scrubber is-${variant}`} aria-label="River chainage scrubber">
      <span className="chainage-scrubber-kicker">Chainage</span>
      <div
        className="chainage-scrubber-track"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={maxM}
        aria-valuenow={currentM}
        aria-valuetext={valueLabel}
        aria-label="Scrub along river chainage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            emitMetres(currentM - STEP_M, false)
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            emitMetres(currentM + STEP_M, false)
          } else if (event.key === 'Home') {
            event.preventDefault()
            emitMetres(0, false)
          } else if (event.key === 'End') {
            event.preventDefault()
            emitMetres(maxM, false)
          }
        }}
      >
        <div className="chainage-scale-line" aria-hidden="true" />
        {stations.map((station) => {
          const isMajor = station.major || station.chainage_m === 0 || station === stations[stations.length - 1]
          return (
            <span
              key={station.name}
              className={`chainage-tick${isMajor ? ' is-major' : ' is-minor'}`}
              style={{ left: pct(station.chainage_m) }}
              aria-hidden="true"
            >
              <span className="chainage-tick-mark" />
              {isMajor ? <span className="chainage-tick-label">{station.name}</span> : null}
            </span>
          )
        })}
        <div className="chainage-playhead" style={{ left: `${playheadPct}%` }} aria-hidden="true">
          <span className="chainage-playhead-knob" />
          <span className="chainage-playhead-label">{valueLabel}</span>
        </div>
      </div>
    </nav>
  )
}

export default ChainageScrubber
