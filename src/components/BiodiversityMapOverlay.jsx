import React, { useEffect, useState } from 'react'
import './SoilLandUseMapOverlay.css'
import { fetchAssetJson } from '../lib/fetchAssetJson'

const BIODIV_URL = '/asset/mula-mutha-biodiversity.json'

const ClassRows = ({ layer }) => (
  <div className="lulc-group">
    <div className="lulc-group-head">
      <span>{layer.title}</span>
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

/** Biodiversity overlay — vegetation type and health rasters from KMZ. */
const BiodiversityMapOverlay = ({
  showTypeLayer = true,
  showHealthLayer = false,
  onToggleType,
  onToggleHealth,
  showChainageLayer = false,
  onToggleChainage,
}) => {
  const [doc, setDoc] = useState(null)
  const [openInfoId, setOpenInfoId] = useState('type')

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(BIODIV_URL, 'Biodiversity')
      .then((json) => !cancelled && setDoc(json))
      .catch((error) => {
        console.error('Failed to load biodiversity vegetation classes', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!doc) return null

  const typeLayer = doc.layers?.find((layer) => layer.id === 'type')
  const healthLayer = doc.layers?.find((layer) => layer.id === 'health')

  const rows = [
    {
      id: 'type',
      title: 'Vegetation type',
      checked: showTypeLayer,
      onChange: onToggleType,
      layer: typeLayer,
      inputId: 'layer-biodiv-type',
    },
    {
      id: 'health',
      title: 'Vegetation health',
      checked: showHealthLayer,
      onChange: onToggleHealth,
      layer: healthLayer,
      inputId: 'layer-biodiv-health',
    },
  ]

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  return (
    <div className="lulc-map-overlays">
      <div className="lulc-legend" aria-label="Biodiversity vegetation classes">
        <div className="lulc-legend-title">
          <span className="lulc-check-text">Biodiversity</span>
        </div>

        {rows.map((row) => {
          const isOpen = openInfoId === row.id
          return (
            <div
              key={row.id}
              className={`lulc-info-drop${row.checked ? '' : ' is-off'}${isOpen ? ' is-open' : ''}`}
            >
              <div className="lulc-info-head">
                <label className="lulc-check" htmlFor={row.inputId}>
                  <input
                    id={row.inputId}
                    type="checkbox"
                    checked={Boolean(row.checked)}
                    onChange={(event) => row.onChange?.(event.target.checked)}
                  />
                  <span className="lulc-check-text">{row.title}</span>
                </label>
                <button
                  type="button"
                  className="lulc-info-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`lulc-info-${row.id}`}
                  onClick={() => toggleInfo(row.id)}
                >
                  Info
                  <span className="lulc-info-caret" aria-hidden="true" />
                </button>
              </div>
              {isOpen && row.layer ? (
                <div className="lulc-info-body" id={`lulc-info-${row.id}`}>
                  <ClassRows layer={row.layer} />
                </div>
              ) : null}
            </div>
          )
        })}

        <label className="lulc-check" htmlFor="layer-biodiv-chainage">
          <input
            id="layer-biodiv-chainage"
            type="checkbox"
            checked={Boolean(showChainageLayer)}
            onChange={(event) => onToggleChainage?.(event.target.checked)}
          />
          <span className="lulc-check-text">Chainage</span>
        </label>
      </div>
    </div>
  )
}

export default BiodiversityMapOverlay
