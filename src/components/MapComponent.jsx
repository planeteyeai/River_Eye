import React, { useEffect, useRef, useCallback } from 'react'
import { Map, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { EMPTY_MAP_STYLE, BASEMAP_MAP, DEFAULT_BASEMAP } from '../lib/basemaps'
import { applyBasemap, applyTerrain3d, ensureBasemapLayers } from '../lib/applyBasemap'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { loadDtmGrid, renderInundationDataUrl } from '../lib/dtmInundation'
import { binFilterForChainage, buildChainageBins, formatChainage } from '../lib/chainageBins'
import { STATUS_COLORS as TWIN_STATUS_COLORS, shortName as twinShortName } from '../lib/floodApi'
import {
  buildRiverFlowPaths,
  destinationPoint,
  metersPerPixel,
  samplePath,
  streakCoordinates,
} from '../lib/riverFlow'
import { buildTributaryFlowData, tribFlowZoomT } from '../lib/tributaryJunctions'
import {
  colorsMatch,
  enrichClassHit,
  loadClassRaster,
  publishClassHover,
  sampleClassRaster,
} from '../lib/classRasterHover'
import './MapComponent.css'
import './DrawAreaComponent.css'

const DEFAULT_CENTER = [78.9629, 20.5937]
const DEFAULT_ZOOM = 5

/** Keep pan/zoom enabled like a typical web map (Google Maps style). */
const enableFlatMapNavigation = (map) => {
  map.dragPan.enable()
  map.scrollZoom.enable()
  map.doubleClickZoom.enable()
  map.touchZoomRotate.enable()
  map.boxZoom.enable()
  map.keyboard.enable()
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
}

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
const FLOOD_STAGE_SOURCE = 'src-flood-stage'
const FLOOD_STAGE_RASTER = 'lyr-flood-stage'
/** 1×1 transparent PNG — placeholder until the bathtub canvas is ready. */
const TRANSPARENT_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
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
const LULC_JSON_URL = '/asset/mula-mutha-lulc.json'
const LULC_SOURCE = 'src-lulc-overlay'
const LULC_RASTER = 'lyr-lulc-raster'
const LULC_POLY_SOURCE = 'src-lulc-polygons'
const LULC_POLY_FILL = 'lyr-lulc-poly-fill'
const LULC_POLY_LINE = 'lyr-lulc-poly-line'
const FLOOD_ZONE_SOURCE = 'src-flood-zones'
const FLOOD_ZONE_FILL = 'lyr-flood-zone-fill'
const FLOOD_ZONE_LINE = 'lyr-flood-zone-line'
const TWIN_ASSET_SOURCE = 'src-twin-assets'
const TWIN_ASSET_LAYER = 'lyr-twin-assets'
const TWIN_ASSET_LABELS = 'lyr-twin-asset-labels'
const WRD_LINE_SOURCE = 'src-wrd-floodlines'
const WRD_LINE_LAYER = 'lyr-wrd-floodlines'
const WRD_LINE_GEOJSON_URL = '/asset/mula-mutha-wrd-floodlines.geojson'
const GARBAGE_SOURCE = 'src-garbage'
const GARBAGE_LAYER = 'lyr-garbage'
const GARBAGE_LABELS = 'lyr-garbage-labels'
const GARBAGE_GEOJSON_URL = '/asset/mula-mutha-garbage-locations.geojson'
const NDSI_SALINITY_SOURCE = 'src-ndsi-salinity'
const NDSI_SALINITY_FILL = 'lyr-ndsi-salinity-fill'
const NDSI_SALINITY_LINE = 'lyr-ndsi-salinity-line'
const NDSI_SALINITY_GEOJSON_URL = '/asset/mula-mutha-ndsi-salinity.geojson'
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
const CHAINAGE_FOCUS_LABEL = 'lyr-chainage-focus-label'
const CHAINAGE_LABELS_MAJOR = 'lyr-chainage-labels-km'
const CHAINAGE_LABELS_MINOR = 'lyr-chainage-labels-100m'
const CHAINAGE_GEOJSON_URL = '/asset/mula-mutha-chainage.geojson'
const TRIB_SOURCE = 'src-tributaries'
const TRIB_GLOW = 'lyr-tributary-glow'
const TRIB_LINE = 'lyr-tributary-line'
const TRIB_DASH = 'lyr-tributary-dash'
const TRIB_LABELS = 'lyr-tributary-labels'
const TRIB_GEOJSON_URL = '/asset/mula-mutha-tributaries.geojson'
const TRIB_FLOW_SOURCE = 'src-tributary-flow'
const TRIB_FLOW_SHEEN = 'lyr-tributary-flow-sheen'
const TRIB_FLOW_GLOW = 'lyr-tributary-flow-glow'
const TRIB_FLOW = 'lyr-tributary-flow'
const TRIB_ANIM_LAYERS = [TRIB_FLOW_SHEEN, TRIB_FLOW_GLOW, TRIB_FLOW]

const raiseTributaryFlowToTop = (map) => {
  TRIB_ANIM_LAYERS.forEach((layerId) => {
    if (!map.getLayer(layerId)) return
    // Stay under twin-asset pins so the animation never covers EMB/HAB markers.
    if (map.getLayer(TWIN_ASSET_LAYER)) map.moveLayer(layerId, TWIN_ASSET_LAYER)
    else map.moveLayer(layerId)
  })
}

const startTributaryFlowLoop = (map, showTributaryLayerRef, pathsRef) => {
  if (map.__tributaryFlowLoopStarted) return
  map.__tributaryFlowLoopStarted = true

  let lastTime = 0
  let frames = 0
  let animVisible = null
  let phases = null

  const setAnimVisibility = (visible) => {
    if (animVisible === visible) return
    animVisible = visible
    const value = visible ? 'visible' : 'none'
    TRIB_ANIM_LAYERS.forEach((layerId) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value)
    })
    if (!visible) {
      map.getSource(TRIB_FLOW_SOURCE)?.setData(EMPTY_COLLECTION)
    }
  }

  const tick = (timestamp) => {
    map.__tributaryFlowRaf = requestAnimationFrame(tick)

    if (!map.getLayer(TRIB_FLOW)) return

    if (!showTributaryLayerRef.current) {
      setAnimVisibility(false)
      lastTime = timestamp
      return
    }

    setAnimVisibility(true)

    const paths = pathsRef.current
    if (!paths?.length) {
      lastTime = timestamp
      return
    }

    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0
    lastTime = timestamp
    if (!dt) return

    if (!phases || phases.length !== paths.length) {
      phases = new Float64Array(paths.length)
      for (let i = 0; i < paths.length; i += 1) phases[i] = (i * 0.37) % 1
    }

    const zoom = map.getZoom()
    const mPerPx = metersPerPixel(map.getCenter().lat, zoom)
    const zoomT = tribFlowZoomT(zoom)
    // World-space speed (m/s) so zooming does not make dashes jump.
    const speedM = 18 + 22 * zoomT
    const spacingM = 55 - 18 * zoomT
    const streakLenM = 16 + 10 * zoomT

    const features = []
    for (let p = 0; p < paths.length; p += 1) {
      const path = paths[p]
      if (!path?.len || path.len < 40) continue

      phases[p] = (phases[p] + (speedM * dt) / path.len) % 1
      const count = Math.max(2, Math.min(14, Math.round(path.len / spacingM)))

      for (let j = 0; j < count; j += 1) {
        const phase = (phases[p] + j / count) % 1
        const dist = phase * path.len
        const coords = streakCoordinates(path, dist, streakLenM, 0)
        // Soft ends so individual wraps never read as a full-pattern pause.
        const fade = Math.min(1, phase / 0.05) * Math.min(1, (1 - phase) / 0.04)
        const opacity = Number((0.55 + 0.4 * fade).toFixed(3))
        if (opacity < 0.08) continue

        features.push({
          type: 'Feature',
          properties: {
            w: Number((1.4 + 1.2 * zoomT + (j % 3) * 0.15).toFixed(2)),
            o: opacity,
          },
          geometry: { type: 'LineString', coordinates: coords },
        })
      }
    }

    map.getSource(TRIB_FLOW_SOURCE)?.setData({ type: 'FeatureCollection', features })

    frames += 1
    if (frames % 45 === 0) raiseTributaryFlowToTop(map)
  }

  map.__tributaryFlowRaf = requestAnimationFrame(tick)

  const onVis = () => {
    if (!document.hidden) lastTime = 0
  }
  document.addEventListener('visibilitychange', onVis)
  map.__tributaryFlowVisHandler = onVis
}

