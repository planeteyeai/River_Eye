import React, { useEffect, useRef, useState } from 'react'
import { legendForLayer } from '../lib/layerLegends'
import { CLASS_HOVER_EVENT } from '../lib/classRasterHover'
import { LayerPanelSlot } from './LayerPanelSlots'
import './MapViewsControl.css'

const IconAqi = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)

const IconWater = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15l3-5 3 3 4-7" />
  </svg>
)

const IconLand = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21V9" />
    <path d="M12 13c-3.5 0-5-2.5-5-5.5C10.5 7.5 12 10 12 13z" />
    <path d="M12 11c0-3 1.5-5.5 5-6 0 3.5-1.5 6-5 6z" />
    <path d="M4 21h16" />
  </svg>
)

const IconBiodiv = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
    <path d="M12 11v6" />
    <path d="M9 14h6" />
  </svg>
)

const IconClimate = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v3" />
    <path d="M12 18v3" />
    <path d="M5.6 5.6l2.1 2.1" />
    <path d="M16.3 16.3l2.1 2.1" />
    <path d="M3 12h3" />
    <path d="M18 12h3" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

const IconTwin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 7c2.5-2 5 2 7.5 0S14.5 5 17 7s3 1.5 5 0" />
    <path d="M2 13c2.5-2 5 2 7.5 0S14.5 11 17 13s3 1.5 5 0" />
    <path d="M2 19c2.5-2 5 2 7.5 0S14.5 17 17 19s3 1.5 5 0" />
  </svg>
)

const IconGeology = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 20h18" />
    <path d="M5 20 9 9l3 6 3-4 4 9" />
    <path d="M8 14h3" />
  </svg>
)

const IconSalinity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3c-2 4-6 6-6 10a6 6 0 0 0 12 0c0-4-4-6-6-10z" />
    <path d="M8 14h8" />
    <path d="M9 17h6" />
  </svg>
)

const IconPollution = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v4" />
    <path d="M9 7h6" />
    <path d="M8 11c0 4 1.5 7 4 9 2.5-2 4-5 4-9H8z" />
    <path d="M10 14h4" />
  </svg>
)

