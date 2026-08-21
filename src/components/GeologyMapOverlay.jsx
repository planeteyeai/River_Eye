import React, { useEffect, useState } from 'react'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { LayerPanelPortal } from './LayerPanelSlots'
import './GeologyMapOverlay.css'

const EROSION_SERIES_URL = '/asset/mula-mutha-bank-erosion-series.json'

/** Geology detail — rendered inside the Geology group of the Layers panel. */
const GeologyMapOverlay = () => {
  const [series, setSeries] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(EROSION_SERIES_URL, 'Bank erosion series')
      .then((json) => !cancelled && setSeries(json))
      .catch((error) => {
        console.error('Failed to load bank erosion series', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <LayerPanelPortal viewId="geology">
      <div className="geo-embed panel-embed" aria-label="Geology detail">
        <p className="geo-note">
          Bank erosion hotspot = number of year-to-year periods with detected erosion, clipped to
          the Mula–Mutha AOI. Joining streams are OSM waterways. Spectral lithology is a provisional
          classed surface-material overlay (separate Layers checkbox).
        </p>

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

        <p className="geo-prov">Estimated · Landsat MNDWI series + erosion KMZ + spectral lithology KMZ + OSM waterways</p>
      </div>
    </LayerPanelPortal>
  )
}

export default GeologyMapOverlay
