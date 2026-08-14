import React, { useEffect, useRef, useCallback } from 'react'
import { Map, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { EMPTY_MAP_STYLE, BASEMAP_MAP, DEFAULT_BASEMAP } from '../lib/basemaps'
import { applyBasemap, applyTerrain3d, ensureBasemapLayers } from '../lib/applyBasemap'
import './MapComponent.css'
import './DrawAreaComponent.css'

const DEFAULT_CENTER = [78.9629, 20.5937]
const DEFAULT_ZOOM = 5

const POLYGON_SOURCE = 'src-area-polygon'
const POLYGON_FILL = 'lyr-area-fill'
const POLYGON_LINE = 'lyr-area-line'
const DRAW_SOURCE = 'src-draw-preview'
const DRAW_LINE = 'lyr-draw-line'
const DRAW_POINTS = 'lyr-draw-points'
const TSS_SOURCE = 'src-tss-class'
const TSS_FILL = 'lyr-tss-fill'
const TSS_LINE = 'lyr-tss-line'
const TSS_GEOJSON_URL = '/asset/mula-mutha-tss-class.geojson'
const NDCI_SOURCE = 'src-ndci-class'
const NDCI_FILL = 'lyr-ndci-fill'
const NDCI_LINE = 'lyr-ndci-line'
const NDCI_GEOJSON_URL = '/asset/mula-mutha-ndci-class.geojson'
const NDWI_SOURCE = 'src-ndwi-class'
const NDWI_FILL = 'lyr-ndwi-fill'
const NDWI_LINE = 'lyr-ndwi-line'
const NDWI_GEOJSON_URL = '/asset/mula-mutha-ndwi-class.geojson'
const WST_SOURCE = 'src-wst-class'
const WST_FILL = 'lyr-wst-fill'
const WST_LINE = 'lyr-wst-line'
const WST_GEOJSON_URL = '/asset/mula-mutha-wst-class.geojson'

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] }

const TSS_FILL_COLOR = [
  'match',
  ['get', 'class'],
  1, '#2a9d8f',
  2, '#c9a227',
  3, '#c2372a',
  '#6b8798',
]

const NDCI_FILL_COLOR = [
  'match',
  ['get', 'class'],
  1, '#95d5b2',
  2, '#1b4332',
  '#6b8798',
]

const NDWI_FILL_COLOR = [
  'match',
  ['get', 'class'],
  1, '#c4b59a',
  2, '#1d4e89',
  '#6b8798',
]

const WST_FILL_COLOR = [
  'match',
  ['get', 'class'],
  1, '#2c7bb6',
  2, '#abd9e9',
  3, '#ffffbf',
  4, '#fdae61',
  5, '#d7191c',
  '#6b8798',
]

const ensureClassLayer = (map, { sourceId, fillId, lineId, colorExpr, fillOpacity = 0.55 }) => {
  if (map.getSource(sourceId)) return
  map.addSource(sourceId, { type: 'geojson', data: EMPTY_COLLECTION })
  map.addLayer({
    id: fillId,
    type: 'fill',
    source: sourceId,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': colorExpr,
      'fill-opacity': fillOpacity,
    },
  })
  map.addLayer({
    id: lineId,
    type: 'line',
    source: sourceId,
    layout: { visibility: 'none' },
    paint: {
      'line-color': colorExpr,
      'line-width': 0.8,
      'line-opacity': 0.85,
    },
  })
}

const parseKMLCoordinates = (kmlContent) => {
  try {
    const parser = new DOMParser()
    const kmlDoc = parser.parseFromString(kmlContent, 'text/xml')
    const errorNode = kmlDoc.querySelector('parsererror')
    if (errorNode) {
      console.error('KML parsing error:', errorNode.textContent)
      return null
    }

    const coordinatesElements = kmlDoc.querySelectorAll('coordinates')
    if (coordinatesElements.length === 0) return null

    const coordsText = coordinatesElements[0].textContent.trim()
    const coordPairs = coordsText.split(/\s+/).filter(Boolean)

    return coordPairs.map((coord) => {
      const [lng, lat] = coord.split(',').map(Number)
      return [lng, lat]
    })
  } catch (error) {
    console.error('Error parsing KML:', error)
    return null
  }
}

