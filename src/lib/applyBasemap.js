import { BASEMAP_MAP } from './basemaps'

export const BASEMAP_SOURCE = 'src-basemap'
export const BASEMAP_LAYER = 'lyr-basemap'
export const BASEMAP_OVERLAY_SOURCE = 'src-basemap-overlay'
export const BASEMAP_OVERLAY_LAYER = 'lyr-basemap-overlay'

export function ensureBasemapLayers(map, config) {
  if (!map.getSource(BASEMAP_SOURCE)) {
    map.addSource(BASEMAP_SOURCE, {
      type: 'raster',
      tiles: config.tiles,
      tileSize: 256,
      attribution: config.attribution,
      maxzoom: config.maxzoom ?? 20,
    })
    map.addLayer({
      id: BASEMAP_LAYER,
      type: 'raster',
      source: BASEMAP_SOURCE,
      paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 },
    })
  }

  if (!map.getSource(BASEMAP_OVERLAY_SOURCE)) {
    map.addSource(BASEMAP_OVERLAY_SOURCE, {
      type: 'raster',
      tiles: config.overlayTiles ?? [
        'https://mt0.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: config.overlayAttribution ?? '',
      maxzoom: 20,
    })
    map.addLayer({
      id: BASEMAP_OVERLAY_LAYER,
      type: 'raster',
      source: BASEMAP_OVERLAY_SOURCE,
      layout: {
        visibility: config.overlayTiles ? 'visible' : 'none',
      },
      paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 },
    })
  }
}

export function applyBasemap(map, basemapId) {
  const config = BASEMAP_MAP[basemapId]
  if (!config) return

  ensureBasemapLayers(map, config)

  const base = map.getSource(BASEMAP_SOURCE)
  const overlay = map.getSource(BASEMAP_OVERLAY_SOURCE)

  if (base?.setTiles) {
    base.setTiles(config.tiles)
  }

  if (config.overlayTiles?.length) {
    overlay?.setTiles?.(config.overlayTiles)
    if (map.getLayer(BASEMAP_OVERLAY_LAYER)) {
      map.setLayoutProperty(BASEMAP_OVERLAY_LAYER, 'visibility', 'visible')
    }
  } else if (map.getLayer(BASEMAP_OVERLAY_LAYER)) {
    map.setLayoutProperty(BASEMAP_OVERLAY_LAYER, 'visibility', 'none')
  }

  try {
    const style = map.getStyle()
    const firstOverlay = style.layers?.find(
      (l) => l.id !== 'background' && l.id !== BASEMAP_LAYER && l.id !== BASEMAP_OVERLAY_LAYER,
    )?.id
    if (firstOverlay) {
      map.moveLayer(BASEMAP_LAYER, firstOverlay)
      if (map.getLayer(BASEMAP_OVERLAY_LAYER)) {
        map.moveLayer(BASEMAP_OVERLAY_LAYER, firstOverlay)
      }
    }
  } catch {
    /* layer order best-effort */
  }

  if (config.mode3d) {
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    return
  }

  if (config.topDown) {
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
  } else {
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
  }
}

export function applyTerrain3d(map, enabled, basemapId) {
  if (!map) return

  if (enabled) {
    if (!map.getSource('src-terrarium')) return
    try {
      map.setTerrain({ source: 'src-terrarium', exaggeration: 1.85 })
    } catch (error) {
      console.error('Failed to enable 3D terrain', error)
      return
    }
    map.easeTo({ pitch: 58, duration: 900 })
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
  } else {
    try {
      map.setTerrain(null)
    } catch {
      /* already flat */
    }
    const flat = BASEMAP_MAP[basemapId]?.topDown
    map.easeTo({ pitch: 0, bearing: flat ? 0 : map.getBearing(), duration: 700 })
    if (flat) {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
    }
  }
}
