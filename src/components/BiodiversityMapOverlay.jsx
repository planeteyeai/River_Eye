import React, { useEffect, useState } from 'react'
import './SoilLandUseMapOverlay.css'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { LayerPanelPortal } from './LayerPanelSlots'

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

/** Biodiversity detail — rendered inside the Biodiversity group of the Layers panel. */
const BiodiversityMapOverlay = ({ showTypeLayer = true, showHealthLayer = false }) => {
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
      layer: typeLayer,
    },
    {
      id: 'health',
      title: 'Vegetation health',
      checked: showHealthLayer,
      layer: healthLayer,
    },
  ].filter((row) => row.checked)

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  return (
    <LayerPanelPortal viewId="biodiversity">
      <div className="lulc-embed panel-embed" aria-label="Biodiversity vegetation classes">
        {rows.map((row) => {
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
      </div>
    </LayerPanelPortal>
  )
}

export default BiodiversityMapOverlay
