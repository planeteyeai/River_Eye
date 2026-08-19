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
const TSS_SOURCE = 'src-tss-overlay'
const TSS_RASTER = 'lyr-tss-raster'
const NDCI_SOURCE = 'src-ndci-overlay'
const NDCI_RASTER = 'lyr-ndci-raster'
const NDWI_SOURCE = 'src-ndwi-overlay'
const NDWI_RASTER = 'lyr-ndwi-raster'
const WST_SOURCE = 'src-wst-overlay'
const WST_RASTER = 'lyr-wst-raster'
const WQ_JSON_URL = '/asset/mula-mutha-wq-overlays.json'
const DEPTH_SOURCE = 'src-depth-overlay'
const DEPTH_RASTER = 'lyr-depth-raster'
const DEPTH_META_URL = '/asset/mula-mutha-depth-summary.json'
const URBAN_VEG_SOURCE = 'src-urban-veg'
const URBAN_VEG_FILL = 'lyr-urban-veg-fill'
const URBAN_VEG_LINE = 'lyr-urban-veg-line'
const URBAN_VEG_JSON_URL = '/asset/mula-mutha-urban-vegetation.json'
const BIODIV_TYPE_SOURCE = 'src-biodiversity-type'
const BIODIV_TYPE_RASTER = 'lyr-biodiversity-type'
const BIODIV_HEALTH_SOURCE = 'src-biodiversity-health'
const BIODIV_HEALTH_RASTER = 'lyr-biodiversity-health'
const BIODIV_JSON_URL = '/asset/mula-mutha-biodiversity.json'
const FLOOD_ZONE_SOURCE = 'src-flood-zones'
const FLOOD_ZONE_FILL = 'lyr-flood-zone-fill'
const FLOOD_ZONE_LINE = 'lyr-flood-zone-line'
const CLIMATE_WATER_SOURCE = 'src-climate-water'
const CLIMATE_WATER_HEAT = 'lyr-climate-water-heat'
const CLIMATE_FLOOD_SOURCE = 'src-climate-flood'
const CLIMATE_FLOOD_HEAT = 'lyr-climate-flood-heat'
const CHAINAGE_SOURCE = 'src-chainage'
const CHAINAGE_LINE = 'lyr-chainage-line'
const CHAINAGE_TICKS = 'lyr-chainage-ticks'
const CHAINAGE_MAJOR = 'lyr-chainage-major'
const CHAINAGE_LABELS_MAJOR = 'lyr-chainage-labels-km'
const CHAINAGE_LABELS_MINOR = 'lyr-chainage-labels-100m'
const CHAINAGE_GEOJSON_URL = '/asset/mula-mutha-chainage.geojson'

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] }

// Image sources must have a real LatLonBox. Four identical [0,0] corners
// project to Infinity once terrain is on (MapLibre image source + DEM).
const MULA_MUTHA_IMAGE_COORDS = [
  [73.85023001288063, 18.561529389648026],
  [73.99602658349323, 18.561529389648026],
  [73.99602658349323, 18.509966092339564],
  [73.85023001288063, 18.509966092339564],
]

const isValidImageCoordinates = (coords) =>
  Array.isArray(coords) &&
  coords.length === 4 &&
  coords.every(
    (corner) =>
      Array.isArray(corner) &&
      corner.length >= 2 &&
      Number.isFinite(corner[0]) &&
      Number.isFinite(corner[1]),
  )

