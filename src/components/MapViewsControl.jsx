import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLASS_HOVER_EVENT, colorsMatch } from '../lib/classRasterHover'
import { legendForLayer } from '../lib/layerLegends'
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

/** Layer rows that host a LayerPanelPortal target — omit slots for others to avoid empty UI chrome. */
const LAYER_PANEL_SLOTS = {
  landuse: ['lulc'],
}

/** Section panels that render a theme detail embed in the detail foot. */
const VIEW_EMBED_IDS = new Set([
  'geology',
  'waterquality',
  'landuse',
  'biodiversity',
  'climate',
])

const MapViewsControl = ({
  loading = false,
  isMulaMutha = false,
  layersByView = {},
  expandedViewId = null,
  onExpandedViewIdChange,
  onViewExpand,
  onOpenTwinDashboard,
  onOpenBathymetry,
  headerSlot = null,
  openToken = 0,
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [docked, setDocked] = useState(false)
  const [hoverNote, setHoverNote] = useState(null)
  const containerRef = useRef(null)
  const visibleViews = VIEW_GROUPS.filter((view) => view.always || isMulaMutha)
  const activeLayerCount = visibleViews.reduce((total, view) => {
    const layers = layersByView[view.id] || []
    return total + layers.filter((layer) => layer.checked).length
  }, 0)

  const closeMenu = () => {
    setIsOpen(false)
    onExpandedViewIdChange?.(null)
  }

  const dockPanel = () => {
    setDocked(true)
    closeMenu()
  }

  const openSidebar = () => {
    setDocked(false)
    setIsOpen(true)
  }

  const undockPanel = () => {
    openSidebar()
  }

  useEffect(() => {
    if (!openToken) return
    setDocked(false)
    setIsOpen(true)
  }, [openToken])

  // Do not auto-dock on map mousedown — that cancels pan/zoom (drag starts with mousedown).
  // Close via the panel close / dock controls only.

  const expandedView = visibleViews.find((view) => view.id === expandedViewId)
  const expandedLayers = expandedView ? layersByView[expandedView.id] || [] : []

  useEffect(() => {
    const onHover = (event) => setHoverNote(event.detail || null)
    window.addEventListener(CLASS_HOVER_EVENT, onHover)
    return () => window.removeEventListener(CLASS_HOVER_EVENT, onHover)
  }, [])

  // MapStage already notifies on real column width changes — no extra resize pulse here.

  const toggleGroup = (view) => {
    if (view.id === 'aqi' && loading) return
    openSidebar()
    if (expandedViewId === view.id) {
      onExpandedViewIdChange?.(null)
      return
    }
    onExpandedViewIdChange?.(view.id)
    onViewExpand?.(view.id)
  }

  const isHoverLayer = (layerId) => {
    if (!hoverNote?.layerId) return false
    if (hoverNote.layerId === layerId) return true
    if (layerId === 'lulc' && String(hoverNote.layerId).startsWith('lulc')) return true
    if (
      (layerId === 'bathymetry' || layerId === 'depth') &&
      (hoverNote.layerId === 'depth' || hoverNote.layerId === 'bathymetry')
    ) {
      return true
    }
    return false
  }

  const isHoverSwatch = (layerId, row) => {
    if (!hoverNote || !isHoverLayer(layerId)) return false
    if (hoverNote.label && row.label && hoverNote.label === row.label) return true
    if (colorsMatch(hoverNote.color, row.color)) return true
    return false
  }

  const legendColorsForLayer = (layer) => {
    const legend = legendForLayer(layer.id)
    return layer.colors || legend?.colors || []
  }

  const layersRail = (
    <nav className="map-views-rail is-header" aria-label="Layer categories">
      {visibleViews.map((view) => {
        const disabled = view.id === 'aqi' && loading
        const layers = layersByView[view.id] || []
        const onCount = layers.filter((layer) => layer.checked).length
        const isSelected = expandedView?.id === view.id
        const isActive = onCount > 0
        return (
          <button
            key={view.id}
            type="button"
            disabled={disabled}
            title={disabled ? 'Loading…' : view.label}
            aria-label={disabled ? 'Loading…' : view.label}
            aria-pressed={isSelected}
            className={`map-views-rail-btn accent-${view.accent}${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
            onClick={() => toggleGroup(view)}
          >
            <span className="map-views-rail-icon" aria-hidden="true">
              <view.Icon />
            </span>
            {onCount > 0 && (
              <span className="map-views-rail-badge" aria-label={`${onCount} layers on`}>
                {onCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )

  const layersDockChip = (
    <button
      type="button"
      className="map-views-header-dock"
      onClick={undockPanel}
      title="Show layers"
      aria-label="Show layers"
    >
      <IconChevron />
      <span>Layers</span>
      {activeLayerCount > 0 ? <em>{activeLayerCount}</em> : null}
    </button>
  )

  const detailPanel = expandedView ? (
    <div className={`map-views-detail${VIEW_EMBED_IDS.has(expandedView.id) ? ' has-view-embed' : ''}`}>
      <div className="map-views-detail-head">
        <div className="map-views-detail-head-copy">
          <h2 className={`map-views-detail-title accent-${expandedView.accent}`}>
            {expandedView.label}
          </h2>
          {expandedView.title ? (
            <p className="map-views-detail-hint">{expandedView.title}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="map-views-detail-close"
          onClick={() => onExpandedViewIdChange?.(null)}
          aria-label="Close section"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="map-views-detail-body">
        {expandedView.id === 'flood' && typeof onOpenTwinDashboard === 'function' ? (
          <div className="map-views-detail-actions">
            <button
              type="button"
              className="map-views-dashboard-btn accent-flood"
              onClick={onOpenTwinDashboard}
            >
              Open Digital Twin Dashboard
            </button>
          </div>
        ) : null}
        {expandedView.id === 'geology' && typeof onOpenBathymetry === 'function' ? (
          <div className="map-views-detail-actions">
            <button
              type="button"
              className="map-views-dashboard-btn accent-geology"
              onClick={onOpenBathymetry}
            >
              Open Bathymetry Dashboard
            </button>
          </div>
        ) : null}
        <div className="map-views-layers" role="group" aria-label={`${expandedView.label} map layers`}>
          {expandedLayers.map((layer, index) => {
            const colors = legendColorsForLayer(layer)
            const inputId = `sidebar-layer-${expandedView.id}-${layer.id}`
            const layerDisabled = expandedView.id === 'aqi' && loading
            const prevGroup = expandedLayers[index - 1]?.group
            const showGroup = Boolean(layer.group && layer.group !== prevGroup)
            return (
              <React.Fragment key={layer.id}>
                {showGroup ? (
                  <div className="map-views-layer-group" role="presentation">
                    {layer.group}
                  </div>
                ) : null}
                <div
                  className={`map-views-layer-block accent-${expandedView.accent}${layer.checked ? ' is-on' : ''}`}
                >
                  <label className="map-views-layer" htmlFor={inputId}>
                    <input
                      type="checkbox"
                      id={inputId}
                      checked={Boolean(layer.checked)}
                      disabled={layerDisabled}
                      onChange={(event) => layer.onToggle?.(event.target.checked)}
                    />
                    <span className="map-views-layer-copy">
                      <strong>{layer.label}</strong>
                      {layer.hint ? <em>{layer.hint}</em> : null}
                    </span>
                  </label>

                  {layer.checked && colors.length > 0 && (
                    <div className="map-views-layer-colors" aria-label={`${layer.label} legend`}>
                      {colors.map((row) => (
                        <span
                          key={`${layer.id}-${row.label}`}
                          className={`map-views-swatch${isHoverSwatch(layer.id, row) ? ' is-hot' : ''}`}
                        >
                          <i style={{ background: row.color }} aria-hidden="true" />
                          <span>{row.label}</span>
                          {row.value ? <span className="map-views-swatch-value">{row.value}</span> : null}
                        </span>
                      ))}
                    </div>
                  )}

                  {LAYER_PANEL_SLOTS[expandedView.id]?.includes(layer.id) ? (
                    <LayerPanelSlot
                      viewId={expandedView.id}
                      layerId={layer.id}
                      className="map-views-layer-extra"
                    />
                  ) : null}
                </div>
              </React.Fragment>
            )
          })}
        </div>

        {expandedView.id === 'geology' ? (
          <LayerPanelSlot viewId="geology" className="map-views-extra map-views-embed-tail" />
        ) : null}
      </div>

      {VIEW_EMBED_IDS.has(expandedView.id) && expandedView.id !== 'geology' ? (
        <div className="map-views-detail-foot">
          <LayerPanelSlot viewId={expandedView.id} className="map-views-extra" />
        </div>
      ) : null}
    </div>
  ) : null

  const useHeader = Boolean(headerSlot)

  return (
    <>
      {useHeader && !docked ? createPortal(layersRail, headerSlot) : null}
      {useHeader && docked ? createPortal(layersDockChip, headerSlot) : null}

      <div
        className={`map-views-control${docked ? ' is-docked' : ''}${!docked ? ' is-menu-open' : ''}${expandedView ? ' has-detail' : ''}${useHeader ? ' is-header-rail' : ''}`}
        ref={containerRef}
      >
        {!useHeader ? (
          <button
            type="button"
            className="map-views-dock-tab"
            onClick={undockPanel}
            title="Show layers"
            aria-label="Show layers"
            tabIndex={docked ? 0 : -1}
            aria-hidden={!docked}
          >
            <IconChevron />
            <span className="map-views-dock-label">Layers</span>
            {activeLayerCount > 0 && (
              <em className="map-views-dock-count">{activeLayerCount}</em>
            )}
          </button>
        ) : null}

        {!docked && (!useHeader || detailPanel) ? (
          <div className="map-views-float" aria-label="Map views and layers">
            {!useHeader ? layersRail : null}
            {detailPanel}
          </div>
        ) : null}
      </div>
    </>
  )
}

export default MapViewsControl