const RIVER_PATH_SOURCE = 'src-river-flow-path'
const RIVER_STREAK_SOURCE = 'src-river-flow-streaks'
const RIVER_SPARK_SOURCE = 'src-river-flow-sparks'
const RIVER_BODY = 'lyr-river-flow-body'
const RIVER_SHEEN = 'lyr-river-flow-sheen'
const RIVER_STREAK_GLOW = 'lyr-river-flow-streak-glow'
const RIVER_STREAK = 'lyr-river-flow-streak'
const RIVER_SPARK = 'lyr-river-flow-spark'
const EROSION_SOURCE = 'src-erosion'
const EROSION_RASTER = 'lyr-erosion'
const EROSION_JSON_URL = '/asset/mula-mutha-erosion-hotspots.json'
const LITHOLOGY_SOURCE = 'src-lithology'
const LITHOLOGY_RASTER = 'lyr-lithology'
const LITHOLOGY_JSON_URL = '/asset/mula-mutha-spectral-lithology.json'

const TRIB_CLASS_COLOR = {
  mainstem: '#1d4e89',
  stream: '#12b5a8',
  drain: '#f4a261',
  canal: '#3d8bfd',
  ditch: '#8d99ae',
  feeder: '#5ad2f4',
}

const TRIB_COLOR = [
  'match',
  ['get', 'class'],
  'mainstem',
  TRIB_CLASS_COLOR.mainstem,
  'stream',
  TRIB_CLASS_COLOR.stream,
  'drain',
  TRIB_CLASS_COLOR.drain,
  'canal',
  TRIB_CLASS_COLOR.canal,
  'ditch',
  TRIB_CLASS_COLOR.ditch,
  TRIB_CLASS_COLOR.feeder,
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

// Chainage reference scale sits under thematic overlays (rasters / vectors).
// Scrubber focus is re-raised above themes after stacking — see raiseTheme….
const CHAINAGE_STACK = [
  CHAINAGE_BIN_FILL,
  CHAINAGE_BIN_ACTIVE,
  CHAINAGE_BIN_LINE,
  CHAINAGE_BIN_GLOW,
  CHAINAGE_BIN_SELECTED,
  CHAINAGE_TICKS,
  CHAINAGE_MAJOR,
  CHAINAGE_FOCUS,
  CHAINAGE_FOCUS_LABEL,
  CHAINAGE_LABELS_MAJOR,
  CHAINAGE_LABELS_MINOR,
]

/** Thematic layers that must sit above chainage (bottom → top). */
const THEME_ABOVE_CHAINAGE = [
  TSS_RASTER,
  NDCI_RASTER,
  NDWI_RASTER,
  WST_RASTER,
  DEPTH_RASTER,
  FLOOD_STAGE_RASTER,
  SILT_CLASS_RASTER,
  SILT_VOLUME_RASTER,
  LULC_RASTER,
  LULC_POLY_FILL,
  LULC_POLY_LINE,
  EROSION_RASTER,
  LITHOLOGY_RASTER,
  BIODIV_TYPE_RASTER,
  BIODIV_HEALTH_RASTER,
  CLIMATE_WATER_HEAT,
  CLIMATE_FLOOD_HEAT,
  URBAN_VEG_FILL,
  URBAN_VEG_LINE,
  FLOOD_ZONE_FILL,
  FLOOD_ZONE_LINE,
  NDSI_SALINITY_FILL,
  NDSI_SALINITY_LINE,
  WRD_LINE_LAYER,
  TRIB_GLOW,
  TRIB_LINE,
  TRIB_DASH,
  TRIB_FLOW_SHEEN,
  TRIB_FLOW_GLOW,
  TRIB_FLOW,
  TRIB_LABELS,
  GARBAGE_LAYER,
  GARBAGE_LABELS,
]

const raiseTwinAssetsToTop = (map) => {
  ;[TWIN_ASSET_LAYER, TWIN_ASSET_LABELS].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId)
  })
}

/** Theme rasters above base chainage; scrubber playhead + its label above themes; twin pins on top. */
const raiseThemeLayersAboveChainage = (map) => {
  THEME_ABOVE_CHAINAGE.forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId)
  })
  // Only the active scrubber station (point + number) stays above theme rasters.
  ;[CHAINAGE_FOCUS, CHAINAGE_FOCUS_LABEL].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId)
  })
  raiseTwinAssetsToTop(map)
}

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

