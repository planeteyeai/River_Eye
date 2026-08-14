import React, { useMemo, useRef, useState, useEffect } from 'react'
import { BASEMAPS, BASEMAP_GROUPS, BASEMAP_MAP } from '../lib/basemaps'
import './MapLayersControl.css'

const MapLayersControl = ({ mapLayer, onLayerChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const activeLayer = useMemo(
    () => BASEMAP_MAP[mapLayer] || BASEMAPS[0],
    [mapLayer],
  )

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (layerId) => {
    onLayerChange(layerId)
    setIsOpen(false)
  }

  return (
    <div className="map-layers-control" ref={containerRef}>
      <button
        type="button"
        className={`map-layers-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Change basemap"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span
          className="map-layers-preview"
          style={{ background: activeLayer.preview }}
        />
        <div className="map-layers-toggle-text">
          <span className="map-layers-toggle-label">Basemap</span>
          <span className="map-layers-toggle-value">{activeLayer.label}</span>
        </div>
        <svg
          className={`map-layers-chevron ${isOpen ? 'rotated' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="map-layers-menu" role="listbox" aria-label="Map basemaps">
          <div className="map-layers-menu-header">
            <div className="map-layers-menu-title">Base Maps</div>
            <p className="map-layers-menu-subtitle">
              3D terrain maps, Google, Esri, and street styles
            </p>
          </div>

          <div className="map-layers-menu-body">
            {BASEMAP_GROUPS.map((group) => {
              const items = BASEMAPS.filter((b) => b.group === group)
              if (!items.length) return null

              return (
                <div key={group} className="map-layers-group">
                  <div className="map-layers-group-title">{group}</div>
                  <div className="map-layers-grid">
                    {items.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        role="option"
                        aria-selected={mapLayer === layer.id}
                        className={`map-layers-card ${mapLayer === layer.id ? 'active' : ''}`}
                        onClick={() => handleSelect(layer.id)}
                      >
                        <div
                          className="map-layers-card-preview"
                          style={{ background: layer.preview }}
                        >
                          {layer.mode3d && (
                            <span className="map-layers-badge-3d">3D</span>
                          )}
                        </div>
                        <div className="map-layers-card-body">
                          <div className="map-layers-card-header">
                            <span className="map-layers-card-label">{layer.label}</span>
                            {mapLayer === layer.id && (
                              <svg className="map-layers-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <p className="map-layers-card-desc">{layer.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default MapLayersControl
