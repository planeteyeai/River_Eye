import React, { useEffect, useState } from 'react'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import './GeologyMapOverlay.css'

const TRIB_URL = '/asset/mula-mutha-tributaries.geojson'
const EROSION_URL = '/asset/mula-mutha-erosion-hotspots.json'
const EROSION_SERIES_URL = '/asset/mula-mutha-bank-erosion-series.json'

const GeologyMapOverlay = ({
  showErosionLayer = true,
  onToggleErosion,
  showTributaryLayer = true,
  onToggleTributaries,
  showMainStemLayer = false,
  onToggleMainStem,
  showChainageLayer = false,
  onToggleChainage,
  onOpenBathymetry,
}) => {
  const [doc, setDoc] = useState(null)
  const [erosion, setErosion] = useState(null)
  const [series, setSeries] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(TRIB_URL, 'Joining streams')
      .then((json) => !cancelled && setDoc(json))
      .catch((error) => {
        console.error('Failed to load joining streams', error)
      })
    fetchAssetJson(EROSION_URL, 'Erosion hotspots')
      .then((json) => !cancelled && setErosion(json))
      .catch((error) => {
        console.error('Failed to load erosion hotspots', error)
      })
    fetchAssetJson(EROSION_SERIES_URL, 'Bank erosion series')
      .then((json) => !cancelled && setSeries(json))
      .catch((error) => {
        console.error('Failed to load bank erosion series', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const classes = (doc?.classes || []).filter((row) => row.id !== 'mainstem')
  const mainStem = (doc?.classes || []).find((row) => row.id === 'mainstem')

  return (
    <div className="geo-map-overlays">
      <div className="geo-legend" aria-label="Geology layers">
        <div className="geo-legend-title">
          <span>Geology</span>
          <em>2016–2026</em>
        </div>
        <p className="geo-note">
          Bank erosion hotspot = number of year-to-year periods with detected erosion, clipped to
          the Mula–Mutha AOI. Joining streams are OSM waterways.
        </p>

        <label className="geo-check" htmlFor="layer-erosion">
          <input
            id="layer-erosion"
            type="checkbox"
            checked={Boolean(showErosionLayer)}
            onChange={(event) => onToggleErosion?.(event.target.checked)}
          />
          <span className="geo-check-text">
            Bank erosion hotspots
            <em>2016–2026 · classified overlay</em>
          </span>
        </label>

        <div className={`geo-classes${showErosionLayer ? '' : ' is-off'}`}>
          {(erosion?.classes || []).map((row) => (
            <div className="geo-class" key={row.id}>
              <span className="geo-sw" style={{ background: row.color }} />
              <span>{row.label}</span>
              <strong>{row.share_pct}%</strong>
            </div>
          ))}
        </div>
        <p className="geo-note">Hotspot = year-to-year periods with erosion</p>

        {series ? (
          <div className="geo-series">
            <div className="geo-series-head">
              <span>Bank change</span>
              <em>
                {series.satellite} · {series.resolution_m} m
              </em>
            </div>
            <div className="geo-stat-chips">
              <span>
                <em>Erosion</em>
                {series.totals.erosion_ha} ha
              </span>
              <span>
                <em>Accretion</em>
                {series.totals.accretion_ha} ha
              </span>
              <span>
                <em>Net</em>
                {series.totals.net_ha > 0 ? '+' : ''}
                {series.totals.net_ha} ha
              </span>
            </div>
            <div className="geo-series-rows">
              {series.periods.map((row) => {
                const maxHa = series.totals.max_bar_ha || 1
                return (
                  <div className="geo-series-row" key={row.period}>
                    <strong>{row.period}</strong>
                    <div className="geo-series-bars" title={`Erosion ${row.erosion_ha} ha · accretion ${row.accretion_ha} ha`}>
                      <i style={{ width: `${(row.erosion_ha / maxHa) * 100}%`, background: '#c2372a' }} />
                      <i className="is-acc" style={{ width: `${(row.accretion_ha / maxHa) * 100}%`, background: '#1c8a55' }} />
                    </div>
                    <em className={row.net_ha < 0 ? 'is-loss' : 'is-gain'}>
                      {row.net_ha > 0 ? '+' : ''}
                      {row.net_ha}
                    </em>
                  </div>
                )
              })}
            </div>
            <p className="geo-note">
              Red = erosion, green = accretion, ha. 2025–2026 is Jan–Aug 2026, not a full year.
              MNDWI threshold {series.mndwi_threshold}. Negative net is net erosion.
            </p>
          </div>
        ) : null}

        <label className="geo-check" htmlFor="layer-tributaries">
          <input
            id="layer-tributaries"
            type="checkbox"
            checked={Boolean(showTributaryLayer)}
            onChange={(event) => onToggleTributaries?.(event.target.checked)}
          />
          <span className="geo-check-text">Joining streams</span>
        </label>

        <div className={`geo-classes${showTributaryLayer ? '' : ' is-off'}`}>
          {classes.map((row) => (
            <div className="geo-class" key={row.id}>
              <span className="geo-sw" style={{ background: row.color }} />
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>

        <label className="geo-check" htmlFor="layer-mainstem">
          <input
            id="layer-mainstem"
            type="checkbox"
            checked={Boolean(showMainStemLayer)}
            onChange={(event) => onToggleMainStem?.(event.target.checked)}
          />
          <span className="geo-sw" style={{ background: mainStem?.color || '#1d4e89' }} />
          <span className="geo-check-text">
            Main stem
            <em>Mula / Mutha already drawn from the river KML</em>
          </span>
        </label>

        <label className="geo-check" htmlFor="layer-geo-chainage">
          <input
            id="layer-geo-chainage"
            type="checkbox"
            checked={Boolean(showChainageLayer)}
            onChange={(event) => onToggleChainage?.(event.target.checked)}
          />
          <span className="geo-check-text">Chainage</span>
        </label>

        <button type="button" className="geo-bathy-btn" onClick={() => onOpenBathymetry?.()}>
          Open bathymetry dashboard
        </button>
        <p className="geo-prov">Estimated · Landsat MNDWI series + erosion KMZ + OSM waterways</p>
      </div>
    </div>
  )
}

export default GeologyMapOverlay
