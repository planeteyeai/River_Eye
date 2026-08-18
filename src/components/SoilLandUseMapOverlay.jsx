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
const SoilLandUseMapOverlay = ({ showExtentLayer = true, onToggleExtent }) => {
  const [doc, setDoc] = useState(null)

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
  const hasRaster = Boolean(doc.raster?.type || doc.raster?.health)

  return (
    <div className="lulc-map-overlays">
      <div className="lulc-legend" aria-label="Urban vegetation classes">
        <div className="lulc-legend-title">
          <span className="lulc-check-text">Urban vegetation</span>
          <small>
            {doc.sensor} · {doc.pixel_size_m} m · strict 1 km river buffer · {doc.captured}
          </small>
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

        {typeLayer && <ClassRows heading="Vegetation type" layer={typeLayer} />}
        {healthLayer && <ClassRows heading="Vegetation health" layer={healthLayer} />}

        {!hasRaster && (
          <p className="lulc-note">
            Shares come from the KML's own class tables. Its per-pixel overlay images were
            not part of the .kml export, so where the vegetation sits cannot be drawn —
            send the .kmz to map the pixels.
          </p>
        )}

        <div className="lulc-prov">Estimated · {doc.captured} classification</div>
      </div>
    </div>
  )
}

export default SoilLandUseMapOverlay