const geometryToCoordinates = (drawnGeometry, uploadedKML) => {
  if (drawnGeometry?.coordinates) {
    return drawnGeometry.coordinates[0]
  }
  if (uploadedKML?.content) {
    return parseKMLCoordinates(uploadedKML.content)
  }
  return null
}

const coordsToPolygonFeature = (coordinates) => {
  if (!coordinates?.length) return EMPTY_COLLECTION

  const ring = coordinates[0][0] === coordinates[coordinates.length - 1][0]
    && coordinates[0][1] === coordinates[coordinates.length - 1][1]
    ? coordinates
    : [...coordinates, coordinates[0]]

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    }],
  }
}

const ensureOverlayLayers = (map) => {
  if (!map.getSource(POLYGON_SOURCE)) {
    map.addSource(POLYGON_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: POLYGON_FILL,
      type: 'fill',
      source: POLYGON_SOURCE,
      paint: {
        'fill-color': '#2f9bd6',
        'fill-opacity': 0.25,
      },
    })
    map.addLayer({
      id: POLYGON_LINE,
      type: 'line',
      source: POLYGON_SOURCE,
      paint: {
        'line-color': '#2f9bd6',
        'line-width': 2,
      },
    })
  }

  if (!map.getSource(DRAW_SOURCE)) {
    map.addSource(DRAW_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: DRAW_LINE,
      type: 'line',
      source: DRAW_SOURCE,
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': '#2f9bd6',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.8,
      },
    })
    map.addLayer({
      id: DRAW_POINTS,
      type: 'circle',
      source: DRAW_SOURCE,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#2f9bd6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  ensureClassLayer(map, {
    sourceId: TSS_SOURCE,
    fillId: TSS_FILL,
    lineId: TSS_LINE,
    colorExpr: TSS_FILL_COLOR,
    fillOpacity: 0.5,
  })
  ensureClassLayer(map, {
    sourceId: NDCI_SOURCE,
    fillId: NDCI_FILL,
    lineId: NDCI_LINE,
    colorExpr: NDCI_FILL_COLOR,
    fillOpacity: 0.58,
  })
  ensureClassLayer(map, {
    sourceId: NDWI_SOURCE,
    fillId: NDWI_FILL,
    lineId: NDWI_LINE,
    colorExpr: NDWI_FILL_COLOR,
    fillOpacity: 0.52,
  })
  ensureClassLayer(map, {
    sourceId: WST_SOURCE,
    fillId: WST_FILL,
    lineId: WST_LINE,
    colorExpr: WST_FILL_COLOR,
    fillOpacity: 0.55,
  })
}

