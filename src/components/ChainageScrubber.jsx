import React, { useEffect, useMemo, useState } from 'react'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import './ChainageScrubber.css'

const CHAINAGE_GEOJSON_URL = '/asset/mula-mutha-chainage.geojson'

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

const ChainageScrubber = ({ variant = 'map-edge', activeName, onSelect }) => {
  const [stations, setStations] = useState([])

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

  const majors = useMemo(
    () => stations.filter((station, index) => station.major || index === stations.length - 1),
    [stations],
  )

  if (!stations.length) return null

  const maxM = stations[stations.length - 1].chainage_m || 1
  const pct = (metres) => `${(metres / maxM) * 100}%`
  const activeIndex = Math.max(
    0,
    stations.findIndex((station) => station.name === activeName),
  )
  const step = (delta) => {
    const next = stations[Math.min(stations.length - 1, Math.max(0, activeIndex + delta))]
    if (next) onSelect?.(next)
  }

  return (
    <nav className={`chainage-scrubber is-${variant}`} aria-label="River chainage scale">
      <span className="chainage-scrubber-kicker">Chainage</span>
      <button
        type="button"
        className="chainage-step"
        aria-label="Previous 100 metres"
        title="Back 100 m"
        onClick={() => step(-1)}
        disabled={activeIndex <= 0}
      >
        ‹
      </button>
      <div className="chainage-scrubber-track" role="list">
        <div className="chainage-scale-line" aria-hidden="true" />
        {stations.map((station) => (
          <button
            key={station.name}
            type="button"
            role="listitem"
            className={`chainage-tick${station.name === activeName ? ' is-active' : ''}${station.major || station === majors[majors.length - 1] ? ' is-major' : ' is-minor'}`}
            style={{ left: pct(station.chainage_m) }}
            title={`Go to ${station.name}`}
            onClick={() => onSelect?.(station)}
          >
            <span className="chainage-tick-mark" />
            {station.major || station === majors[majors.length - 1] ? (
              <span className="chainage-tick-label">{station.name}</span>
            ) : null}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="chainage-step"
        aria-label="Next 100 metres"
        title="Forward 100 m"
        onClick={() => step(1)}
        disabled={activeIndex >= stations.length - 1}
      >
        ›
      </button>
      <span className="chainage-scrubber-unit">100 m</span>
    </nav>
  )
}

export default ChainageScrubber