const pointsToCollection = (pairs) => ({
  type: 'FeatureCollection',
  features: (pairs || []).map((coordinates) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates },
  })),
})

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
  // Added first so the corridors sit under the reach outline and draw preview.
  if (!map.getSource(FLOOD_ZONE_SOURCE)) {
    map.addSource(FLOOD_ZONE_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: FLOOD_ZONE_FILL,
      type: 'fill',
      source: FLOOD_ZONE_SOURCE,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.26,
      },
    })
    map.addLayer({
      id: FLOOD_ZONE_LINE,
      type: 'line',
      source: FLOOD_ZONE_SOURCE,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 0.95,
      },
    })
  }

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

  // The vegetation KML carries an extent and class shares, not per-pixel
  // geometry, so all the map can honestly show is the classified footprint.
  if (!map.getSource(URBAN_VEG_SOURCE)) {
    map.addSource(URBAN_VEG_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: URBAN_VEG_FILL,
      type: 'fill',
      source: URBAN_VEG_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#31a354',
        'fill-opacity': 0.1,
      },
    })
    map.addLayer({
      id: URBAN_VEG_LINE,
      type: 'line',
      source: URBAN_VEG_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#006837',
        'line-width': 1.8,
        'line-dasharray': [3, 2],
        'line-opacity': 0.9,
      },
    })
  }

  // Classified rasters (biodiversity KMZs and July water-quality KMZs).
  const ensureImageRaster = (sourceId, layerId, url, paint = {}) => {
    if (map.getSource(sourceId)) return
    map.addSource(sourceId, {
      type: 'image',
      url,
      coordinates: MULA_MUTHA_IMAGE_COORDS,
    })
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0.82,
        'raster-fade-duration': 0,
        ...paint,
      },
    })
  }
  ensureImageRaster(DEPTH_SOURCE, DEPTH_RASTER, '/asset/mula-mutha-depth-overlay.png', {
    'raster-opacity': 0.88,
    'raster-resampling': 'linear',
  })
  ensureImageRaster(TSS_SOURCE, TSS_RASTER, '/asset/mula-mutha-tss-overlay.png')
  ensureImageRaster(NDCI_SOURCE, NDCI_RASTER, '/asset/mula-mutha-ndci-overlay.png')
  ensureImageRaster(NDWI_SOURCE, NDWI_RASTER, '/asset/mula-mutha-ndwi-overlay.png')
  ensureImageRaster(WST_SOURCE, WST_RASTER, '/asset/mula-mutha-wst-overlay.png')
  ensureImageRaster(
    BIODIV_TYPE_SOURCE,
    BIODIV_TYPE_RASTER,
    '/asset/mula-mutha-biodiversity-overlay.png',
  )
  ensureImageRaster(
    BIODIV_HEALTH_SOURCE,
    BIODIV_HEALTH_RASTER,
    '/asset/mula-mutha-biodiversity-health-overlay.png',
  )

  const ensureHeatmap = (sourceId, layerId, colors) => {
    if (map.getSource(sourceId)) return
    map.addSource(sourceId, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: layerId,
      type: 'heatmap',
      source: sourceId,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.45, 15, 1.15],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 28],
        'heatmap-opacity': 0.78,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          ...colors,
        ],
      },
    })
  }
  ensureHeatmap(CLIMATE_WATER_SOURCE, CLIMATE_WATER_HEAT, [
    0.15, 'rgba(47,155,214,0.15)',
    0.4, '#7ec8e3',
    0.7, '#2f9bd6',
    1, '#0d4a73',
  ])
  ensureHeatmap(CLIMATE_FLOOD_SOURCE, CLIMATE_FLOOD_HEAT, [
    0.12, 'rgba(255,209,102,0.2)',
    0.35, '#fc8d59',
    0.65, '#d73027',
    1, '#7f0000',
  ])

  // Chainage sits last so the centreline and km marks stay readable over depth.
  if (!map.getSource(CHAINAGE_SOURCE)) {
    map.addSource(CHAINAGE_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: CHAINAGE_LINE,
      type: 'line',
      source: CHAINAGE_SOURCE,
      filter: ['==', ['get', 'kind'], 'centerline'],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffd166',
        'line-width': 2.2,
        'line-opacity': 0.95,
      },
    })
    map.addLayer({
      id: CHAINAGE_TICKS,
      type: 'circle',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], false]],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 3.4],
        'circle-color': '#ffffff',
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#1a1a1a',
        'circle-opacity': 0.9,
      },
    })
    map.addLayer({
      id: CHAINAGE_MAJOR,
      type: 'circle',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], true]],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 6],
        'circle-color': '#ffd166',
        'circle-stroke-width': 1.6,
        'circle-stroke-color': '#1a1a1a',
      },
    })
    map.addLayer({
      id: CHAINAGE_LABELS_MAJOR,
      type: 'symbol',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], true]],
      minzoom: 11,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#fff8e7',
        'text-halo-color': 'rgba(12, 18, 22, 0.88)',
        'text-halo-width': 1.6,
      },
    })
    map.addLayer({
      id: CHAINAGE_LABELS_MINOR,
      type: 'symbol',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], false]],
      minzoom: 14.2,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 9.5,
        'text-offset': [0, 1.05],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(12, 18, 22, 0.8)',
        'text-halo-width': 1.2,
      },
    })
  }
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
  showDepthLayer = false,
  showUrbanVegLayer = false,
  showBiodiversityTypeLayer = false,
  showBiodiversityHealthLayer = false,
  showClimateFloodHeat = false,
  showClimateWaterHeat = false,
  climatePeriodId = 4,
  showChainageLayer = false,
  floodZones = null,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapReadyRef = useRef(false)
  const mapLayerRef = useRef(mapLayer)
  const wqMetaRef = useRef(null)
  const depthLoadedRef = useRef(false)
  const urbanVegLoadedRef = useRef(false)
  const biodiversityMetaRef = useRef(null)
  const climatePointsRef = useRef({})
  const chainageLoadedRef = useRef(false)
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

      if (!map.getSource('src-terrarium')) {
        map.addSource('src-terrarium', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        })
      }

      applyBasemap(map, initialId)
      applyTerrain3d(map, Boolean(initial?.mode3d), initialId)
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

    const wqLayers = [
      { id: 'tss', sourceId: TSS_SOURCE, layerId: TSS_RASTER, on: showTssLayer },
      { id: 'ndci', sourceId: NDCI_SOURCE, layerId: NDCI_RASTER, on: showNdciLayer },
      { id: 'ndwi', sourceId: NDWI_SOURCE, layerId: NDWI_RASTER, on: showNdwiLayer },
      { id: 'wst', sourceId: WST_SOURCE, layerId: WST_RASTER, on: showWstLayer },
    ]

    const setVisibility = (layerId, visible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }

    const anyOn = wqLayers.some((layer) => layer.on)
    if (!anyOn) {
      wqLayers.forEach((layer) => setVisibility(layer.layerId, false))
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!wqMetaRef.current) {
          const response = await fetch(WQ_JSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Water-quality overlays → ${response.status}`)
          wqMetaRef.current = await response.json()
        }
        if (cancelled) return

        const byId = Object.fromEntries((wqMetaRef.current.layers || []).map((layer) => [layer.id, layer]))
        wqLayers.forEach((layer) => {
          const meta = byId[layer.id]
          const source = map.getSource(layer.sourceId)
          if (source?.updateImage && meta?.raster && isValidImageCoordinates(meta.imageCoordinates)) {
            source.updateImage({ url: meta.raster, coordinates: meta.imageCoordinates })
          }
          setVisibility(layer.layerId, layer.on)
        })
      } catch (error) {
        console.error('Failed to load water-quality overlays', error)
        if (!cancelled) wqLayers.forEach((layer) => setVisibility(layer.layerId, false))
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showTssLayer, showNdciLayer, showNdwiLayer, showWstLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      if (map.getLayer(DEPTH_RASTER)) {
        map.setLayoutProperty(DEPTH_RASTER, 'visibility', visible ? 'visible' : 'none')
      }
    }

    if (!showDepthLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!depthLoadedRef.current) {
          const response = await fetch(DEPTH_META_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Depth layer → ${response.status}`)
          const meta = await response.json()
          if (cancelled) return
          const source = map.getSource(DEPTH_SOURCE)
          if (source?.updateImage && meta?.raster && isValidImageCoordinates(meta.imageCoordinates)) {
            source.updateImage({ url: meta.raster, coordinates: meta.imageCoordinates })
            depthLoadedRef.current = true
          }
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load water depth layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showDepthLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      if (map.getLayer(URBAN_VEG_FILL)) map.setLayoutProperty(URBAN_VEG_FILL, 'visibility', value)
      if (map.getLayer(URBAN_VEG_LINE)) map.setLayoutProperty(URBAN_VEG_LINE, 'visibility', value)
    }

    if (!showUrbanVegLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!urbanVegLoadedRef.current) {
          const response = await fetch(URBAN_VEG_JSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Urban vegetation → ${response.status}`)
          const doc = await response.json()
          if (cancelled) return
          map.getSource(URBAN_VEG_SOURCE)?.setData(doc.extent || EMPTY_COLLECTION)
          urbanVegLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load urban vegetation extent', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showUrbanVegLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (layerId, visible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }

    const anyOn = showBiodiversityTypeLayer || showBiodiversityHealthLayer
    if (!anyOn) {
      setVisibility(BIODIV_TYPE_RASTER, false)
      setVisibility(BIODIV_HEALTH_RASTER, false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!biodiversityMetaRef.current) {
          const response = await fetch(BIODIV_JSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Biodiversity → ${response.status}`)
          biodiversityMetaRef.current = await response.json()
        }
        if (cancelled) return

        const doc = biodiversityMetaRef.current
        const typeUrl = doc.rasters?.type || doc.raster
        const healthUrl = doc.rasters?.health
        const coords = doc.imageCoordinates

        const typeSource = map.getSource(BIODIV_TYPE_SOURCE)
        if (typeSource?.updateImage && typeUrl && isValidImageCoordinates(coords)) {
          typeSource.updateImage({ url: typeUrl, coordinates: coords })
        }
        const healthSource = map.getSource(BIODIV_HEALTH_SOURCE)
        if (healthSource?.updateImage && healthUrl && isValidImageCoordinates(coords)) {
          healthSource.updateImage({ url: healthUrl, coordinates: coords })
        }

        if (!cancelled) {
          setVisibility(BIODIV_TYPE_RASTER, showBiodiversityTypeLayer)
          setVisibility(BIODIV_HEALTH_RASTER, showBiodiversityHealthLayer)
        }
      } catch (error) {
        console.error('Failed to load biodiversity rasters', error)
        if (!cancelled) {
          setVisibility(BIODIV_TYPE_RASTER, false)
          setVisibility(BIODIV_HEALTH_RASTER, false)
        }
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showBiodiversityTypeLayer, showBiodiversityHealthLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (layerId, visible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }

    const anyOn = showClimateFloodHeat || showClimateWaterHeat
    if (!anyOn) {
      setVisibility(CLIMATE_WATER_HEAT, false)
      setVisibility(CLIMATE_FLOOD_HEAT, false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        const period = Number.isFinite(climatePeriodId) ? climatePeriodId : 4
        if (!climatePointsRef.current[period]) {
          const response = await fetch(`/asset/mula-mutha-flood-water-${period}.json`, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Climate heatmap → ${response.status}`)
          climatePointsRef.current[period] = await response.json()
        }
        if (cancelled) return
        const pack = climatePointsRef.current[period]
        map.getSource(CLIMATE_WATER_SOURCE)?.setData(pointsToCollection(pack.water))
        map.getSource(CLIMATE_FLOOD_SOURCE)?.setData(pointsToCollection(pack.flood))
        setVisibility(CLIMATE_WATER_HEAT, showClimateWaterHeat)
        setVisibility(CLIMATE_FLOOD_HEAT, showClimateFloodHeat)
      } catch (error) {
        console.error('Failed to load climate impact heatmap', error)
        if (!cancelled) {
          setVisibility(CLIMATE_WATER_HEAT, false)
          setVisibility(CLIMATE_FLOOD_HEAT, false)
        }
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showClimateFloodHeat, showClimateWaterHeat, climatePeriodId, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      ;[CHAINAGE_LINE, CHAINAGE_TICKS, CHAINAGE_MAJOR, CHAINAGE_LABELS_MAJOR, CHAINAGE_LABELS_MINOR].forEach(
        (layerId) => {
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value)
        },
      )
    }

    if (!showChainageLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!chainageLoadedRef.current) {
          const response = await fetch(CHAINAGE_GEOJSON_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Chainage layer → ${response.status}`)
          const geojson = await response.json()
          if (cancelled) return
          map.getSource(CHAINAGE_SOURCE)?.setData(geojson)
          chainageLoadedRef.current = true
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load chainage layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showChainageLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.getSource(FLOOD_ZONE_SOURCE)?.setData(floodZones || EMPTY_COLLECTION)
  }, [floodZones, mapReady])

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
