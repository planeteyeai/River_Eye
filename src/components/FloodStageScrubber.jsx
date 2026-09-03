import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  defaultFloodStageM,
  formatInundationArea,
  formatInundationVolume,
  loadDtmGrid,
  summarizeInundation,
} from '../lib/dtmInundation'
import './FloodStageScrubber.css'

/**
 * Flood stage scrubber — bathtub fill against the FABDEM DTM.
 * Drives MapComponent via onStageChange({ metres, meta }).
 */
const FloodStageScrubber = ({ enabled = false, stageM = null, onStageChange }) => {
  const [meta, setMeta] = useState(null)
  const [elevations, setElevations] = useState(null)
  const [error, setError] = useState(null)
  const onStageChangeRef = useRef(onStageChange)
  onStageChangeRef.current = onStageChange
  const seededRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false
      return undefined
    }
    let cancelled = false
    loadDtmGrid()
      .then(({ meta: next, elevations: grid }) => {
        if (cancelled) return
        setMeta(next)
        setElevations(grid)
        setError(null)
        if (!seededRef.current && !Number.isFinite(stageM)) {
          seededRef.current = true
          onStageChangeRef.current?.({ metres: defaultFloodStageM(next), meta: next })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load DTM')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, stageM])

  const min = meta?.elevation_min_m ?? 529
  const max = meta?.elevation_max_m ?? 592
  const value = Number.isFinite(stageM) ? stageM : defaultFloodStageM(meta)

  const stats = useMemo(
    () => (elevations && meta ? summarizeInundation(elevations, meta, value) : null),
    [elevations, meta, value],
  )

  if (!enabled) return null

  return (
    <div className="flood-stage-scrubber" aria-label="Flood stage scrubber">
      <div className="flood-stage-scrubber-head">
        <strong>Flood stage</strong>
        <span className="flood-stage-provenance">Estimated · FABDEM</span>
        <em>{Number.isFinite(value) ? `${value.toFixed(1)} m` : '—'}</em>
      </div>
      {error ? (
        <p className="flood-stage-error">{error}</p>
      ) : (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={0.25}
            value={value}
            disabled={!meta}
            onChange={(event) =>
              onStageChangeRef.current?.({ metres: Number(event.target.value), meta })
            }
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label="Water surface elevation"
          />
          <div className="flood-stage-scrubber-meta">
            <span>{min.toFixed(0)} m</span>
            <span>
              {stats
                ? `${stats.wetSharePct.toFixed(0)}% of DTM cells ≤ stage`
                : 'Loading DTM…'}
            </span>
            <span>{max.toFixed(0)} m</span>
          </div>
          {stats && (
            <div className="flood-stage-stats" title="Bathtub fill on FABDEM cells — not a hydraulic volume">
              <div>
                <span className="flood-stage-stats-label">Area</span>
                <strong>{formatInundationArea(stats)}</strong>
              </div>
              <div>
                <span className="flood-stage-stats-label">Volume</span>
                <strong>{formatInundationVolume(stats)}</strong>
              </div>
              <div>
                <span className="flood-stage-stats-label">Mean depth</span>
                <strong>
                  {stats.wetCells > 0 ? `${stats.meanDepthM.toFixed(2)} m` : '—'}
                </strong>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FloodStageScrubber