const IconChevron = ({ left = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    {left ? (
      <polyline points="15 6 9 12 15 18" />
    ) : (
      <polyline points="9 6 15 12 9 18" />
    )}
  </svg>
)

export const VIEW_GROUPS = [
  {
    id: 'geology',
    label: 'Geology',
    accent: 'geology',
    title: 'Spectral lithology, bank erosion, joining streams and bathymetry',
    Icon: IconGeology,
  },
  {
    id: 'waterquality',
    label: 'Water quality',
    accent: 'water',
    title: 'TSS, NDCI, NDWI, WST and BOD–COD',
    Icon: IconWater,
  },
  {
    id: 'salinity',
    label: 'Salinity',
    accent: 'water',
    title: 'NDSI salinity index (Odeh & Onus 2008)',
    Icon: IconSalinity,
  },
  {
    id: 'pollution',
    label: 'Pollution',
    accent: 'climate',
    title: 'Detected garbage and solid-waste sites',
    Icon: IconPollution,
  },
  {
    id: 'landuse',
    label: 'Land use',
    accent: 'land',
    title: 'Silt classification and urban vegetation',
    Icon: IconLand,
  },
  {
    id: 'biodiversity',
    label: 'Biodiversity',
    accent: 'biodiv',
    title: 'Vegetation type and health',
    Icon: IconBiodiv,
  },
  {
    id: 'climate',
    label: 'Climate impact',
    accent: 'climate',
    title: 'Flood and surface-water heatmap',
    Icon: IconClimate,
  },
  {
    id: 'flood',
    label: 'Digital Twin',
    accent: 'flood',
    title: 'Flood zones, water depth and chainage',
    Icon: IconTwin,
  },
  {
    id: 'aqi',
    label: 'AQI',
    accent: 'aqi',
    always: true,
    title: 'Air quality on the selected area',
    Icon: IconAqi,
  },
]

const MapViewsControl = ({
  loading = false,
  isMulaMutha = false,
  layersByView = {},
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [docked, setDocked] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [hoverNote, setHoverNote] = useState(null)
  const containerRef = useRef(null)
  const visibleViews = VIEW_GROUPS.filter((view) => view.always || isMulaMutha)
  const activeLayerCount = visibleViews.reduce((total, view) => {
    const layers = layersByView[view.id] || []
    return total + layers.filter((layer) => layer.checked).length
  }, 0)
  const primaryActiveView = visibleViews.find((view) =>
    (layersByView[view.id] || []).some((layer) => layer.checked),
  )

  useEffect(() => {
    if (docked) return undefined
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [docked])

  useEffect(() => {
    const onHover = (event) => setHoverNote(event.detail || null)
    window.addEventListener(CLASS_HOVER_EVENT, onHover)
    return () => window.removeEventListener(CLASS_HOVER_EVENT, onHover)
  }, [])

  const toggleGroup = (view) => {
    if (view.id === 'aqi' && loading) return
    const nextOpen = !expanded[view.id]
    setExpanded((current) => ({ ...current, [view.id]: nextOpen }))
  }

  const toggleLayer = (layer, checked) => {
    layer.onToggle?.(checked)
  }

  const dockPanel = () => {
    setDocked(true)
  }

  const undockPanel = () => {
    setDocked(false)
    setIsOpen(true)
  }

  return (
    <div
      className={`map-views-control${docked ? ' is-docked' : ''}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="map-views-dock-tab"
        onClick={undockPanel}
        title="Show layers panel"
        aria-label="Show layers panel"
        tabIndex={docked ? 0 : -1}
        aria-hidden={!docked}
      >
        <IconChevron />
        <span className="map-views-dock-label">Layers</span>
        {activeLayerCount > 0 && (
          <em className="map-views-dock-count">{activeLayerCount}</em>
        )}
      </button>

      <div className="map-views-panel" aria-hidden={docked}>
        <div className="map-views-shell">
          <button
            type="button"
            className={`map-views-toggle ${isOpen ? 'open' : ''} ${primaryActiveView ? `is-${primaryActiveView.accent}` : ''}`}
            onClick={() => setIsOpen((prev) => !prev)}
            title="Choose map view and layers"
            aria-expanded={isOpen}
            aria-haspopup="true"
            tabIndex={docked ? -1 : 0}
          >
            <span className="map-views-toggle-icon" aria-hidden="true">
              {primaryActiveView ? <primaryActiveView.Icon /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              )}
            </span>
            <div className="map-views-toggle-text">
              <span className="map-views-toggle-label">Layers</span>
              <span className="map-views-toggle-value">
                {loading ? 'Loading…' : activeLayerCount > 0 ? `${activeLayerCount} layer${activeLayerCount === 1 ? '' : 's'} on` : 'Choose layers'}
              </span>
            </div>
            <svg
              className={`map-views-chevron ${isOpen ? 'rotated' : ''}`}
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

          <button
            type="button"
            className="map-views-slide"
            onClick={dockPanel}
            title="Hide panel to left corner"
            aria-label="Hide layers panel to left corner"
            tabIndex={docked ? -1 : 0}
          >
            <IconChevron left />
          </button>
        </div>

        {isOpen && (
          <div className="map-views-menu" aria-label="Map views and layers">
            <div className="map-views-menu-bar">
              <span>Map layers</span>
              <button
                type="button"
                className="map-views-slide is-menu"
                onClick={dockPanel}
                title="Hide panel to left corner"
                aria-label="Hide layers panel to left corner"
                tabIndex={docked ? -1 : 0}
              >
                <IconChevron left />
              </button>
            </div>
            {visibleViews.map((view) => {
              const isExpanded = Boolean(expanded[view.id])
              const disabled = view.id === 'aqi' && loading
              const layers = layersByView[view.id] || []
              const onCount = layers.filter((layer) => layer.checked).length
              const isActive = onCount > 0
              return (
                <div
                  key={view.id}
                  className={`map-views-group accent-${view.accent}${isActive ? ' is-active' : ''}${isExpanded ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    title={view.title}
                    className="map-views-group-head"
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(view)}
                    tabIndex={docked ? -1 : 0}
                  >
                    <span className="map-views-item-icon">
                      <view.Icon />
                    </span>
                    <span className="map-views-item-label">
                      {disabled ? 'Loading…' : view.label}
                    </span>
                    {onCount > 0 && (
                      <span className="map-views-count">{onCount}</span>
                    )}
                    <svg
                      className={`map-views-group-chevron${isExpanded ? ' rotated' : ''}`}
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
                  {isExpanded && layers.length > 0 && (
                    <div className="map-views-layers">
                      {layers.map((layer) => {
                        const legend = legendForLayer(layer.id)
                        const colors = layer.colors || legend?.colors || []
                        return (
                          <div
                            key={layer.id}
                            className={`map-views-layer-block${layer.checked ? ' is-on' : ''}`}
                          >
                            <label
                              className={`map-views-layer${layer.checked ? ' is-on' : ''}`}
                              htmlFor={`view-layer-${view.id}-${layer.id}`}
                            >
                              <input
                                id={`view-layer-${view.id}-${layer.id}`}
                                type="checkbox"
                                checked={Boolean(layer.checked)}
                                disabled={disabled || docked}
                                onChange={(event) => toggleLayer(layer, event.target.checked)}
                              />
                              <span className="map-views-layer-copy">
                                <strong>{layer.label}</strong>
                                {layer.hint ? <em>{layer.hint}</em> : null}
                              </span>
                            </label>
                            {layer.checked && (
                              <LayerPanelSlot
                                viewId={view.id}
                                layerId={layer.id}
                                className="map-views-layer-extra"
                              />
                            )}
                            {layer.checked && colors.length > 0 && (
                              <div
                                className="map-views-layer-colors"
                                aria-label={`${layer.label} colors`}
                              >
                                {colors.map((row) => (
                                  <div
                                    key={`${layer.id}-${row.label}`}
                                    className={`map-views-swatch${
                                      hoverNote?.label === row.label &&
                                      (hoverNote?.layerId === layer.id ||
                                        (layer.id === 'lulc' && String(hoverNote?.layerId || '').startsWith('lulc')))
                                        ? ' is-hot'
                                        : ''
                                    }`}
                                  >
                                    <i style={{ background: row.color }} />
                                    <span>{row.label}</span>
                                    {row.value != null ? <strong>{row.value}</strong> : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {isExpanded && <LayerPanelSlot viewId={view.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MapViewsControl
