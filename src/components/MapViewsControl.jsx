import React, { useEffect, useRef, useState } from 'react'
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

const VIEWS = [
  {
    id: 'aqi',
    label: 'AQI',
    accent: 'aqi',
    always: true,
    title: 'Show AQI on map',
    Icon: IconAqi,
  },
  {
    id: 'geology',
    label: 'Geology',
    accent: 'geology',
    title: 'Geology: joining streams and satellite-derived bathymetry',
    Icon: IconGeology,
  },
  {
    id: 'waterquality',
    label: 'Water quality',
    accent: 'water',
    title: 'Water quality: TSS, NDCI, NDWI, WST and BOD–COD',
    Icon: IconWater,
  },
  {
    id: 'landuse',
    label: 'Land use',
    accent: 'land',
    title: 'Soil & land use: silt classification and urban vegetation',
    Icon: IconLand,
  },
  {
    id: 'biodiversity',
    label: 'Biodiversity',
    accent: 'biodiv',
    title: 'Biodiversity: vegetation type and health',
    Icon: IconBiodiv,
  },
  {
    id: 'climate',
    label: 'Climate impact',
    accent: 'climate',
    title: 'Flood and surface-water heatmap from image pairs',
    Icon: IconClimate,
  },
  {
    id: 'flood',
    label: 'Digital Twin',
    accent: 'flood',
    title: 'Digital twin layers: 10 / 25 / 100-year flood and water depth',
    Icon: IconTwin,
  },
]

const MapViewsControl = ({
  activeView = null,
  loading = false,
  isMulaMutha = false,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const active = VIEWS.find((view) => view.id === activeView)
  const visibleViews = VIEWS.filter((view) => view.always || isMulaMutha)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (view) => {
    if (view.id === 'aqi' && loading) return
    onSelect?.(view.id)
    setIsOpen(false)
  }

  return (
    <div className="map-views-control" ref={containerRef}>
      <button
        type="button"
        className={`map-views-toggle ${isOpen ? 'open' : ''} ${active ? `is-${active.accent}` : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Choose map view"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="map-views-toggle-icon" aria-hidden="true">
          {active ? <active.Icon /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          )}
        </span>
        <div className="map-views-toggle-text">
          <span className="map-views-toggle-label">Views</span>
          <span className="map-views-toggle-value">
            {loading && activeView === 'aqi' ? 'Loading…' : active?.label || 'Choose a view'}
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

      {isOpen && (
        <div className="map-views-menu" role="listbox" aria-label="Map views">
          {visibleViews.map((view) => {
            const isActive = activeView === view.id
            const disabled = view.id === 'aqi' && loading
            return (
              <button
                key={view.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={disabled}
                title={view.title}
                className={`map-views-item accent-${view.accent} ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(view)}
              >
                <span className="map-views-item-icon">
                  <view.Icon />
                </span>
                <span className="map-views-item-label">
                  {disabled ? 'Loading…' : view.label}
                </span>
                {isActive && (
                  <svg className="map-views-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MapViewsControl
