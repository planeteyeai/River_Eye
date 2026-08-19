import React, { useEffect, useState } from 'react'
import './SoilLandUseMapOverlay.css'
import { fetchAssetJson } from '../lib/fetchAssetJson'

const URBAN_VEG_URL = '/asset/mula-mutha-urban-vegetation.json'
const SILT_URL = '/asset/mula-mutha-silt.json'

const ClassRows = ({ heading, layer }) => (
  <div className="lulc-group">
    <div className="lulc-group-head">
      <span>{heading}</span>
      <em>{layer.total_area_ha} ha</em>
    </div>
    {layer.classes.map((row) => (
      <div className="lulc-class" key={`${layer.id}-${row.class}`}>
        <div className="lulc-class-meta">
          <span className="lulc-sw" style={{ background: row.color }} />
          <span className="lulc-label">{row.label}</span>
          <span className="lulc-val">{row.area_ha} ha</span>
          <strong className="lulc-pct">{row.share_pct}%</strong>
        </div>
        <div className="lulc-track">
          <div
            className="lulc-fill"
            style={{ width: `${row.share_pct}%`, background: row.color }}
          />
        </div>
      </div>
    ))}
  </div>
)

/** Soil & land use overlay — urban vegetation plus monthly silt rasters. */
const SoilLandUseMapOverlay = ({
  showExtentLayer = true,
  onToggleExtent,
  showSiltClassLayer = true,
  onToggleSiltClass,
  showSiltVolumeLayer = false,
  onToggleSiltVolume,
  siltPeriodId = 5,
  onSiltPeriodChange,
  showChainageLayer = false,
  onToggleChainage,
}) => {
  const [doc, setDoc] = useState(null)
  const [silt, setSilt] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [openInfoId, setOpenInfoId] = useState('silt')

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(URBAN_VEG_URL, 'Urban vegetation')
      .then((json) => !cancelled && setDoc(json))
      .catch((error) => {
        console.error('Failed to load urban vegetation classes', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(SILT_URL, 'Silt classification')
      .then((json) => !cancelled && setSilt(json))
      .catch((error) => {
        console.error('Failed to load silt classification', error)
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const typeLayer = doc?.layers?.find((layer) => layer.id === 'type')
  const healthLayer = doc?.layers?.find((layer) => layer.id === 'health')
  const infoRows = [
    { id: 'type', title: 'Vegetation type', layer: typeLayer, heading: 'Vegetation type' },
    { id: 'health', title: 'Vegetation health', layer: healthLayer, heading: 'Vegetation health' },
  ]

  const periods = silt?.periods || []
  const active = periods.find((row) => row.id === siltPeriodId) || periods[0]
  const classLayer = active?.classification
    ? {
        id: 'silt',
        total_area_ha: active.classification.total_area_ha,
        classes: active.classification.classes,
      }
    : null
  const maxVeryHigh = Math.max(...periods.map((row) => (
    row.classification?.classes?.find((cls) => cls.class === 4)?.share_pct || 0
  )), 1)

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  return (
    <div className="lulc-map-overlays">
      <div className="lulc-legend" aria-label="Soil and land use layers">
        <div className="lulc-legend-title">
          <span className="lulc-check-text">Soil & land use</span>
        </div>

        <label className="lulc-check" htmlFor="layer-silt-class">
          <input
            id="layer-silt-class"
            type="checkbox"
            checked={Boolean(showSiltClassLayer)}
            onChange={(event) => onToggleSiltClass?.(event.target.checked)}
          />
          <span className="lulc-sw" style={{ background: '#e51f1f' }} />
          <span className="lulc-check-text">Silt classification</span>
        </label>
        <label className="lulc-check" htmlFor="layer-silt-volume">
          <input
            id="layer-silt-volume"
            type="checkbox"
            checked={Boolean(showSiltVolumeLayer)}
            onChange={(event) => onToggleSiltVolume?.(event.target.checked)}
          />
          <span className="lulc-sw lulc-sw-volume" />
          <span className="lulc-check-text">Silt volume surface</span>
        </label>

        {loadError ? (
          <p className="lulc-note">Silt rasters did not load. {loadError}</p>
        ) : null}

        {active && classLayer ? (
          <>
            <div className="lulc-period-head">
              <strong>{active.label}</strong>
              <span>{classLayer.total_area_ha} ha classed</span>
            </div>
            <div className="lulc-months" role="tablist" aria-label="Silt month">
              {periods.map((row) => {
                const veryHigh = row.classification?.classes?.find((cls) => cls.class === 4)?.share_pct || 0
                const selected = row.id === active.id
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`lulc-month${selected ? ' is-on' : ''}`}
                    onClick={() => onSiltPeriodChange?.(row.id)}
                    title={`${row.label} · very high ${veryHigh}%`}
                  >
                    <span
                      className="lulc-month-bar"
                      style={{ height: `${Math.max(8, (veryHigh / maxVeryHigh) * 100)}%` }}
                    />
                    <em>{row.label.slice(0, 3)}</em>
                  </button>
                )
              })}
            </div>
            <div className={`lulc-info-drop${openInfoId === 'silt' ? ' is-open' : ''}`}>
              <div className="lulc-info-head">
                <span className="lulc-check-text">Silt classes</span>
                <button
                  type="button"
                  className="lulc-info-toggle"
                  aria-expanded={openInfoId === 'silt'}
                  onClick={() => toggleInfo('silt')}
                >
                  Info
                  <span className="lulc-info-caret" aria-hidden="true" />
                </button>
              </div>
              {openInfoId === 'silt' ? (
                <div className="lulc-info-body">
                  <ClassRows heading="Relative silt class" layer={classLayer} />
                  {showSiltVolumeLayer ? (
                    <div className="lulc-volume-scale">
                      <span>0</span>
                      <span className="lulc-volume-bar" />
                      <span>{active.volume?.scale_max}</span>
                      <em>volume scale shared Jan-Jul · unit unconfirmed</em>
                    </div>
                  ) : null}
                  {silt.csv ? (
                    <p className="lulc-note">
                      Workbook window {silt.csv.start_date} to {silt.csv.end_date}:
                      water {silt.csv.water_area_ha} ha, mean score {silt.csv.mean_silt_score}.
                      Those areas are one composite, not the month on the map.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <label className="lulc-check lulc-extent-check" htmlFor="layer-urban-veg">
          <input
            id="layer-urban-veg"
            type="checkbox"
            checked={Boolean(showExtentLayer)}
            onChange={(event) => onToggleExtent?.(event.target.checked)}
          />
          <span>
            Vegetation extent
            <em>outline only — the box is the image canvas, not the vegetation</em>
          </span>
        </label>
        <label className="lulc-check" htmlFor="layer-lulc-chainage">
          <input
            id="layer-lulc-chainage"
            type="checkbox"
            checked={Boolean(showChainageLayer)}
            onChange={(event) => onToggleChainage?.(event.target.checked)}
          />
          <span className="lulc-check-text">Chainage</span>
        </label>

        {infoRows.map((row) => {
          if (!row.layer) return null
          const isOpen = openInfoId === row.id
          return (
            <div
              key={row.id}
              className={`lulc-info-drop${isOpen ? ' is-open' : ''}`}
            >
              <div className="lulc-info-head">
                <span className="lulc-check-text">{row.title}</span>
                <button
                  type="button"
                  className="lulc-info-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`lulc-urban-info-${row.id}`}
                  onClick={() => toggleInfo(row.id)}
                >
                  Info
                  <span className="lulc-info-caret" aria-hidden="true" />
                </button>
              </div>
              {isOpen ? (
                <div className="lulc-info-body" id={`lulc-urban-info-${row.id}`}>
                  <ClassRows heading={row.heading} layer={row.layer} />
                </div>
              ) : null}
            </div>
          )
        })}
        <p className="lulc-prov">Estimated · Sentinel-2 classed product, not a bed survey</p>
      </div>
    </div>
  )
}

export default SoilLandUseMapOverlay
