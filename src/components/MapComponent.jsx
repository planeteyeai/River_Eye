import React, { useEffect, useRef, useCallback } from 'react'
import { Map, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { EMPTY_MAP_STYLE, BASEMAP_MAP, DEFAULT_BASEMAP } from '../lib/basemaps'
import { applyBasemap, applyTerrain3d, ensureBasemapLayers } from '../lib/applyBasemap'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { binFilterForChainage, buildChainageBins } from '../lib/chainageBins'
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
const SILT_JSON_URL = '/asset/mula-mutha-silt.json'
const SILT_CLASS_SOURCE = 'src-silt-class'
const SILT_CLASS_RASTER = 'lyr-silt-class'
const SILT_VOLUME_SOURCE = 'src-silt-volume'
const SILT_VOLUME_RASTER = 'lyr-silt-volume'
const FLOOD_ZONE_SOURCE = 'src-flood-zones'
const FLOOD_ZONE_FILL = 'lyr-flood-zone-fill'
const FLOOD_ZONE_LINE = 'lyr-flood-zone-line'
const CLIMATE_WATER_SOURCE = 'src-climate-water'
const CLIMATE_WATER_HEAT = 'lyr-climate-water-heat'
const CLIMATE_FLOOD_SOURCE = 'src-climate-flood'
const CLIMATE_FLOOD_HEAT = 'lyr-climate-flood-heat'
const CHAINAGE_SOURCE = 'src-chainage'
const CHAINAGE_BIN_SOURCE = 'src-chainage-bins'
const CHAINAGE_BIN_FILL = 'lyr-chainage-bin-fill'
const CHAINAGE_BIN_ACTIVE = 'lyr-chainage-bin-active'
const CHAINAGE_BIN_LINE = 'lyr-chainage-bin-line'
const CHAINAGE_BIN_GLOW = 'lyr-chainage-bin-glow'
const CHAINAGE_BIN_SELECTED = 'lyr-chainage-bin-selected'
const CHAINAGE_TICKS = 'lyr-chainage-ticks'
const CHAINAGE_MAJOR = 'lyr-chainage-major'
const CHAINAGE_FOCUS = 'lyr-chainage-focus'
const CHAINAGE_LABELS_MAJOR = 'lyr-chainage-labels-km'
const CHAINAGE_LABELS_MINOR = 'lyr-chainage-labels-100m'
const CHAINAGE_GEOJSON_URL = '/asset/mula-mutha-chainage.geojson'
const TRIB_SOURCE = 'src-tributaries'
const TRIB_GLOW = 'lyr-tributary-glow'
const TRIB_LINE = 'lyr-tributary-line'
const TRIB_DASH = 'lyr-tributary-dash'
const TRIB_LABELS = 'lyr-tributary-labels'
const TRIB_GEOJSON_URL = '/asset/mula-mutha-tributaries.geojson'
const EROSION_SOURCE = 'src-erosion'
const EROSION_RASTER = 'lyr-erosion'
const EROSION_JSON_URL = '/asset/mula-mutha-erosion-hotspots.json'

const TRIB_COLOR = [
  'match',
  ['get', 'class'],
  'mainstem',
  '#1d4e89',
  'stream',
  '#12b5a8',
  'drain',
  '#f4a261',
  'canal',
  '#3d8bfd',
  'ditch',
  '#8d99ae',
  '#5ad2f4',
]

const TRIB_WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  11,
  ['match', ['get', 'class'], 'mainstem', 2.4, 'stream', 1.6, 'drain', 1.5, 1.3],
  15,
  ['match', ['get', 'class'], 'mainstem', 5.2, 'stream', 3.1, 'drain', 2.7, 2.4],
]

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
  ensureImageRaster(SILT_CLASS_SOURCE, SILT_CLASS_RASTER, '/asset/mula-mutha-silt-class-2026-06.png', {
    'raster-opacity': 0.88,
    'raster-resampling': 'nearest',
  })
  ensureImageRaster(SILT_VOLUME_SOURCE, SILT_VOLUME_RASTER, '/asset/mula-mutha-silt-volume-2026-06.png', {
    'raster-opacity': 0.82,
    'raster-resampling': 'linear',
  })
  ensureImageRaster(EROSION_SOURCE, EROSION_RASTER, '/asset/mula-mutha-erosion-hotspots.png', {
    'raster-opacity': 0.88,
    'raster-resampling': 'nearest',
  })

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

  if (!map.getSource(TRIB_SOURCE)) {
    map.addSource(TRIB_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: TRIB_GLOW,
      type: 'line',
      source: TRIB_SOURCE,
      filter: ['in', ['get', 'class'], ['literal', ['mainstem', 'stream', 'feeder', 'drain']]],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': TRIB_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5.2, 15, 9],
        'line-opacity': 0.28,
        'line-blur': 1.4,
      },
    })
    map.addLayer({
      id: TRIB_LINE,
      type: 'line',
      source: TRIB_SOURCE,
      filter: ['in', ['get', 'class'], ['literal', ['mainstem', 'stream', 'feeder', 'drain']]],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': TRIB_COLOR,
        'line-width': TRIB_WIDTH,
        'line-opacity': 0.96,
      },
    })
    map.addLayer({
      id: TRIB_DASH,
      type: 'line',
      source: TRIB_SOURCE,
      filter: ['in', ['get', 'class'], ['literal', ['canal', 'ditch']]],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': TRIB_COLOR,
        'line-width': TRIB_WIDTH,
        'line-opacity': 0.9,
        'line-dasharray': [1.6, 1.3],
      },
    })
    map.addLayer({
      id: TRIB_LABELS,
      type: 'symbol',
      source: TRIB_SOURCE,
      filter: ['!=', ['get', 'name'], null],
      minzoom: 12.2,
      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-max-angle': 30,
        'text-padding': 2,
      },
      paint: {
        'text-color': '#073b4c',
        'text-halo-color': 'rgba(255, 255, 255, 0.92)',
        'text-halo-width': 1.4,
      },
    })
  }

  // Chainage sits last so km marks stay readable over depth.
  if (!map.getSource(CHAINAGE_BIN_SOURCE)) {
    map.addSource(CHAINAGE_BIN_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: CHAINAGE_BIN_FILL,
      type: 'fill',
      source: CHAINAGE_BIN_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#ffd166',
        'fill-opacity': 0.1,
      },
    })
    map.addLayer({
      id: CHAINAGE_BIN_ACTIVE,
      type: 'fill',
      source: CHAINAGE_BIN_SOURCE,
      filter: ['==', ['get', 'kind'], '__none__'],
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': 0,
      },
    })
    map.addLayer({
      id: CHAINAGE_BIN_LINE,
      type: 'line',
      source: CHAINAGE_BIN_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#ffd166',
        'line-width': 1.4,
        'line-opacity': 0.9,
      },
    })
  }
  if (map.getLayer(CHAINAGE_BIN_ACTIVE)) {
    map.setPaintProperty(CHAINAGE_BIN_ACTIVE, 'fill-color', '#ffffff')
    map.setPaintProperty(CHAINAGE_BIN_ACTIVE, 'fill-opacity', 0)
  }
  if (!map.getLayer(CHAINAGE_BIN_GLOW)) {
    map.addLayer({
      id: CHAINAGE_BIN_GLOW,
      type: 'line',
      source: CHAINAGE_BIN_SOURCE,
      filter: ['==', ['get', 'kind'], '__none__'],
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#ff6a00',
        'line-width': 10,
        'line-blur': 7,
        'line-opacity': 0.95,
      },
    })
  }
  if (!map.getLayer(CHAINAGE_BIN_SELECTED)) {
    map.addLayer({
      id: CHAINAGE_BIN_SELECTED,
      type: 'line',
      source: CHAINAGE_BIN_SOURCE,
      filter: ['==', ['get', 'kind'], '__none__'],
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#ff7a18',
        'line-width': 2.6,
        'line-opacity': 1,
      },
    })
  }
  if (!map.getSource(CHAINAGE_SOURCE)) {
    map.addSource(CHAINAGE_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: CHAINAGE_TICKS,
      type: 'circle',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], false]],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 4.2],
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
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 16, 6.5],
        'circle-color': '#ffd166',
        'circle-stroke-width': 1.6,
        'circle-stroke-color': '#1a1a1a',
      },
    })
    map.addLayer({
      id: CHAINAGE_FOCUS,
      type: 'circle',
      source: CHAINAGE_SOURCE,
      filter: ['==', ['get', 'name'], ''],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 11],
        'circle-color': '#f4c430',
        'circle-stroke-width': 2.4,
        'circle-stroke-color': '#fff8e7',
        'circle-opacity': 0.95,
      },
    })
    map.addLayer({
      id: CHAINAGE_LABELS_MAJOR,
      type: 'symbol',
      source: CHAINAGE_SOURCE,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['==', ['get', 'major'], true]],
      minzoom: 10.5,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
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
  showSiltClassLayer = false,
  showSiltVolumeLayer = false,
  siltPeriodId = 5,
  showBiodiversityTypeLayer = false,
  showBiodiversityHealthLayer = false,
  showClimateFloodHeat = false,
  showClimateWaterHeat = false,
  climatePeriodId = 4,
  showChainageLayer = false,
  showTributaryLayer = false,
  showMainStemLayer = false,
  showErosionLayer = false,
  floodZones = null,
  focusChainage = null,
  onSelectChainage,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapReadyRef = useRef(false)
  const mapLayerRef = useRef(mapLayer)
  const wqMetaRef = useRef(null)
  const depthLoadedRef = useRef(false)
  const urbanVegLoadedRef = useRef(false)
  const siltMetaRef = useRef(null)
  const biodiversityMetaRef = useRef(null)
  const climatePointsRef = useRef({})
  const chainageLoadedRef = useRef(false)
  const onSelectChainageRef = useRef(onSelectChainage)
  onSelectChainageRef.current = onSelectChainage
  const tributaryLoadedRef = useRef(false)
  const tributaryPopupRef = useRef(null)
  const erosionMetaRef = useRef(null)
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
          wqMetaRef.current = await fetchAssetJson(WQ_JSON_URL, 'Water-quality overlays')
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
          const meta = await fetchAssetJson(DEPTH_META_URL, 'Depth layer')
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
          const doc = await fetchAssetJson(URBAN_VEG_JSON_URL, 'Urban vegetation')
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

    const anyOn = showSiltClassLayer || showSiltVolumeLayer
    if (!anyOn) {
      setVisibility(SILT_CLASS_RASTER, false)
      setVisibility(SILT_VOLUME_RASTER, false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!siltMetaRef.current) {
          siltMetaRef.current = await fetchAssetJson(SILT_JSON_URL, 'Silt classification')
        }
        if (cancelled) return

        const periodId = Number.isFinite(siltPeriodId) ? siltPeriodId : 5
        const period = siltMetaRef.current.periods?.find((row) => row.id === periodId)
          || siltMetaRef.current.periods?.[0]
        if (!period) throw new Error('Silt classification has no periods')

        const classSource = map.getSource(SILT_CLASS_SOURCE)
        if (
          classSource?.updateImage
          && period.classification?.raster
          && isValidImageCoordinates(period.imageCoordinates)
        ) {
          classSource.updateImage({
            url: period.classification.raster,
            coordinates: period.imageCoordinates,
          })
        }

        const volumeSource = map.getSource(SILT_VOLUME_SOURCE)
        const volumeCoords = period.volume?.imageCoordinates || period.imageCoordinates
        if (
          volumeSource?.updateImage
          && period.volume?.raster
          && isValidImageCoordinates(volumeCoords)
        ) {
          volumeSource.updateImage({
            url: period.volume.raster,
            coordinates: volumeCoords,
          })
        }

        setVisibility(SILT_CLASS_RASTER, showSiltClassLayer)
        setVisibility(SILT_VOLUME_RASTER, showSiltVolumeLayer)
      } catch (error) {
        console.error('Failed to load silt overlays', error)
        if (!cancelled) {
          setVisibility(SILT_CLASS_RASTER, false)
          setVisibility(SILT_VOLUME_RASTER, false)
        }
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showSiltClassLayer, showSiltVolumeLayer, siltPeriodId, mapReady])

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
          biodiversityMetaRef.current = await fetchAssetJson(BIODIV_JSON_URL, 'Biodiversity')
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
          climatePointsRef.current[period] = await fetchAssetJson(
            `/asset/mula-mutha-flood-water-${period}.json`,
            'Climate heatmap',
          )
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
      ;[
        CHAINAGE_BIN_FILL,
        CHAINAGE_BIN_ACTIVE,
        CHAINAGE_BIN_LINE,
        CHAINAGE_BIN_GLOW,
        CHAINAGE_BIN_SELECTED,
        CHAINAGE_TICKS,
        CHAINAGE_MAJOR,
        CHAINAGE_FOCUS,
        CHAINAGE_LABELS_MAJOR,
        CHAINAGE_LABELS_MINOR,
      ].forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value)
      })
    }

    if (!showChainageLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!chainageLoadedRef.current) {
          chainageLoadedRef.current = await fetchAssetJson(CHAINAGE_GEOJSON_URL, 'Chainage layer')
        }
        const geojson = chainageLoadedRef.current
        if (cancelled || !geojson) return
        map.getSource(CHAINAGE_SOURCE)?.setData(geojson)
        map.getSource(CHAINAGE_BIN_SOURCE)?.setData(
          buildChainageBins(geojson, geometryToCoordinates(drawnGeometry, uploadedKML)),
        )
        setVisibility(true)
      } catch (error) {
        console.error('Failed to load chainage layer', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    const stationFromEvent = (event) => {
      const feature = event.features?.[0]
      if (!feature || feature.properties?.kind !== 'station') return null
      const [lng, lat] = feature.geometry?.coordinates || []
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return {
        name: feature.properties.name,
        chainage_m: Number(feature.properties.chainage_m) || 0,
        major: Boolean(feature.properties.major),
        lng,
        lat,
      }
    }

    const onStationClick = (event) => {
      const station = stationFromEvent(event)
      if (station) onSelectChainageRef.current?.(station)
    }

    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    const onBinClick = (event) => {
      const feature = event.features?.[0]
      if (!feature?.properties) return
      const lng = Number(feature.properties.center_lng)
      const lat = Number(feature.properties.center_lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      onSelectChainageRef.current?.({
        name: feature.properties.from,
        chainage_m: Number(feature.properties.start_m) || 0,
        major: true,
        lng,
        lat,
      })
    }

    if (showChainageLayer) {
      map.on('click', CHAINAGE_MAJOR, onStationClick)
      map.on('click', CHAINAGE_TICKS, onStationClick)
      map.on('click', CHAINAGE_BIN_FILL, onBinClick)
      map.on('click', CHAINAGE_BIN_ACTIVE, onBinClick)
      map.on('click', CHAINAGE_BIN_GLOW, onBinClick)
      map.on('click', CHAINAGE_BIN_SELECTED, onBinClick)
      map.on('mouseenter', CHAINAGE_MAJOR, onEnter)
      map.on('mouseenter', CHAINAGE_TICKS, onEnter)
      map.on('mouseenter', CHAINAGE_BIN_FILL, onEnter)
      map.on('mouseenter', CHAINAGE_BIN_ACTIVE, onEnter)
      map.on('mouseleave', CHAINAGE_MAJOR, onLeave)
      map.on('mouseleave', CHAINAGE_TICKS, onLeave)
      map.on('mouseleave', CHAINAGE_BIN_FILL, onLeave)
      map.on('mouseleave', CHAINAGE_BIN_ACTIVE, onLeave)
    }

    return () => {
      cancelled = true
      map.off('click', CHAINAGE_MAJOR, onStationClick)
      map.off('click', CHAINAGE_TICKS, onStationClick)
      map.off('click', CHAINAGE_BIN_FILL, onBinClick)
      map.off('click', CHAINAGE_BIN_ACTIVE, onBinClick)
      map.off('click', CHAINAGE_BIN_GLOW, onBinClick)
      map.off('click', CHAINAGE_BIN_SELECTED, onBinClick)
      map.off('mouseenter', CHAINAGE_MAJOR, onEnter)
      map.off('mouseenter', CHAINAGE_TICKS, onEnter)
      map.off('mouseenter', CHAINAGE_BIN_FILL, onEnter)
      map.off('mouseenter', CHAINAGE_BIN_ACTIVE, onEnter)
      map.off('mouseleave', CHAINAGE_MAJOR, onLeave)
      map.off('mouseleave', CHAINAGE_TICKS, onLeave)
      map.off('mouseleave', CHAINAGE_BIN_FILL, onLeave)
      map.off('mouseleave', CHAINAGE_BIN_ACTIVE, onLeave)
    }
  }, [showChainageLayer, mapReady, drawnGeometry, uploadedKML])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      if (map.getLayer(EROSION_RASTER)) {
        map.setLayoutProperty(EROSION_RASTER, 'visibility', visible ? 'visible' : 'none')
      }
    }

    if (!showErosionLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!erosionMetaRef.current) {
          erosionMetaRef.current = await fetchAssetJson(EROSION_JSON_URL, 'Erosion hotspots')
        }
        if (cancelled) return
        const doc = erosionMetaRef.current
        const source = map.getSource(EROSION_SOURCE)
        if (source?.updateImage && doc?.raster && isValidImageCoordinates(doc.imageCoordinates)) {
          source.updateImage({ url: doc.raster, coordinates: doc.imageCoordinates })
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load erosion overlay', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [showErosionLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const joining = ['stream', 'feeder', 'drain', 'canal', 'ditch']
    const solid = showMainStemLayer
      ? ['mainstem', 'stream', 'feeder', 'drain']
      : ['stream', 'feeder', 'drain']
    const dashed = ['canal', 'ditch']
    const named = showMainStemLayer
      ? ['all', ['!=', ['get', 'name'], null]]
      : ['all', ['!=', ['get', 'name'], null], ['in', ['get', 'class'], ['literal', joining]]]

    const applyFilters = () => {
      if (map.getLayer(TRIB_GLOW)) {
        map.setFilter(TRIB_GLOW, ['in', ['get', 'class'], ['literal', solid]])
      }
      if (map.getLayer(TRIB_LINE)) {
        map.setFilter(TRIB_LINE, ['in', ['get', 'class'], ['literal', solid]])
      }
      if (map.getLayer(TRIB_DASH)) {
        map.setFilter(TRIB_DASH, ['in', ['get', 'class'], ['literal', dashed]])
      }
      if (map.getLayer(TRIB_LABELS)) {
        map.setFilter(TRIB_LABELS, named)
      }
    }

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      ;[TRIB_GLOW, TRIB_LINE, TRIB_DASH, TRIB_LABELS].forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value)
      })
    }

    if (!showTributaryLayer && !showMainStemLayer) {
      setVisibility(false)
      tributaryPopupRef.current?.remove()
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!tributaryLoadedRef.current) {
          const geojson = await fetchAssetJson(TRIB_GEOJSON_URL, 'Joining streams')
          if (cancelled) return
          map.getSource(TRIB_SOURCE)?.setData(geojson)
          tributaryLoadedRef.current = true
        }
        if (cancelled) return
        applyFilters()
        setVisibility(true)
        if (!showTributaryLayer) {
          if (map.getLayer(TRIB_DASH)) map.setLayoutProperty(TRIB_DASH, 'visibility', 'none')
          if (map.getLayer(TRIB_GLOW)) {
            map.setFilter(TRIB_GLOW, ['==', ['get', 'class'], 'mainstem'])
          }
          if (map.getLayer(TRIB_LINE)) {
            map.setFilter(TRIB_LINE, ['==', ['get', 'class'], 'mainstem'])
          }
        }
        if (!showMainStemLayer && !showTributaryLayer) setVisibility(false)
      } catch (error) {
        console.error('Failed to load joining streams', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    const classLabel = {
      mainstem: 'Main stem',
      stream: 'Stream',
      feeder: 'Joining feeder',
      drain: 'Drain / nullah',
      canal: 'Canal',
      ditch: 'Ditch',
    }

    const onClick = (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      tributaryPopupRef.current?.remove()
      const props = feature.properties || {}
      const title = props.name || classLabel[props.class] || 'Waterway'
      const kind = [classLabel[props.class], props.waterway].filter(Boolean).join(' · ')
      tributaryPopupRef.current = new Popup({ closeButton: true, maxWidth: '220px', offset: 8 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font:600 13px Inter,system-ui,sans-serif;color:#0d2436">${title}</div>` +
            `<div style="margin-top:4px;font:500 11px Inter,system-ui,sans-serif;color:#3a5c73">${kind}</div>`,
        )
        .addTo(map)
    }

    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', TRIB_LINE, onClick)
    map.on('click', TRIB_DASH, onClick)
    map.on('mouseenter', TRIB_LINE, onEnter)
    map.on('mouseenter', TRIB_DASH, onEnter)
    map.on('mouseleave', TRIB_LINE, onLeave)
    map.on('mouseleave', TRIB_DASH, onLeave)

    return () => {
      cancelled = true
      map.off('click', TRIB_LINE, onClick)
      map.off('click', TRIB_DASH, onClick)
      map.off('mouseenter', TRIB_LINE, onEnter)
      map.off('mouseenter', TRIB_DASH, onEnter)
      map.off('mouseleave', TRIB_LINE, onLeave)
      map.off('mouseleave', TRIB_DASH, onLeave)
    }
  }, [showTributaryLayer, showMainStemLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !focusChainage) return
    const { lng, lat, name } = focusChainage
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return

    if (map.getLayer(CHAINAGE_FOCUS) && name) {
      map.setFilter(CHAINAGE_FOCUS, ['==', ['get', 'name'], name])
    }
    if (map.getLayer(CHAINAGE_BIN_ACTIVE)) {
      map.setFilter(CHAINAGE_BIN_ACTIVE, binFilterForChainage(focusChainage.chainage_m))
    }
    if (map.getLayer(CHAINAGE_BIN_GLOW)) {
      map.setFilter(CHAINAGE_BIN_GLOW, binFilterForChainage(focusChainage.chainage_m))
    }
    if (map.getLayer(CHAINAGE_BIN_SELECTED)) {
      map.setFilter(CHAINAGE_BIN_SELECTED, binFilterForChainage(focusChainage.chainage_m))
    }
    if (map.getLayer(CHAINAGE_BIN_FILL)) {
      map.setFilter(CHAINAGE_BIN_FILL, ['!', binFilterForChainage(focusChainage.chainage_m)])
    }
    if (map.getLayer(CHAINAGE_BIN_LINE)) {
      map.setFilter(CHAINAGE_BIN_LINE, ['!', binFilterForChainage(focusChainage.chainage_m)])
    }

    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 15.2),
      duration: 900,
      essential: true,
      padding: { top: 48, bottom: 96, left: 48, right: 96 },
    })
  }, [focusChainage, mapReady])

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