const twinAssetsToCollection = (assets) => ({
  type: 'FeatureCollection',
  features: (assets || [])
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon))
    .map((row) => ({
      type: 'Feature',
      properties: {
        id: row.id,
        name: twinShortName(row.name || row.id),
        type: row.type || '',
        status: row.status || 'SAFE',
        color: TWIN_STATUS_COLORS[row.status] || '#6b8798',
        margin_now_m: row.margin_now_m,
        chainage_m: row.chainage_m,
        chainage: Number.isFinite(row.chainage_m) ? formatChainage(row.chainage_m) : '',
      },
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
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

  if (!map.getSource(TWIN_ASSET_SOURCE)) {
    map.addSource(TWIN_ASSET_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: TWIN_ASSET_LAYER,
      type: 'circle',
      source: TWIN_ASSET_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 7, 15, 11],
        'circle-color': ['coalesce', ['get', 'color'], '#c2372a'],
        'circle-stroke-width': 2.4,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1,
      },
    })
    map.addLayer({
      id: TWIN_ASSET_LABELS,
      type: 'symbol',
      source: TWIN_ASSET_SOURCE,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'id'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(12, 18, 22, 0.92)',
        'text-halo-width': 1.8,
      },
    })
  }

  if (!map.getSource(WRD_LINE_SOURCE)) {
    map.addSource(WRD_LINE_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: WRD_LINE_LAYER,
      type: 'line',
      source: WRD_LINE_SOURCE,
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'match',
          ['get', 'line'],
          'red',
          2.4,
          'blue',
          2.2,
          'green',
          1.8,
          2,
        ],
        'line-opacity': 0.92,
      },
    })
  }

  if (!map.getSource(GARBAGE_SOURCE)) {
    map.addSource(GARBAGE_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: GARBAGE_LAYER,
      type: 'circle',
      source: GARBAGE_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 8],
        'circle-color': '#c45c26',
        'circle-stroke-width': 1.6,
        'circle-stroke-color': '#fff8f0',
        'circle-opacity': 0.95,
      },
    })
    map.addLayer({
      id: GARBAGE_LABELS,
      type: 'symbol',
      source: GARBAGE_SOURCE,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#5a2e14',
        'text-halo-color': '#fff8f0',
        'text-halo-width': 1.2,
      },
    })
  }

  if (!map.getSource(NDSI_SALINITY_SOURCE)) {
    map.addSource(NDSI_SALINITY_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: NDSI_SALINITY_FILL,
      type: 'fill',
      source: NDSI_SALINITY_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#888888'],
        'fill-opacity': 0.78,
      },
    })
    map.addLayer({
      id: NDSI_SALINITY_LINE,
      type: 'line',
      source: NDSI_SALINITY_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#888888'],
        'line-width': 0.6,
        'line-opacity': 0.55,
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
  ensureImageRaster(LULC_SOURCE, LULC_RASTER, '/asset/mula-mutha-lulc-2025.png', {
    'raster-opacity': 0.82,
    'raster-resampling': 'nearest',
  })
  if (!map.getSource(LULC_POLY_SOURCE)) {
    map.addSource(LULC_POLY_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: LULC_POLY_FILL,
      type: 'fill',
      source: LULC_POLY_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#888888'],
        'fill-opacity': 0.72,
      },
    })
    map.addLayer({
      id: LULC_POLY_LINE,
      type: 'line',
      source: LULC_POLY_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#555555'],
        'line-width': 0.6,
        'line-opacity': 0.55,
      },
    })
  }
  ensureImageRaster(EROSION_SOURCE, EROSION_RASTER, '/asset/mula-mutha-erosion-hotspots.png', {
    'raster-opacity': 0.88,
    'raster-resampling': 'linear',
  })
  ensureImageRaster(LITHOLOGY_SOURCE, LITHOLOGY_RASTER, '/asset/mula-mutha-spectral-lithology.png', {
    'raster-opacity': 0.88,
    'raster-resampling': 'nearest',
  })
  if (!map.getSource(FLOOD_STAGE_SOURCE)) {
    map.addSource(FLOOD_STAGE_SOURCE, {
      type: 'image',
      url: TRANSPARENT_1PX,
      coordinates: MULA_MUTHA_IMAGE_COORDS,
    })
    map.addLayer({
      id: FLOOD_STAGE_RASTER,
      type: 'raster',
      source: FLOOD_STAGE_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear',
      },
    })
  }

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
    map.addSource(TRIB_FLOW_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: TRIB_FLOW_SHEEN,
      type: 'line',
      source: TRIB_FLOW_SOURCE,
      interactive: false,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#7ec8e8',
        'line-width': ['*', ['get', 'w'], 2.4],
        'line-opacity': ['*', ['get', 'o'], 0.28],
        'line-blur': 2.4,
      },
    })
    map.addLayer({
      id: TRIB_FLOW_GLOW,
      type: 'line',
      source: TRIB_FLOW_SOURCE,
      interactive: false,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#b8f2ff',
        'line-width': ['*', ['get', 'w'], 1.7],
        'line-opacity': ['*', ['get', 'o'], 0.45],
        'line-blur': 1.2,
      },
    })
    map.addLayer({
      id: TRIB_FLOW,
      type: 'line',
      source: TRIB_FLOW_SOURCE,
      interactive: false,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e8f8ff',
        'line-width': ['get', 'w'],
        'line-opacity': ['get', 'o'],
      },
    })
  }

  // Soft channel + foam streaks along the chainage centreline (always on).
  if (!map.getSource(RIVER_PATH_SOURCE)) {
    map.addSource(RIVER_PATH_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addSource(RIVER_STREAK_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addSource(RIVER_SPARK_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
    map.addLayer({
      id: RIVER_BODY,
      type: 'line',
      source: RIVER_PATH_SOURCE,
      interactive: false,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1a6fa8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 22, 16, 34],
        'line-opacity': 0.22,
        'line-blur': 2.4,
      },
    })
    map.addLayer({
      id: RIVER_SHEEN,
      type: 'line',
      source: RIVER_PATH_SOURCE,
      interactive: false,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#7ec8e8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.2, 14, 7, 16, 11],
        'line-opacity': 0.38,
        'line-blur': 0.6,
        'line-dasharray': [0.8, 1.6],
      },
    })
    map.addLayer({
      id: RIVER_STREAK_GLOW,
      type: 'line',
      source: RIVER_STREAK_SOURCE,
      interactive: false,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#c8f0ff',
        'line-width': ['*', ['get', 'w'], 2.6],
        'line-opacity': ['*', ['get', 'o'], 0.45],
        'line-blur': 1.8,
      },
    })
    map.addLayer({
      id: RIVER_STREAK,
      type: 'line',
      source: RIVER_STREAK_SOURCE,
      interactive: false,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e8f8ff',
        'line-width': ['get', 'w'],
        'line-opacity': ['get', 'o'],
      },
    })
    map.addLayer({
      id: RIVER_SPARK,
      type: 'circle',
      source: RIVER_SPARK_SOURCE,
      interactive: false,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          ['*', ['get', 's'], 1.4],
          15,
          ['*', ['get', 's'], 2.6],
        ],
        'circle-color': '#ffffff',
        'circle-opacity': ['get', 'o'],
        'circle-blur': 0.35,
      },
    })
    ;[RIVER_BODY, RIVER_SHEEN, RIVER_STREAK_GLOW, RIVER_STREAK, RIVER_SPARK].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
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
      id: CHAINAGE_FOCUS_LABEL,
      type: 'symbol',
      source: CHAINAGE_SOURCE,
      filter: ['==', ['get', 'name'], ''],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Open Sans Regular'],
        'text-size': 12,
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffd166',
        'text-halo-color': 'rgba(12, 18, 22, 0.92)',
        'text-halo-width': 1.8,
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

  raiseTwinAssetsToTop(map)
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
  showFloodStageLayer = false,
  floodStageM = null,
  showUrbanVegLayer = false,
  showSiltClassLayer = false,
  showSiltVolumeLayer = false,
  siltPeriodId = 5,
  showLulcLayer = false,
  lulcPeriodId = 4,
  showBiodiversityTypeLayer = false,
  showBiodiversityHealthLayer = false,
  showClimateFloodHeat = false,
  showClimateWaterHeat = false,
  climatePeriodId = 4,
  showChainageLayer = false,
  showTributaryLayer = false,
  showMainStemLayer = false,
  showErosionLayer = false,
  showLithologyLayer = false,
  showWrdFloodlines = false,
  showGarbageLayer = false,
  showNdsiSalinityLayer = false,
  floodZones = null,
  twinAssets = null,
  selectedTwinAssetId = null,
  onSelectTwinAsset,
  focusChainage = null,
  onSelectChainage,
  studyBounds = null,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapReadyRef = useRef(false)
  const mapLayerRef = useRef(mapLayer)
  const wqMetaRef = useRef(null)
  const depthMetaRef = useRef(null)
  const depthLoadedRef = useRef(false)
  const urbanVegLoadedRef = useRef(false)
  const siltMetaRef = useRef(null)
  const lulcMetaRef = useRef(null)
  const biodiversityMetaRef = useRef(null)
  const climatePointsRef = useRef({})
  const chainageLoadedRef = useRef(false)
  const onSelectChainageRef = useRef(onSelectChainage)
  onSelectChainageRef.current = onSelectChainage
  const onSelectTwinAssetRef = useRef(onSelectTwinAsset)
  onSelectTwinAssetRef.current = onSelectTwinAsset
  const tributaryGeojsonRef = useRef(null)
  const tributaryFlowPathsRef = useRef([])
  const tributaryPopupRef = useRef(null)
  const showTributaryLayerRef = useRef(showTributaryLayer)
  showTributaryLayerRef.current = showTributaryLayer
  const riverFlowAnimRef = useRef(null)
  const riverFlowPathsRef = useRef([])
  const riverFlowReadyRef = useRef(false)
  const riverSheenStepRef = useRef(0)
  const wrdLinesLoadedRef = useRef(false)
  const garbageLoadedRef = useRef(false)
  const garbagePopupRef = useRef(null)
  const ndsiSalinityLoadedRef = useRef(false)
  const ndsiSalinityPopupRef = useRef(null)
  const twinAssetPopupRef = useRef(null)
  const twinAssetsFitRef = useRef(false)
  const erosionMetaRef = useRef(null)
  const lithologyMetaRef = useRef(null)
  const lulcPeriodRef = useRef(null)
  const classNoteKeyRef = useRef('')
  const studyBoundsRef = useRef(studyBounds)
  studyBoundsRef.current = studyBounds
  const drawPointsRef = useRef([])
  const drawHandlersRef = useRef({ click: null, dblclick: null })
  const [drawPointCount, setDrawPointCount] = React.useState(0)
  const [isDrawingActive, setIsDrawingActive] = React.useState(false)
  const [mapReady, setMapReady] = React.useState(false)
  const [classNote, setClassNote] = React.useState(null)
  const [classNotePos, setClassNotePos] = React.useState({ x: 0, y: 0, flipX: false, flipY: false })

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
      preserveDrawingBuffer: true,
      fadeDuration: 0,
    })

    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    enableFlatMapNavigation(map)

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    const resizeTargets = [
      containerRef.current,
      containerRef.current?.closest('.map-wrapper'),
      containerRef.current?.closest('.map-stage-map'),
      containerRef.current?.closest('.map-stage-body'),
      containerRef.current?.closest('.map-stage'),
    ].filter(Boolean)
    resizeTargets.forEach((node) => resizeObserver.observe(node))

    map.on('load', () => {
      mapRef.current = map
      mapReadyRef.current = true
      enableFlatMapNavigation(map)

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
      startTributaryFlowLoop(map, showTributaryLayerRef, tributaryFlowPathsRef)
      setMapReady(true)
    })

    return () => {
      resizeObserver.disconnect()
      if (map.__tributaryFlowRaf) {
        cancelAnimationFrame(map.__tributaryFlowRaf)
        map.__tributaryFlowRaf = null
      }
      if (map.__tributaryFlowVisHandler) {
        document.removeEventListener('visibilitychange', map.__tributaryFlowVisHandler)
        map.__tributaryFlowVisHandler = null
      }
      map.__tributaryFlowLoopStarted = false
      mapReadyRef.current = false
      setMapReady(false)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    // Sidebar open/close only resizes the canvas — do not change zoom/center.
    let resizeTimer = null
    const onLayoutChange = () => {
      const map = mapRef.current
      if (!map || !mapReadyRef.current) return
      // Coalesce rapid layout pulses into one resize after paint.
      if (resizeTimer) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null
        map.resize()
        map.triggerRepaint?.()
      }, 0)
    }

    window.addEventListener('map-stage-layout-change', onLayoutChange)
    return () => {
      if (resizeTimer) window.clearTimeout(resizeTimer)
      window.removeEventListener('map-stage-layout-change', onLayoutChange)
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
          depthMetaRef.current = meta
          const source = map.getSource(DEPTH_SOURCE)
          if (source?.updateImage && meta?.raster && isValidImageCoordinates(meta.imageCoordinates)) {
            source.updateImage({ url: meta.raster, coordinates: meta.imageCoordinates })
            depthLoadedRef.current = true
          }
        }
        if (!cancelled) {
          setVisibility(true)
          raiseTwinAssetsToTop(map)
        }
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
      if (map.getLayer(FLOOD_STAGE_RASTER)) {
        map.setLayoutProperty(FLOOD_STAGE_RASTER, 'visibility', visible ? 'visible' : 'none')
      }
    }

    if (!showFloodStageLayer || !Number.isFinite(floodStageM)) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    let frame = 0
    const load = async () => {
      try {
        const { meta, elevations } = await loadDtmGrid()
        if (cancelled) return
        const url = renderInundationDataUrl(elevations, meta, floodStageM)
        if (cancelled) return
        const source = map.getSource(FLOOD_STAGE_SOURCE)
        const coords = meta?.coordinates
        if (source?.updateImage && isValidImageCoordinates(coords)) {
          source.updateImage({ url, coordinates: coords })
        }
        if (!cancelled) {
          setVisibility(true)
          if (map.getLayer(FLOOD_STAGE_RASTER)) {
            map.setPaintProperty(FLOOD_STAGE_RASTER, 'raster-resampling', 'linear')
            map.setPaintProperty(FLOOD_STAGE_RASTER, 'raster-opacity', 1)
          }
          raiseTwinAssetsToTop(map)
        }
      } catch (error) {
        console.error('Failed to render flood-stage inundation', error)
        if (!cancelled) setVisibility(false)
      }
    }

    frame = window.requestAnimationFrame(() => {
      load()
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [showFloodStageLayer, floodStageM, mapReady])

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

    if (!showLulcLayer) {
      setVisibility(LULC_RASTER, false)
      setVisibility(LULC_POLY_FILL, false)
      setVisibility(LULC_POLY_LINE, false)
      lulcPeriodRef.current = null
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!lulcMetaRef.current) {
          lulcMetaRef.current = await fetchAssetJson(LULC_JSON_URL, 'LULC')
        }
        if (cancelled) return

        const periodId = Number.isFinite(lulcPeriodId) ? lulcPeriodId : 4
        const period = lulcMetaRef.current.periods?.find((row) => row.id === periodId)
          || lulcMetaRef.current.periods?.[0]
        if (!period) throw new Error('LULC has no periods')
        lulcPeriodRef.current = period

        if (period.kind === 'polygons' && period.geojson) {
          const collection = await fetchAssetJson(period.geojson, 'LULC 2026 polygons')
          if (cancelled) return
          map.getSource(LULC_POLY_SOURCE)?.setData(collection || EMPTY_COLLECTION)
          setVisibility(LULC_RASTER, false)
          setVisibility(LULC_POLY_FILL, true)
          setVisibility(LULC_POLY_LINE, true)
          return
        }

        const rasterSource = map.getSource(LULC_SOURCE)
        if (
          rasterSource?.updateImage
          && period.raster
          && isValidImageCoordinates(period.imageCoordinates)
        ) {
          rasterSource.updateImage({
            url: period.raster,
            coordinates: period.imageCoordinates,
          })
        }
        map.getSource(LULC_POLY_SOURCE)?.setData(EMPTY_COLLECTION)
        setVisibility(LULC_POLY_FILL, false)
        setVisibility(LULC_POLY_LINE, false)
        setVisibility(LULC_RASTER, true)
      } catch (error) {
        console.error('Failed to load LULC overlay', error)
        if (!cancelled) {
          setVisibility(LULC_RASTER, false)
          setVisibility(LULC_POLY_FILL, false)
          setVisibility(LULC_POLY_LINE, false)
        }
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [showLulcLayer, lulcPeriodId, mapReady])

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
        CHAINAGE_FOCUS_LABEL,
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
        raiseThemeLayersAboveChainage(map)
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

  // Theme overlays (silt, LULC, WQ, …) stay above chainage; twin pins on top.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    raiseThemeLayersAboveChainage(map)
  }, [
    mapReady,
    showChainageLayer,
    showNdsiSalinityLayer,
    showTssLayer,
    showNdciLayer,
    showNdwiLayer,
    showWstLayer,
    showDepthLayer,
    showFloodStageLayer,
    showUrbanVegLayer,
    showSiltClassLayer,
    showSiltVolumeLayer,
    showLulcLayer,
    lulcPeriodId,
    showBiodiversityTypeLayer,
    showBiodiversityHealthLayer,
    showClimateFloodHeat,
    showClimateWaterHeat,
    showTributaryLayer,
    showMainStemLayer,
    showErosionLayer,
    showLithologyLayer,
    showWrdFloodlines,
    showGarbageLayer,
    floodZones,
    twinAssets,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    if (!showWrdFloodlines) {
      if (map.getLayer(WRD_LINE_LAYER)) {
        map.setLayoutProperty(WRD_LINE_LAYER, 'visibility', 'none')
      }
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!wrdLinesLoadedRef.current) {
          const geojson = await fetchAssetJson(WRD_LINE_GEOJSON_URL, 'WRD flood lines')
          if (cancelled) return
          map.getSource(WRD_LINE_SOURCE)?.setData(geojson)
          wrdLinesLoadedRef.current = true
        }
        if (cancelled || !map.getLayer(WRD_LINE_LAYER)) return
        map.setFilter(WRD_LINE_LAYER, ['in', ['get', 'line'], ['literal', ['blue', 'red', 'green']]])
        map.setLayoutProperty(WRD_LINE_LAYER, 'visibility', 'visible')
      } catch (error) {
        console.error('Failed to load WRD flood lines', error)
        if (!cancelled && map.getLayer(WRD_LINE_LAYER)) {
          map.setLayoutProperty(WRD_LINE_LAYER, 'visibility', 'none')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [showWrdFloodlines, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      ;[GARBAGE_LAYER, GARBAGE_LABELS].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value)
      })
    }

    if (!showGarbageLayer) {
      setVisibility(false)
      garbagePopupRef.current?.remove()
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!garbageLoadedRef.current) {
          const geojson = await fetchAssetJson(GARBAGE_GEOJSON_URL, 'Garbage locations')
          if (cancelled) return
          map.getSource(GARBAGE_SOURCE)?.setData(geojson)
          garbageLoadedRef.current = true
        }
        if (cancelled) return
        setVisibility(true)
      } catch (error) {
        console.error('Failed to load garbage locations', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    const onClick = (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      garbagePopupRef.current?.remove()
      const props = feature.properties || {}
      garbagePopupRef.current = new Popup({ closeButton: true, maxWidth: '220px', offset: 10 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font:600 13px Inter,system-ui,sans-serif;color:#0d2436">${props.name || 'Garbage site'}</div>` +
            `<div style="margin-top:4px;font:500 11px Inter,system-ui,sans-serif;color:#3a5c73">Detected solid-waste location · Estimated</div>`,
        )
        .addTo(map)
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', GARBAGE_LAYER, onClick)
    map.on('mouseenter', GARBAGE_LAYER, onEnter)
    map.on('mouseleave', GARBAGE_LAYER, onLeave)

    return () => {
      cancelled = true
      map.off('click', GARBAGE_LAYER, onClick)
      map.off('mouseenter', GARBAGE_LAYER, onEnter)
      map.off('mouseleave', GARBAGE_LAYER, onLeave)
    }
  }, [showGarbageLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const setVisibility = (visible) => {
      const value = visible ? 'visible' : 'none'
      ;[NDSI_SALINITY_FILL, NDSI_SALINITY_LINE].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value)
      })
    }

    if (!showNdsiSalinityLayer) {
      setVisibility(false)
      ndsiSalinityPopupRef.current?.remove()
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!ndsiSalinityLoadedRef.current) {
          const geojson = await fetchAssetJson(NDSI_SALINITY_GEOJSON_URL, 'NDSI salinity')
          if (cancelled) return
          map.getSource(NDSI_SALINITY_SOURCE)?.setData(geojson)
          ndsiSalinityLoadedRef.current = true
        }
        if (cancelled) return
        setVisibility(true)
        raiseThemeLayersAboveChainage(map)
      } catch (error) {
        console.error('Failed to load NDSI salinity', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()

    const onClick = (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      ndsiSalinityPopupRef.current?.remove()
      const props = feature.properties || {}
      ndsiSalinityPopupRef.current = new Popup({ closeButton: true, maxWidth: '240px', offset: 10 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font:600 13px Inter,system-ui,sans-serif;color:#0d2436">NDSI ${props.label || 'Salinity'}</div>` +
            `<div style="margin-top:4px;font:500 11px Inter,system-ui,sans-serif;color:#3a5c73">Range: ${props.range || '—'}</div>` +
            `<div style="margin-top:2px;font:500 11px Inter,system-ui,sans-serif;color:#6b8798">Odeh &amp; Onus (2008) · Estimated</div>`,
        )
        .addTo(map)
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', NDSI_SALINITY_FILL, onClick)
    map.on('mouseenter', NDSI_SALINITY_FILL, onEnter)
    map.on('mouseleave', NDSI_SALINITY_FILL, onLeave)

    return () => {
      cancelled = true
      map.off('click', NDSI_SALINITY_FILL, onClick)
      map.off('mouseenter', NDSI_SALINITY_FILL, onEnter)
      map.off('mouseleave', NDSI_SALINITY_FILL, onLeave)
    }
  }, [showNdsiSalinityLayer, showChainageLayer, mapReady])

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

    const setVisibility = (visible) => {
      if (map.getLayer(LITHOLOGY_RASTER)) {
        map.setLayoutProperty(LITHOLOGY_RASTER, 'visibility', visible ? 'visible' : 'none')
      }
    }

    if (!showLithologyLayer) {
      setVisibility(false)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      try {
        if (!lithologyMetaRef.current) {
          lithologyMetaRef.current = await fetchAssetJson(LITHOLOGY_JSON_URL, 'Spectral lithology')
        }
        if (cancelled) return
        const doc = lithologyMetaRef.current
        const source = map.getSource(LITHOLOGY_SOURCE)
        if (source?.updateImage && doc?.raster && isValidImageCoordinates(doc.imageCoordinates)) {
          source.updateImage({ url: doc.raster, coordinates: doc.imageCoordinates })
        }
        if (!cancelled) setVisibility(true)
      } catch (error) {
        console.error('Failed to load spectral lithology overlay', error)
        if (!cancelled) setVisibility(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [showLithologyLayer, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    const enabled =
      showLulcLayer ||
      showLithologyLayer ||
      showErosionLayer ||
      showSiltClassLayer ||
      showSiltVolumeLayer ||
      showBiodiversityTypeLayer ||
      showBiodiversityHealthLayer ||
      showNdsiSalinityLayer ||
      showTssLayer ||
      showNdciLayer ||
      showNdwiLayer ||
      showWstLayer ||
      showDepthLayer ||
      showFloodStageLayer ||
      showUrbanVegLayer ||
      showGarbageLayer ||
      showTributaryLayer ||
      showMainStemLayer ||
      showWrdFloodlines ||
      showClimateFloodHeat ||
      showClimateWaterHeat

    const publish = (note) => {
      const key = note ? `${note.layerId}:${note.label}:${note.value || ''}` : ''
      if (key !== classNoteKeyRef.current) {
        classNoteKeyRef.current = key
        publishClassHover(note)
      }
      setClassNote(note)
    }

    const updatePos = (event) => {
      const container = containerRef.current
      const x = event.point?.x ?? 0
      const y = event.point?.y ?? 0
      const width = container?.clientWidth || 0
      const height = container?.clientHeight || 0
      setClassNotePos({
        x,
        y,
        flipX: width > 0 && x > width - 220,
        flipY: height > 0 && y > height - 72,
      })
    }

    const noteFromHit = (layerId, layerTitle, hit) => {
      const enriched = enrichClassHit(layerId, hit)
      if (!enriched) return null
      return {
        ...enriched,
        layer: layerTitle,
      }
    }

    const sampleOverlay = async (
      lng,
      lat,
      {
        layerId,
        layerTitle,
        metaRef,
        jsonUrl,
        jsonLabel,
        rasterUrl,
        imageCoordinates,
        classes,
        maxDelta,
      },
    ) => {
      if (jsonUrl && metaRef) {
        try {
          if (!metaRef.current) {
            metaRef.current = await fetchAssetJson(jsonUrl, jsonLabel || layerTitle)
          }
        } catch {
          /* keep going */
        }
      }
      const doc = metaRef?.current
      const coords = imageCoordinates || doc?.imageCoordinates
      const classList = classes || doc?.classes || legendForLayer(layerId)?.colors
      const url = rasterUrl || doc?.raster
      if (!url || !coords) return null
      const raster = await loadClassRaster(url).catch(() => null)
      const hit = sampleClassRaster(raster, lng, lat, coords, classList, maxDelta)
      return noteFromHit(layerId, layerTitle, hit)
    }

    const queryFirst = (point, layerIds) => {
      const existing = layerIds.filter(
        (id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none',
      )
      if (!existing.length) return null
      return map.queryRenderedFeatures(point, { layers: existing })[0] || null
    }

    if (!enabled) {
      publish(null)
      return undefined
    }

    let cancelled = false
    let moveSeq = 0

    const onMove = async (event) => {
      if (cancelled) return
      const seq = ++moveSeq
      updatePos(event)
      const { lng, lat } = event.lngLat || {}

      // Point / line layers first (precise hits), then classed rasters top → bottom.
      if (showGarbageLayer) {
        const feat = queryFirst(event.point, [GARBAGE_LAYER])
        const props = feat?.properties
        if (props) {
          const legend = legendForLayer('garbage')?.colors?.[0]
          if (cancelled || seq !== moveSeq) return
          publish({
            layerId: 'garbage',
            layer: 'Garbage',
            label: props.name || legend?.label || 'Detected garbage site',
            value: props.label || legend?.value || '',
            color: legend?.color || '#c45c26',
          })
          return
        }
      }

      if (showWrdFloodlines) {
        const feat = queryFirst(event.point, [WRD_LINE_LAYER])
        const props = feat?.properties
        if (props?.line) {
          const lineKey = String(props.line).toLowerCase()
          const legend = legendForLayer('wrd-floodlines')?.colors || []
          const row =
            legend.find((item) => item.label.toLowerCase().includes(lineKey)) ||
            legend.find((item) => colorsMatch(item.color, props.color))
          if (cancelled || seq !== moveSeq) return
          publish({
            layerId: 'wrd-floodlines',
            layer: 'WRD flood lines',
            label: row?.label || `${props.line} line`,
            value: row?.value || props.sheet_title || 'survey',
            color: props.color || row?.color,
          })
          return
        }
      }

      if (showTributaryLayer || showMainStemLayer) {
        const feat = queryFirst(event.point, [TRIB_LINE, TRIB_DASH, TRIB_GLOW, TRIB_LABELS])
        const props = feat?.properties
        if (props?.class) {
          const cls = String(props.class)
          const isMain = cls === 'mainstem'
          if ((isMain && showMainStemLayer) || (!isMain && showTributaryLayer)) {
            const layerId = isMain ? 'mainstem' : 'tributaries'
            const stroke = TRIB_CLASS_COLOR[cls] || TRIB_CLASS_COLOR.feeder
            const legend = legendForLayer(layerId)?.colors || []
            const row =
              legend.find((item) => colorsMatch(item.color, stroke)) ||
              legend.find((item) => {
                const label = item.label.toLowerCase()
                if (cls === 'stream') return label.includes('named')
                if (cls === 'feeder') return label.includes('feeder')
                if (cls === 'drain') return label.includes('drain')
                if (cls === 'canal') return label.includes('canal')
                if (cls === 'ditch') return label.includes('ditch')
                if (cls === 'mainstem') return label.includes('main')
                return false
              }) ||
              legend[0]
            if (cancelled || seq !== moveSeq) return
            publish({
              layerId,
              layer: isMain ? 'Main stem' : 'Joining streams',
              label: props.name || row?.label || cls,
              value: row?.value || cls,
              color: row?.color || stroke,
            })
            return
          }
        }
      }

      if (showNdsiSalinityLayer) {
        const feat = queryFirst(event.point, [NDSI_SALINITY_FILL])
        const props = feat?.properties
        if (props?.label || props?.range) {
          const enriched = enrichClassHit('ndsi-salinity', {
            label: props.label || `NDSI ${props.range || ''}`.trim(),
            color: props.color,
            value: props.range || props.value,
          })
          if (enriched) {
            if (cancelled || seq !== moveSeq) return
            publish({ ...enriched, layer: 'NDSI salinity' })
            return
          }
        }
      }

      if (showUrbanVegLayer) {
        const feat = queryFirst(event.point, [URBAN_VEG_FILL])
        if (feat) {
          const legend = legendForLayer('urban-veg')?.colors || []
          if (cancelled || seq !== moveSeq) return
          publish({
            layerId: 'urban-veg',
            layer: 'Vegetation extent',
            label: '1 km urban vegetation box',
            value: 'extent',
            color: legend[1]?.color || legend[0]?.color || '#78c679',
          })
          return
        }
      }

      if (showClimateFloodHeat || showClimateWaterHeat) {
        const floodFeat =
          showClimateFloodHeat && queryFirst(event.point, [CLIMATE_FLOOD_HEAT])
        if (floodFeat) {
          const row = legendForLayer('flood-heat')?.colors?.[0]
          if (cancelled || seq !== moveSeq) return
          publish({
            layerId: 'flood-heat',
            layer: 'Flood heatmap',
            label: row?.label || 'Flood water',
            value: row?.value || 'heat',
            color: row?.color || '#c2372a',
          })
          return
        }
        const waterFeat =
          showClimateWaterHeat && queryFirst(event.point, [CLIMATE_WATER_HEAT])
        if (waterFeat) {
          const row = legendForLayer('water-heat')?.colors?.[0]
          if (cancelled || seq !== moveSeq) return
          publish({
            layerId: 'water-heat',
            layer: 'Surface-water heatmap',
            label: row?.label || 'Surface water',
            value: row?.value || 'heat',
            color: row?.color || '#2f9bd6',
          })
          return
        }
      }

      if (showLithologyLayer) {
        const note = await sampleOverlay(lng, lat, {
          layerId: 'lithology',
          layerTitle: 'Spectral lithology',
          metaRef: lithologyMetaRef,
          jsonUrl: LITHOLOGY_JSON_URL,
          jsonLabel: 'Spectral lithology',
          rasterUrl: '/asset/mula-mutha-spectral-lithology.png',
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      if (showErosionLayer) {
        const note = await sampleOverlay(lng, lat, {
          layerId: 'erosion',
          layerTitle: 'Bank erosion',
          metaRef: erosionMetaRef,
          jsonUrl: EROSION_JSON_URL,
          jsonLabel: 'Erosion hotspots',
          rasterUrl: '/asset/mula-mutha-erosion-hotspots.png',
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      if (showBiodiversityHealthLayer) {
        try {
          if (!biodiversityMetaRef.current) {
            biodiversityMetaRef.current = await fetchAssetJson(BIODIV_JSON_URL, 'Biodiversity')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const doc = biodiversityMetaRef.current
        const health = doc?.layers?.find((row) => row.id === 'health')
        const note = await sampleOverlay(lng, lat, {
          layerId: 'health',
          layerTitle: 'Vegetation health',
          metaRef: biodiversityMetaRef,
          rasterUrl: doc?.rasters?.health || doc?.raster,
          imageCoordinates: doc?.imageCoordinates,
          classes: health?.classes,
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      if (showBiodiversityTypeLayer) {
        try {
          if (!biodiversityMetaRef.current) {
            biodiversityMetaRef.current = await fetchAssetJson(BIODIV_JSON_URL, 'Biodiversity')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const doc = biodiversityMetaRef.current
        const type = doc?.layers?.find((row) => row.id === 'type')
        const note = await sampleOverlay(lng, lat, {
          layerId: 'type',
          layerTitle: 'Vegetation type',
          metaRef: biodiversityMetaRef,
          rasterUrl: doc?.rasters?.type || doc?.raster,
          imageCoordinates: doc?.imageCoordinates,
          classes: type?.classes,
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      // Water quality (TSS / NDCI / NDWI / WST) — same AOI; first enabled with a hit wins.
      const wqFlags = [
        { on: showTssLayer, id: 'tss', title: 'Turbidity / TSS' },
        { on: showNdciLayer, id: 'ndci', title: 'NDCI — Chlorophyll' },
        { on: showNdwiLayer, id: 'ndwi', title: 'NDWI — Water' },
        { on: showWstLayer, id: 'wst', title: 'WST — Temperature' },
      ]
      if (wqFlags.some((row) => row.on)) {
        try {
          if (!wqMetaRef.current) {
            wqMetaRef.current = await fetchAssetJson(WQ_JSON_URL, 'Water-quality overlays')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const byId = Object.fromEntries(
          (wqMetaRef.current?.layers || []).map((layer) => [layer.id, layer]),
        )
        for (const row of wqFlags) {
          if (!row.on) continue
          const layer = byId[row.id]
          if (!layer) continue
          const classes = (layer.classes || []).map((item) => ({
            ...item,
            value: item.range,
          }))
          const note = await sampleOverlay(lng, lat, {
            layerId: row.id,
            layerTitle: row.title,
            metaRef: wqMetaRef,
            rasterUrl: layer.raster,
            imageCoordinates: layer.imageCoordinates,
            classes: classes.length ? classes : legendForLayer(row.id)?.colors,
          })
          if (cancelled || seq !== moveSeq) return
          if (note) {
            publish(note)
            return
          }
        }
      }

      if (showDepthLayer) {
        try {
          if (!depthMetaRef.current) {
            depthMetaRef.current = await fetchAssetJson(DEPTH_META_URL, 'Depth layer')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const doc = depthMetaRef.current
        const classes = (doc?.classes || []).map((row) => ({
          ...row,
          share_pct: row.pct,
          value: undefined,
        }))
        const note = await sampleOverlay(lng, lat, {
          layerId: 'depth',
          layerTitle: 'Water depth',
          metaRef: depthMetaRef,
          rasterUrl: doc?.raster || '/asset/mula-mutha-depth-overlay.png',
          imageCoordinates: doc?.imageCoordinates,
          classes: classes.length ? classes : legendForLayer('depth')?.colors,
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          // Same raster powers Geology bathymetry + Digital Twin depth — highlight both legends by color.
          publish({ ...note, layerId: 'depth' })
          return
        }
      }

      if (showSiltClassLayer) {
        try {
          if (!siltMetaRef.current) {
            siltMetaRef.current = await fetchAssetJson(SILT_JSON_URL, 'Silt classification')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const doc = siltMetaRef.current
        const period =
          doc?.periods?.find((row) => row.id === siltPeriodId) || doc?.periods?.[0]
        const periodClasses = period?.classification?.classes || doc?.classes || []
        const shares = doc?.csv?.classes || []
        const classes = periodClasses.map((row) => {
          const share = shares.find(
            (item) => item.class === row.class || item.label === row.label,
          )
          return share ? { ...row, share_pct: share.share_pct } : row
        })
        const note = await sampleOverlay(lng, lat, {
          layerId: 'silt-class',
          layerTitle: `Silt class${period?.label ? ` · ${period.label}` : ''}`,
          metaRef: siltMetaRef,
          rasterUrl: period?.classification?.raster,
          imageCoordinates: period?.imageCoordinates,
          classes: classes.length ? classes : legendForLayer('silt-class')?.colors,
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      if (showSiltVolumeLayer) {
        try {
          if (!siltMetaRef.current) {
            siltMetaRef.current = await fetchAssetJson(SILT_JSON_URL, 'Silt classification')
          }
        } catch {
          /* ignore */
        }
        if (cancelled || seq !== moveSeq) return
        const doc = siltMetaRef.current
        const period =
          doc?.periods?.find((row) => row.id === siltPeriodId) || doc?.periods?.[0]
        const volume = period?.volume
        const note = await sampleOverlay(lng, lat, {
          layerId: 'silt-volume',
          layerTitle: `Silt volume${period?.label ? ` · ${period.label}` : ''}`,
          metaRef: siltMetaRef,
          rasterUrl: volume?.raster,
          imageCoordinates: volume?.imageCoordinates || period?.imageCoordinates,
          classes: legendForLayer('silt-volume')?.colors,
          maxDelta: 96,
        })
        if (cancelled || seq !== moveSeq) return
        if (note) {
          publish(note)
          return
        }
      }

      if (showLulcLayer) {
        const polyVisible =
          map.getLayer(LULC_POLY_FILL) &&
          map.getLayoutProperty(LULC_POLY_FILL, 'visibility') === 'visible'
        if (polyVisible) {
          const hits = map.queryRenderedFeatures(event.point, { layers: [LULC_POLY_FILL] })
          const props = hits[0]?.properties
          if (props?.label) {
            const year = lulcPeriodRef.current?.year
            const legendId = lulcLegendId(year)
            const enriched = enrichClassHit(legendId, {
              label: props.label,
              color: props.color,
            })
            if (cancelled || seq !== moveSeq) return
            if (enriched) {
              publish({
                ...enriched,
                layer: `LULC ${year || ''}`.trim(),
              })
              return
            }
          }
        } else {
          const period = lulcPeriodRef.current
          if (period?.raster && period.imageCoordinates) {
            const legendId = lulcLegendId(period.year)
            const classes = period.classes?.length
              ? period.classes
              : legendForLayer(legendId)?.colors
            const note = await sampleOverlay(lng, lat, {
              layerId: legendId,
              layerTitle: `LULC ${period.year || ''}`.trim(),
              metaRef: lulcMetaRef,
              rasterUrl: period.raster,
              imageCoordinates: period.imageCoordinates,
              classes,
            })
            if (cancelled || seq !== moveSeq) return
            if (note) {
              publish(note)
              return
            }
          }
        }
      }

      if (cancelled || seq !== moveSeq) return
      publish(null)
    }

    const onLeave = () => {
      moveSeq += 1
      publish(null)
    }
    map.on('mousemove', onMove)
    map.getCanvas().addEventListener('mouseleave', onLeave)
    return () => {
      cancelled = true
      moveSeq += 1
      map.off('mousemove', onMove)
      map.getCanvas().removeEventListener('mouseleave', onLeave)
      publish(null)
    }
  }, [
    mapReady,
    showLulcLayer,
    showLithologyLayer,
    showErosionLayer,
    showSiltClassLayer,
    showSiltVolumeLayer,
    siltPeriodId,
    showBiodiversityTypeLayer,
    showBiodiversityHealthLayer,
    showNdsiSalinityLayer,
    showTssLayer,
    showNdciLayer,
    showNdwiLayer,
    showWstLayer,
    showDepthLayer,
    showFloodStageLayer,
    showUrbanVegLayer,
    showGarbageLayer,
    showTributaryLayer,
    showMainStemLayer,
    showWrdFloodlines,
    showClimateFloodHeat,
    showClimateWaterHeat,
    lulcPeriodId,
  ])

  // Main-river foam streaks along the chainage centreline (always on).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined

    let cancelled = false

    const stopAnimation = () => {
      if (riverFlowAnimRef.current) {
        cancelAnimationFrame(riverFlowAnimRef.current)
        riverFlowAnimRef.current = null
      }
    }

    const SHEEN_DASHES = [
      [0.6, 1.8],
      [0.75, 1.65],
      [0.9, 1.5],
      [1.05, 1.35],
      [1.2, 1.2],
      [1.35, 1.05],
      [1.5, 0.9],
      [1.65, 0.75],
      [1.8, 0.6],
      [0.45, 1.95],
    ]

    const startAnimation = () => {
      stopAnimation()
      const paths = riverFlowPathsRef.current.filter((path) => path.kind === 'main')
      if (!paths.length) return

      const streakSource = map.getSource(RIVER_STREAK_SOURCE)
      const sparkSource = map.getSource(RIVER_SPARK_SOURCE)
      if (!streakSource || !sparkSource) return

      const phases = new Float64Array(paths.length)
      let lastTime = 0
      let elapsed = 0
      let lastSheen = 0

      const FRAME_MS = 24
      const STREAK_SPEED_PX = 38
      const STREAK_SPACING_PX = 58

      const tick = (timestamp) => {
        riverFlowAnimRef.current = requestAnimationFrame(tick)
        if (!map.getLayer(RIVER_STREAK) || cancelled) {
          stopAnimation()
          return
        }
        if (lastTime && timestamp - lastTime < FRAME_MS) return

        const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.08) : 0
        lastTime = timestamp
        elapsed += dt

        if (timestamp - lastSheen > 70) {
          riverSheenStepRef.current = (riverSheenStepRef.current + 1) % SHEEN_DASHES.length
          if (map.getLayer(RIVER_SHEEN)) {
            map.setPaintProperty(RIVER_SHEEN, 'line-dasharray', SHEEN_DASHES[riverSheenStepRef.current])
          }
          lastSheen = timestamp
        }

        const zoom = map.getZoom()
        const mPerPx = metersPerPixel(map.getCenter().lat, zoom)
        const zoomScale = Math.min(1.2, Math.max(0.45, (zoom - 10) / 5))
        const streaks = []
        const sparks = []

        const LANES = [
          { offsetPx: -4.2, speed: 0.72, alpha: 0.42, width: 0.85 },
          { offsetPx: 0, speed: 1, alpha: 0.78, width: 1.35 },
          { offsetPx: 4.2, speed: 0.78, alpha: 0.48, width: 0.95 },
        ]

        for (let p = 0; p < paths.length; p += 1) {
          const path = paths[p]
          if (path.len < 40) continue
          const lenPx = path.len / mPerPx
          if (lenPx < 18) continue

          phases[p] = (phases[p] + (STREAK_SPEED_PX * dt) / lenPx) % 1
          const count = Math.max(3, Math.min(28, Math.round(lenPx / STREAK_SPACING_PX)))

          for (const lane of LANES) {
            for (let j = 0; j < count; j += 1) {
              const phase = (phases[p] * lane.speed + j / count) % 1
              const dist = phase * path.len
              const wander = Math.sin(phase * Math.PI * 6 + j * 1.7 + p) * 1.8
              const offsetM = (lane.offsetPx + wander) * mPerPx
              const streakLenM = (18 + (j % 4) * 6) * mPerPx * zoomScale
              const coords = streakCoordinates(path, dist, streakLenM, offsetM)
              const fade = Math.min(1, phase / 0.06) * Math.min(1, (1 - phase) / 0.05)
              const shimmer = 0.72 + 0.28 * Math.sin(elapsed * 4.2 + j * 1.3 + p * 0.7)
              const opacity = Number((fade * shimmer * lane.alpha).toFixed(3))
              if (opacity < 0.05) continue

              streaks.push({
                type: 'Feature',
                properties: {
                  w: Number((lane.width * zoomScale * (0.75 + 0.35 * ((j + p) % 3) / 2)).toFixed(2)),
                  o: opacity,
                },
                geometry: { type: 'LineString', coordinates: coords },
              })

              if (lane.offsetPx === 0 && j % 3 === 0) {
                const tip = samplePath(path, dist)
                const [slng, slat] = destinationPoint(
                  tip.lng,
                  tip.lat,
                  tip.bearing + 90,
                  offsetM * 0.4,
                )
                sparks.push({
                  type: 'Feature',
                  properties: {
                    s: Number((0.55 + 0.35 * Math.sin(elapsed * 5 + j)).toFixed(3)),
                    o: Number((opacity * 0.9).toFixed(3)),
                  },
                  geometry: { type: 'Point', coordinates: [slng, slat] },
                })
              }
            }
          }
        }

        streakSource.setData({ type: 'FeatureCollection', features: streaks })
        sparkSource.setData({ type: 'FeatureCollection', features: sparks })
      }

      riverFlowAnimRef.current = requestAnimationFrame(tick)
    }

    const load = async () => {
      try {
        const chainageDoc = await fetchAssetJson(CHAINAGE_GEOJSON_URL, 'River flow centreline')
        if (cancelled) return
        const built = buildRiverFlowPaths(chainageDoc)
        riverFlowPathsRef.current = built.paths
        map.getSource(RIVER_PATH_SOURCE)?.setData(built.centreline)
        riverFlowReadyRef.current = true
        startAnimation()
      } catch (error) {
        console.error('Failed to start river flow animation', error)
      }
    }

    load()

    const onVis = () => {
      if (document.hidden) stopAnimation()
      else if (riverFlowReadyRef.current) startAnimation()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      stopAnimation()
      map.getSource(RIVER_STREAK_SOURCE)?.setData(EMPTY_COLLECTION)
      map.getSource(RIVER_SPARK_SOURCE)?.setData(EMPTY_COLLECTION)
    }
  }, [mapReady])

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
        let geojson = tributaryGeojsonRef.current
        if (!geojson) {
          geojson = await fetchAssetJson(TRIB_GEOJSON_URL, 'Joining streams')
          if (cancelled) return
          map.getSource(TRIB_SOURCE)?.setData(geojson)
          tributaryGeojsonRef.current = geojson
        }
        if (cancelled) return
        applyFilters()
        setVisibility(true)

        if (showTributaryLayerRef.current && geojson) {
          const flowData = buildTributaryFlowData(geojson)
          tributaryFlowPathsRef.current = flowData.paths || []
          raiseTributaryFlowToTop(map)
        } else if (!showTributaryLayerRef.current) {
          tributaryFlowPathsRef.current = []
          map.getSource(TRIB_FLOW_SOURCE)?.setData(EMPTY_COLLECTION)
        }

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

    if (map.getLayer(CHAINAGE_FOCUS)) {
      const focusName = focusChainage.nearestName || focusChainage.name
      if (focusName) {
        const nameFilter = ['==', ['get', 'name'], focusName]
        map.setFilter(CHAINAGE_FOCUS, nameFilter)
        if (map.getLayer(CHAINAGE_FOCUS_LABEL)) {
          map.setFilter(CHAINAGE_FOCUS_LABEL, nameFilter)
        }
      }
      ;[CHAINAGE_FOCUS, CHAINAGE_FOCUS_LABEL].forEach((layerId) => {
        if (map.getLayer(layerId)) map.moveLayer(layerId)
      })
      raiseTwinAssetsToTop(map)
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
      duration: focusChainage.scrub ? 0 : 900,
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
    if (!map || !mapReady) return undefined

    const collection = twinAssetsToCollection(twinAssets)
    const hasAssets = collection.features.length > 0
    map.getSource(TWIN_ASSET_SOURCE)?.setData(collection)
    ;[TWIN_ASSET_LAYER, TWIN_ASSET_LABELS].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', hasAssets ? 'visible' : 'none')
      }
    })
    if (hasAssets) raiseTwinAssetsToTop(map)

    if (!hasAssets) {
      twinAssetPopupRef.current?.remove()
      twinAssetsFitRef.current = false
      return undefined
    }

    if (!twinAssetsFitRef.current) {
      twinAssetsFitRef.current = true
      const bounds = collection.features.reduce((box, feature) => {
        const [lng, lat] = feature.geometry.coordinates
        if (!box) return [[lng, lat], [lng, lat]]
        return [
          [Math.min(box[0][0], lng), Math.min(box[0][1], lat)],
          [Math.max(box[1][0], lng), Math.max(box[1][1], lat)],
        ]
      }, null)
      if (bounds) {
        map.fitBounds(bounds, {
          padding: { top: 72, bottom: 140, left: 48, right: 280 },
          maxZoom: 13.4,
          duration: 900,
        })
      }
    }

    const onClick = (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      const props = feature.properties || {}
      if (props.id) onSelectTwinAssetRef.current?.(props.id)

      twinAssetPopupRef.current?.remove()
      const margin = Number(props.margin_now_m)
      const marginText = Number.isFinite(margin)
        ? `${margin > 0 ? '+' : ''}${margin} m margin`
        : '—'
      twinAssetPopupRef.current = new Popup({ closeButton: true, maxWidth: '240px', offset: 12 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font:650 13px Inter,system-ui,sans-serif;color:#0d2436">${props.id || ''} · ${props.name || ''}</div>` +
            `<div style="margin-top:4px;font:650 12px ui-monospace,Menlo,monospace;color:${props.color || '#0d2436'}">${props.status || ''} · ${marginText}</div>` +
            `<div style="margin-top:4px;font:500 11px Inter,system-ui,sans-serif;color:#3a5c73">Chainage ${props.chainage || '—'} · Model</div>`,
        )
        .addTo(map)
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', TWIN_ASSET_LAYER, onClick)
    map.on('mouseenter', TWIN_ASSET_LAYER, onEnter)
    map.on('mouseleave', TWIN_ASSET_LAYER, onLeave)

    return () => {
      map.off('click', TWIN_ASSET_LAYER, onClick)
      map.off('mouseenter', TWIN_ASSET_LAYER, onEnter)
      map.off('mouseleave', TWIN_ASSET_LAYER, onLeave)
    }
  }, [twinAssets, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !map.getLayer(TWIN_ASSET_LAYER)) return
    const selectedId = selectedTwinAssetId || ''
    map.setPaintProperty(TWIN_ASSET_LAYER, 'circle-radius', [
      'interpolate',
      ['linear'],
      ['zoom'],
      11,
      ['case', ['==', ['get', 'id'], selectedId], 10, 7],
      15,
      ['case', ['==', ['get', 'id'], selectedId], 14, 11],
    ])
    map.setPaintProperty(TWIN_ASSET_LAYER, 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], selectedId],
      3.2,
      2.4,
    ])
    map.setPaintProperty(TWIN_ASSET_LAYER, 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedId],
      '#5b8cff',
      '#ffffff',
    ])
    if (map.getLayer(TWIN_ASSET_LABELS)) {
      map.setPaintProperty(TWIN_ASSET_LABELS, 'text-halo-width', [
        'case',
        ['==', ['get', 'id'], selectedId],
        2.2,
        1.8,
      ])
    }
    raiseTwinAssetsToTop(map)
  }, [selectedTwinAssetId, twinAssets, mapReady])

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

      {classNote && (
        <div
          className={[
            'map-class-note',
            'is-cursor',
            classNotePos.flipX ? 'is-flip-x' : '',
            classNotePos.flipY ? 'is-flip-y' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: classNotePos.x, top: classNotePos.y }}
          aria-live="polite"
        >
          <i style={{ background: classNote.color }} />
          <span>
            <small>{classNote.layer}</small>
            <strong>{classNote.label}</strong>
          </span>
          {classNote.value ? <em>{classNote.value}</em> : null}
        </div>
      )}

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
