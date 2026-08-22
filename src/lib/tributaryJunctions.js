const JOINING_CLASSES = ['stream', 'feeder', 'drain', 'canal', 'ditch']
const JUNCTION_TOLERANCE_M = 150
const DEDUPE_TOLERANCE_M = 40

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

/** Compass bearing a -> b, degrees clockwise from north. */
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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** 0 = wide view, 1 = close-up — joining-stream dash animation. */
export const tribFlowZoomT = (zoom, lo = 10.8, hi = 15.2) =>
  clamp((zoom - lo) / (hi - lo), 0, 1)

export const tribSmoothToward = (current, target, rate = 0.12) =>
  current + (target - current) * rate

const pointToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) {
    return { distance: haversineMeters(px, py, ax, ay), point: [ax, ay], a: [ax, ay], b: [bx, by] }
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return {
    distance: haversineMeters(px, py, ax + t * dx, ay + t * dy),
    point: [ax + t * dx, ay + t * dy],
    a: [ax, ay],
    b: [bx, by],
  }
}

const nearestMainstem = (lon, lat, segments) => {
  let best = { distance: Infinity, point: null, a: null, b: null }
  for (const [a, b] of segments) {
    const hit = pointToSegment(lon, lat, a[0], a[1], b[0], b[1])
    if (hit.distance < best.distance) best = hit
  }
  return best
}

/**
 * The Mula-Mutha runs west to east towards the Bhima, so of the two tangent
 * directions at a confluence the eastward one is downstream.
 */
const downstreamBearing = (segmentStart, segmentEnd) => {
  const bearing = bearingBetween(segmentStart, segmentEnd)
  return Math.sin(bearing * DEG2RAD) >= 0 ? bearing : (bearing + 180) % 360
}

const buildPath = (coords, cls) => {
  const cum = [0]
  for (let i = 1; i < coords.length; i += 1) {
    const prev = coords[i - 1]
    const curr = coords[i]
    cum.push(cum[i - 1] + haversineMeters(prev[0], prev[1], curr[0], curr[1]))
  }
  return { cls, pts: coords, cum, len: cum[cum.length - 1] }
}

/** Position and heading at `distance` metres along a prepared path. */
export const samplePath = (path, distance) => {
  const { pts, cum, len } = path
  const d = Math.min(Math.max(distance, 0), len)
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i += 1
  const span = cum[i] - cum[i - 1]
  const t = span > 0 ? (d - cum[i - 1]) / span : 0
  const a = pts[i - 1]
  const b = pts[i]
  return {
    lng: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    bearing: bearingBetween(a, b),
  }
}

const dedupe = (candidates) => {
  const kept = []
  for (const candidate of candidates) {
    const clash = kept.some(
      (item) =>
        haversineMeters(item.mouth[0], item.mouth[1], candidate.mouth[0], candidate.mouth[1]) <
        DEDUPE_TOLERANCE_M,
    )
    if (!clash) kept.push(candidate)
  }
  return kept
}

/**
 * Confluence points plus downstream-oriented paths for the joining-stream
 * flow animation. Every joining waterway whose endpoint falls within
 * JUNCTION_TOLERANCE_M of the main stem is treated as a tributary mouth.
 */
export const buildTributaryFlowData = (geojson) => {
  const mainstemSegments = []
  for (const feature of geojson?.features || []) {
    if (feature.properties?.class !== 'mainstem') continue
    const coords = feature.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue
    for (let i = 0; i < coords.length - 1; i += 1) {
      mainstemSegments.push([coords[i], coords[i + 1]])
    }
  }

  const candidates = []
  const flowFeatures = []
  const paths = []

  for (const feature of geojson?.features || []) {
    const cls = feature.properties?.class
    if (!JOINING_CLASSES.includes(cls)) continue

    const coords = feature.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue

    const start = coords[0]
    const end = coords[coords.length - 1]
    const startHit = nearestMainstem(start[0], start[1], mainstemSegments)
    const endHit = nearestMainstem(end[0], end[1], mainstemSegments)
    const mouthAtStart = startHit.distance <= endHit.distance
    const hit = mouthAtStart ? startHit : endHit
    if (hit.distance > JUNCTION_TOLERANCE_M) continue

    const oriented = mouthAtStart ? [...coords].reverse() : [...coords]
    const mouth = oriented[oriented.length - 1]
    if (hit.point && haversineMeters(mouth[0], mouth[1], hit.point[0], hit.point[1]) > 1) {
      oriented.push(hit.point)
    }

    flowFeatures.push({
      type: 'Feature',
      properties: { class: cls, name: feature.properties?.name ?? null },
      geometry: { type: 'LineString', coordinates: oriented },
    })
    paths.push(buildPath(oriented, cls))

    candidates.push({
      mouth: oriented[oriented.length - 1],
      bearing: hit.a && hit.b ? downstreamBearing(hit.a, hit.b) : 90,
      class: cls,
      name: feature.properties?.name ?? null,
    })
  }

  const kept = dedupe(candidates)

  return {
    junctions: {
      type: 'FeatureCollection',
      features: kept.map((item) => ({
        type: 'Feature',
        properties: { class: item.class, name: item.name },
        geometry: { type: 'Point', coordinates: item.mouth },
      })),
    },
    flowLines: { type: 'FeatureCollection', features: flowFeatures },
    paths,
    mouths: kept.map((item) => ({ lng: item.mouth[0], lat: item.mouth[1], bearing: item.bearing })),
  }
}