const MapComponent = ({
  mapLayer,
  drawnGeometry,
  uploadedKML,
  isDrawing,
  onGeometryComplete,
  onCancelDrawing,
  showTssLayer = false,
  showNdciLayer = false,
  showNdwiLayer = false,
  showWstLayer = false,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapReadyRef = useRef(false)
  const mapLayerRef = useRef(mapLayer)
  const tssLoadedRef = useRef(false)
  const ndciLoadedRef = useRef(false)
  const ndwiLoadedRef = useRef(false)
  const wstLoadedRef = useRef(false)
  const drawPointsRef = useRef([])
  const drawHandlersRef = useRef({ click: null, dblclick: null })
  const [drawPointCount, setDrawPointCount] = React.useState(0)
  const [isDrawingActive, setIsDrawingActive] = React.useState(false)
  const [mapReady, setMapReady] = React.useState(false)

  mapLayerRef.current = mapLayer

  const updateDrawPreview = useCallback((points) => {
    const map = mapRef.current
    const source = map?.getSource(DRAW_SOURCE)
    if (!source) return

    const features = []
    points.forEach(([lng, lat]) => {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })
    })

    if (points.length > 1) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: points },
      })
    }

    source.setData({ type: 'FeatureCollection', features })
  }, [])

  const clearDrawPreview = useCallback(() => {
    drawPointsRef.current = []
    setDrawPointCount(0)
    const source = mapRef.current?.getSource(DRAW_SOURCE)
    source?.setData(EMPTY_COLLECTION)
  }, [])

  const finishDrawing = useCallback(() => {
    if (drawPointsRef.current.length < 3) return

    const closedPoints = [...drawPointsRef.current, drawPointsRef.current[0]]
    onGeometryComplete({
      type: 'Polygon',
      coordinates: [closedPoints],
    })
    clearDrawPreview()
    setIsDrawingActive(false)
  }, [onGeometryComplete, clearDrawPreview])

  const cancelDrawing = useCallback(() => {
    clearDrawPreview()
    setIsDrawingActive(false)
    onCancelDrawing()
  }, [clearDrawPreview, onCancelDrawing])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined

    const map = new Map({
      container: containerRef.current,
      style: EMPTY_MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    })

    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(containerRef.current)

    map.on('load', () => {
      mapRef.current = map
      mapReadyRef.current = true

      const initialId = mapLayerRef.current || DEFAULT_BASEMAP
      const initial = BASEMAP_MAP[initialId] || BASEMAP_MAP[DEFAULT_BASEMAP]
      ensureBasemapLayers(map, initial)
      applyBasemap(map, initialId)
      applyTerrain3d(map, Boolean(initial?.mode3d), initialId)

      if (!map.getSource('src-terrarium')) {
        map.addSource('src-terrarium', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        })
      }

      ensureOverlayLayers(map)
      setMapReady(true)
    })

    return () => {
      resizeObserver.disconnect()
      mapReadyRef.current = false
      setMapReady(false)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    applyBasemap(map, mapLayer)
  }, [mapLayer])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return

    const config = BASEMAP_MAP[mapLayer]
    applyTerrain3d(map, Boolean(config?.mode3d), mapLayer)
  }, [mapLayer])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const coordinates = geometryToCoordinates(drawnGeometry, uploadedKML)
    const source = map.getSource(POLYGON_SOURCE)
    source?.setData(coordsToPolygonFeature(coordinates))

    if (!coordinates?.length) return

    const lngs = coordinates.map((c) => c[0])
    const lats = coordinates.map((c) => c[1])
    const bounds = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    // Smooth camera relocation (especially for uploaded KML)
    const isKmlUpload = Boolean(uploadedKML) && !drawnGeometry
    const camera = map.cameraForBounds(bounds, {
      padding: { top: 72, bottom: 72, left: 72, right: 72 },
      maxZoom: 16,
    })

    if (!camera) {
      map.fitBounds(bounds, {
        padding: 80,
        duration: isKmlUpload ? 4200 : 1800,
        maxZoom: 16,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      })
      return
    }

    if (isKmlUpload) {
      map.flyTo({
        center: camera.center,
        zoom: camera.zoom,
        bearing: camera.bearing ?? 0,
        pitch: map.getPitch(),
        duration: 4500,
        essential: true,
        curve: 1.1,
        speed: 0.35,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      })
    } else {
      map.easeTo({
        center: camera.center,
        zoom: camera.zoom,
        bearing: camera.bearing ?? 0,
        pitch: map.getPitch(),
        duration: 2000,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      })
    }
  }, [drawnGeometry, uploadedKML, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      if (map.getLayer(TSS_FILL)) map.setLayoutProperty(TSS_FILL, 'visibility', value)
      if (map.getLayer(TSS_LINE)) map.setLayoutProperty(TSS_LINE, 'visibility', value)
    }

    if (!showTssLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!tssLoadedRef.current) {
          const response = await fetch(TSS_GEOJSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`TSS layer → ${response.status}`)
          const geojson = await response.json()
          if (cancelled) return
          map.getSource(TSS_SOURCE)?.setData(geojson)
          tssLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load TSS / turbidity layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showTssLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      if (map.getLayer(NDCI_FILL)) map.setLayoutProperty(NDCI_FILL, 'visibility', value)
      if (map.getLayer(NDCI_LINE)) map.setLayoutProperty(NDCI_LINE, 'visibility', value)
    }

    if (!showNdciLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!ndciLoadedRef.current) {
          const response = await fetch(NDCI_GEOJSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`NDCI layer → ${response.status}`)
          const geojson = await response.json()
          if (cancelled) return
          map.getSource(NDCI_SOURCE)?.setData(geojson)
          ndciLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load NDCI / chlorophyll layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showNdciLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      if (map.getLayer(NDWI_FILL)) map.setLayoutProperty(NDWI_FILL, 'visibility', value)
      if (map.getLayer(NDWI_LINE)) map.setLayoutProperty(NDWI_LINE, 'visibility', value)
    }

    if (!showNdwiLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!ndwiLoadedRef.current) {
          const response = await fetch(NDWI_GEOJSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`NDWI layer → ${response.status}`)
          const geojson = await response.json()
          if (cancelled) return
          map.getSource(NDWI_SOURCE)?.setData(geojson)
          ndwiLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load NDWI / water-detection layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showNdwiLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      if (map.getLayer(WST_FILL)) map.setLayoutProperty(WST_FILL, 'visibility', value)
      if (map.getLayer(WST_LINE)) map.setLayoutProperty(WST_LINE, 'visibility', value)
    }

    if (!showWstLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!wstLoadedRef.current) {
          const response = await fetch(WST_GEOJSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`WST layer → ${response.status}`)
          const geojson = await response.json()
          if (cancelled) return
          map.getSource(WST_SOURCE)?.setData(geojson)
          wstLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load WST / temperature layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showWstLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return undefined

    if (isDrawing) {
      setIsDrawingActive(true)
      map.getCanvas().style.cursor = 'crosshair'
      clearDrawPreview()

      const handleClick = (e) => {
        drawPointsRef.current.push([e.lngLat.lng, e.lngLat.lat])
        setDrawPointCount(drawPointsRef.current.length)
        updateDrawPreview(drawPointsRef.current)
      }

      const handleDoubleClick = (e) => {
        e.preventDefault()
        if (drawPointsRef.current.length >= 3) {
          finishDrawing()
        }
      }

      drawHandlersRef.current.click = handleClick
      drawHandlersRef.current.dblclick = handleDoubleClick
      map.on('click', handleClick)
      map.on('dblclick', handleDoubleClick)
    } else {
      setIsDrawingActive(false)
      map.getCanvas().style.cursor = ''
      clearDrawPreview()
    }

    return () => {
      map.getCanvas().style.cursor = ''
      if (drawHandlersRef.current.click) {
        map.off('click', drawHandlersRef.current.click)
      }
      if (drawHandlersRef.current.dblclick) {
        map.off('dblclick', drawHandlersRef.current.dblclick)
      }
    }
  }, [isDrawing, clearDrawPreview, updateDrawPreview, finishDrawing])

  return (
    <div className="map-container">
      <div ref={containerRef} className="maplibre-map" />

      {isDrawingActive && (
        <div className="draw-controls-overlay">
          <div className="draw-instructions">
            <p>Click on the map to add points</p>
            <p>Double-click or click &quot;Finish&quot; to complete</p>
          </div>
          <div className="draw-actions">
            <button
              type="button"
              className="draw-button finish-button"
              onClick={finishDrawing}
              disabled={drawPointCount < 3}
            >
              Finish Drawing
            </button>
            <button
              type="button"
              className="draw-button cancel-button"
              onClick={cancelDrawing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapComponent
