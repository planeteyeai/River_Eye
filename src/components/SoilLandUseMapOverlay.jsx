import React, { useEffect, useState } from 'react'
import './SoilLandUseMapOverlay.css'

const URBAN_VEG_URL = '/asset/mula-mutha-urban-vegetation.json'

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

/** Soil & land use overlay — urban vegetation type and health around the river. */
const SoilLandUseMapOverlay = ({
  showExtentLayer = true,
  onToggleExtent,
  showChainageLayer = false,
  onToggleChainage,
}) => {
  const [doc, setDoc] = useState(null)
  const [openInfoId, setOpenInfoId] = useState('type')

  useEffect(() => {
    let cancelled = false
    fetch(URBAN_VEG_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Urban vegetation → ${response.status}`)
        return response.json()
      })
      .then((json) => !cancelled && setDoc(json))
      .catch((error) => {
        console.error('Failed to load urban vegetation classes', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!doc) return null

  const typeLayer = doc.layers.find((layer) => layer.id === 'type')
  const healthLayer = doc.layers.find((layer) => layer.id === 'health')

  const infoRows = [
    { id: 'type', title: 'Vegetation type', layer: typeLayer, heading: 'Vegetation type' },
    { id: 'health', title: 'Vegetation health', layer: healthLayer, heading: 'Vegetation health' },
  ]

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  return (
    <div className="lulc-map-overlays">
      <div className="lulc-legend" aria-label="Urban vegetation classes">
        <div className="lulc-legend-title">
          <span className="lulc-check-text">Urban vegetation</span>
        </div>

        <label className="lulc-check lulc-extent-check" htmlFor="layer-urban-veg">
          <input
            id="layer-urban-veg"
            type="checkbox"
            checked={Boolean(showExtentLayer)}
            onChange={(event) => onToggleExtent?.(event.target.checked)}
          />
          <span>
            Show analysed area on map
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
      </div>
    </div>
  )
}

export default SoilLandUseMapOverlay
