import React, { useEffect, useState } from 'react'
import './ClimateImpactMapOverlay.css'
import { fetchAssetJson } from '../lib/fetchAssetJson'

const INDEX_URL = '/asset/mula-mutha-flood-water.json'

const formatDay = (iso) => {
  if (!iso) return ''
  const [, month, day] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(day)} ${months[Number(month) - 1]}`
}

const ClimateImpactMapOverlay = ({
  periodId = 4,
  onPeriodChange,
  showFloodHeat = true,
  showWaterHeat = true,
  onToggleFlood,
  onToggleWater,
  showChainageLayer = false,
  onToggleChainage,
}) => {
  const [doc, setDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(INDEX_URL, 'Flood water timeseries')
      .then((json) => {
        if (!cancelled) setDoc(json)
      })
      .catch((error) => {
        console.error('Failed to load flood water timeseries', error)
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
      <div className="climate-map-overlays">
        <div className="climate-legend" aria-label="Climate impact heatmap unavailable">
          <div className="climate-legend-title">
            <span>Climate impact</span>
            <em>Unavailable</em>
          </div>
          <p className="climate-note">
            The flood and surface-water timeseries did not load, so no heatmap is drawn. {loadError}
          </p>
        </div>
      </div>
    )
  }

  if (!doc?.periods?.length) return null

  const periods = doc.periods
  const active = periods.find((row) => row.id === periodId) || periods[0]
  const maxFlood = Math.max(...periods.map((row) => row.flood_area_ha), 1)
  const maxWater = Math.max(...periods.map((row) => row.water_area_ha), 1)

  return (
    <div className="climate-map-overlays">
      <div className="climate-legend" aria-label="Climate impact flood water heatmap">
        <div className="climate-legend-title">
          <span>Climate impact</span>
          <em>Flood water heatmap</em>
        </div>
        <p className="climate-note">
          Seven image pairs, {doc.captured}. Density of classed water and flood points — not a surveyed flood line.
        </p>

        <label className="climate-check" htmlFor="climate-flood-heat">
          <input
            id="climate-flood-heat"
            type="checkbox"
            checked={showFloodHeat}
            onChange={(event) => onToggleFlood?.(event.target.checked)}
          />
          <span className="climate-sw" style={{ background: doc.classes.flood.color }} />
          <span>Flood water heatmap</span>
        </label>
        <label className="climate-check" htmlFor="climate-water-heat">
          <input
            id="climate-water-heat"
            type="checkbox"
            checked={showWaterHeat}
            onChange={(event) => onToggleWater?.(event.target.checked)}
          />
          <span className="climate-sw" style={{ background: doc.classes.water.color }} />
          <span>Permanent water heatmap</span>
        </label>
        <label className="climate-check" htmlFor="climate-chainage">
          <input
            id="climate-chainage"
            type="checkbox"
            checked={Boolean(showChainageLayer)}
            onChange={(event) => onToggleChainage?.(event.target.checked)}
          />
          <span className="climate-sw" style={{ background: '#ffd166' }} />
          <span>Chainage</span>
        </label>

        <div className="climate-period-head">
          <strong>
            {formatDay(active.pre_date)} → {formatDay(active.post_date)}
          </strong>
          <span className="climate-year">{active.post_date.slice(0, 4)}</span>
        </div>
        <div className="climate-stats">
          <span>
            <em>Flood</em>
            {active.flood_area_ha.toFixed(1)} ha
          </span>
          <span>
            <em>Water</em>
            {active.water_area_ha.toFixed(1)} ha
          </span>
        </div>

        <div className="climate-bars" role="img" aria-label="Flood area by period">
          {periods.map((row) => {
            const selected = row.id === active.id
            return (
              <button
                key={row.id}
                type="button"
                className={`climate-bar ${selected ? 'is-on' : ''}`}
                onClick={() => onPeriodChange?.(row.id)}
                title={`${formatDay(row.pre_date)} → ${formatDay(row.post_date)} · flood ${row.flood_area_ha} ha`}
              >
                <span
                  className="climate-bar-water"
                  style={{ height: `${Math.max(6, (row.water_area_ha / maxWater) * 100)}%` }}
                />
                <span
                  className="climate-bar-flood"
                  style={{ height: `${Math.max(4, (row.flood_area_ha / maxFlood) * 100)}%` }}
                />
                <em>{Number(row.post_date.slice(8, 10))}/{Number(row.post_date.slice(5, 7))}</em>
              </button>
            )
          })}
        </div>
        <div className="climate-bar-caption">Tap a column to change the pair · red = flood area, blue = water area</div>
        <p className="climate-provenance">Estimated · classed points from flood_water_timeseries.xlsx</p>
      </div>
    </div>
  )
}

export default ClimateImpactMapOverlay
