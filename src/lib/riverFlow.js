/**
 * River-flow path helpers for the MapLibre water animation.
 * Geometry comes from the chainage centreline (and optionally joining streams).
 */

const EARTH_RADIUS_M = 6371000
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export const haversineMeters = (lon1, lat1, lon2, lat2) => {
  const dLat = (lat2 - lat1) * DEG2RAD
  const dLon = (lon2 - lon1) * DEG2RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export const bearingBetween = (a, b) => {
  const lat1 = a[1] * DEG2RAD
  const lat2 = b[1] * DEG2RAD
  const dLon = (b[0] - a[0]) * DEG2RAD
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360
}

export const destinationPoint = (lng, lat, bearingDeg, meters) => {
  const δ = meters / EARTH_RADIUS_M
  const θ = bearingDeg * DEG2RAD
  const φ1 = lat * DEG2RAD
  const λ1 = lng * DEG2RAD
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(sinφ2)
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2,
    )
  return [λ2 * RAD2DEG, φ2 * RAD2DEG]
}

export const metersPerPixel = (lat, zoom) =>
  (156543.03392804097 * Math.cos(lat * DEG2RAD)) / 2 ** zoom

/** Prefer eastward heading — Mula–Mutha drains toward the Bhima. */
const preferDownstream = (coords) => {
  if (!coords || coords.length < 2) return coords
  const start = coords[0]
  const end = coords[coords.length - 1]
  // Downstream is roughly east (increasing longitude).
  return end[0] >= start[0] ? coords : [...coords].reverse()
}

export const buildPath = (coords, kind = 'main', speed = 1, width = 1) => {
  const pts = preferDownstream(coords)
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1]
    const curr = pts[i]
    cum.push(cum[i - 1] + haversineMeters(prev[0], prev[1], curr[0], curr[1]))
  }
  return { kind, pts, cum, len: cum[cum.length - 1] || 0, speed, width }
}

/** Position and heading at `distance` metres along a prepared path. */
export const samplePath = (path, distance) => {
  const { pts, cum, len } = path
  if (!pts?.length) return { lng: 0, lat: 0, bearing: 90 }
  const d = Math.min(Math.max(distance, 0), len)
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i += 1
  const span = cum[i] - cum[i - 1]
  const t = span > 0 ? (d - cum[i - 1]) / span : 0
  const a = pts[i - 1]
  const b = pts[i] || pts[i - 1]
  return {
    lng: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    bearing: bearingBetween(a, b),
  }
}

/**
 * Build the primary river path from mula-mutha-chainage.geojson centreline only.
 */
export const buildRiverFlowPaths = (chainageGeojson) => {
  const paths = []
  let centreline = null

  for (const feature of chainageGeojson?.features || []) {
    if (feature.geometry?.type !== 'LineString') continue
    const coords = feature.geometry.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue
    const path = buildPath(coords, 'main', 1, 1)
    paths.push(path)
    centreline = {
      type: 'Feature',
      properties: { kind: 'main' },
      geometry: { type: 'LineString', coordinates: path.pts },
    }
    break
  }

  return {
    paths,
    centreline: centreline
      ? { type: 'FeatureCollection', features: [centreline] }
      : { type: 'FeatureCollection', features: [] },
  }
}

/** Short foam filament behind a sample point. */
export const streakCoordinates = (path, distanceM, lengthM, offsetM = 0) => {
  const head = samplePath(path, distanceM)
  const tail = samplePath(path, Math.max(0, distanceM - lengthM))
  const midBearing = head.bearing
  const [hlng, hlat] = destinationPoint(head.lng, head.lat, midBearing + 90, offsetM)
  const [tlng, tlat] = destinationPoint(tail.lng, tail.lat, midBearing + 90, offsetM * 0.85)
  return [
    [tlng, tlat],
    [hlng, hlat],
  ]
}
