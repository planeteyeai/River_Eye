// 1 km riverbank ribbons clipped to the Mula-Mutha river KML polygon.
// Bank edges are ray hits on that ring, then the ring is walked so the
// yellow line lies on the KML rather than a constant offset.

const METERS_PER_DEG_LAT = 110540
export const CHAINAGE_BIN_HALF_WIDTH_M = 150
export const CHAINAGE_BIN_LENGTH_M = 1000
export const CHAINAGE_LAST_M = 16400

export const formatChainage = (metres) => {
  const km = Math.floor(metres / 1000)
  const m = Math.round(metres - km * 1000)
  return `${km}+${String(m).padStart(3, '0')}`
}

export const binBoundsForChainage = (metres, lastM = CHAINAGE_LAST_M) => {
  const value = Number(metres)
  if (!Number.isFinite(value)) return null
  const clamped = Math.max(0, Math.min(lastM, value))
  const start = Math.min(Math.floor(clamped / CHAINAGE_BIN_LENGTH_M) * CHAINAGE_BIN_LENGTH_M, Math.floor((lastM - 1) / CHAINAGE_BIN_LENGTH_M) * CHAINAGE_BIN_LENGTH_M)
  const end = Math.min(start + CHAINAGE_BIN_LENGTH_M, lastM)
  return {
    start_m: start,
    end_m: end,
    from: formatChainage(start),
    to: formatChainage(end),
    length_m: end - start,
    name: `${formatChainage(start)}–${formatChainage(end)}`,
  }
}

// Map 0–16.4 km river chainage onto another axis (BOD ribbon uses a 0–42 km demo scale).
export const ribbonKmFromChainage = (chainageM, km0, km1, lastM = CHAINAGE_LAST_M) => {
  const span = km1 - km0
  if (!Number.isFinite(span) || span === 0) return km0
  const t = Math.max(0, Math.min(1, Number(chainageM) / lastM))
  return km0 + t * span
}

export const chainageFromRibbonKm = (km, km0, km1, lastM = CHAINAGE_LAST_M) => {
  const span = km1 - km0
  if (!Number.isFinite(span) || span === 0) return 0
  const t = Math.max(0, Math.min(1, (Number(km) - km0) / span))
  return Math.round((t * lastM) / 100) * 100
}

export const reachForRibbonKm = (reaches, km) => {
  if (!reaches?.length) return null
  const last = reaches[reaches.length - 1]
  return (
    reaches.find((reach, index) => {
      const [start, end] = reach.km
      return index === reaches.length - 1
        ? km >= start && km <= end
        : km >= start && km < end
    }) || last
  )
}

const MAX_BANK_RAY_M = 900

const metersPerDegLon = (latDeg) => 111320 * Math.cos((latDeg * Math.PI) / 180)

const hypotM = (a, b) => {
  const lat = (a[1] + b[1]) / 2
  const mx = metersPerDegLon(lat)
  const dx = (b[0] - a[0]) * mx
  const dy = (b[1] - a[1]) * METERS_PER_DEG_LAT
  return Math.hypot(dx, dy)
}

const normalAt = (stations, index) => {
  const a = Math.max(0, index - 1)
  const b = Math.min(stations.length - 1, index + 1)
  const lat = stations[index].lat
  const mx = metersPerDegLon(lat)
  const dx = (stations[b].lng - stations[a].lng) * mx
  const dy = (stations[b].lat - stations[a].lat) * METERS_PER_DEG_LAT
  const length = Math.hypot(dx, dy) || 1
  return { nx: -dy / length, ny: dx / length }
}

const offsetPoint = (station, normal, distanceM) => {
  const mx = metersPerDegLon(station.lat) || 1
  return [
    station.lng + (normal.nx * distanceM) / mx,
    station.lat + (normal.ny * distanceM) / METERS_PER_DEG_LAT,
  ]
}

const closedRing = (coords) => {
  if (!coords?.length) return null
  const ring = coords
    .filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map((pair) => [pair[0], pair[1]])
  if (ring.length < 4) return null
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first])
  return ring
}

const rayHitsRing = (origin, dirLngPerM, dirLatPerM, ring) => {
  let best = null
  const n = ring.length - 1
  for (let i = 0; i < n; i += 1) {
    const ax = ring[i][0]
    const ay = ring[i][1]
    const bx = ring[i + 1][0]
    const by = ring[i + 1][1]
    const ex = bx - ax
    const ey = by - ay
    const denom = dirLngPerM * ey - dirLatPerM * ex
    if (Math.abs(denom) < 1e-18) continue
    const t = ((ax - origin.lng) * ey - (ay - origin.lat) * ex) / denom
    const u = ((ax - origin.lng) * dirLatPerM - (ay - origin.lat) * dirLngPerM) / denom
    if (t <= 0.8 || t > MAX_BANK_RAY_M || u < -1e-6 || u > 1 + 1e-6) continue
    if (!best || t < best.t) {
      best = {
        t,
        u,
        edge: i,
        lng: origin.lng + t * dirLngPerM,
        lat: origin.lat + t * dirLatPerM,
      }
    }
  }
  return best
}

const hitOnSide = (station, normal, sign, ring) => {
  const mx = metersPerDegLon(station.lat) || 1
  const dirLng = (sign * normal.nx) / mx
  const dirLat = (sign * normal.ny) / METERS_PER_DEG_LAT
  const hit = rayHitsRing(station, dirLng, dirLat, ring)
  if (hit) return hit
  const fallback = offsetPoint(station, normal, sign * CHAINAGE_BIN_HALF_WIDTH_M)
  return { lng: fallback[0], lat: fallback[1], edge: 0, u: 0, t: CHAINAGE_BIN_HALF_WIDTH_M }
}

const pathLength = (points) => {
  let sum = 0
  for (let i = 1; i < points.length; i += 1) sum += hypotM(points[i - 1], points[i])
  return sum
}

const walkRing = (ring, from, to) => {
  const n = ring.length - 1
  if (n < 2) return [[from.lng, from.lat], [to.lng, to.lat]]

  const walk = (step) => {
    const points = [[from.lng, from.lat]]
    if (from.edge === to.edge && ((step > 0 && to.u >= from.u) || (step < 0 && to.u <= from.u))) {
      points.push([to.lng, to.lat])
      return points
    }
    let edge = from.edge
    if (step > 0) {
      points.push(ring[(edge + 1) % n])
      edge = (edge + 1) % n
      while (edge !== to.edge) {
        points.push(ring[(edge + 1) % n])
        edge = (edge + 1) % n
      }
    } else {
      points.push(ring[edge])
      while (edge !== to.edge) {
        edge = (edge - 1 + n) % n
        points.push(ring[edge])
      }
    }
    points.push([to.lng, to.lat])
    return points
  }

  const forward = walk(1)
  const backward = walk(-1)
  return pathLength(forward) <= pathLength(backward) ? forward : backward
}

const bankPolyline = (hits, ring) => {
  if (hits.length < 2) return hits.map((hit) => [hit.lng, hit.lat])
  const points = []
  for (let i = 0; i < hits.length - 1; i += 1) {
    const segment = walkRing(ring, hits[i], hits[i + 1])
    if (i > 0) segment.shift()
    points.push(...segment)
  }
  return points
}

export const stationsFromChainageGeojson = (geojson) =>
  (geojson?.features || [])
    .filter((feature) => feature?.properties?.kind === 'station' && feature.geometry?.coordinates)
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates
      return {
        name: feature.properties.name,
        chainage_m: Number(feature.properties.chainage_m) || 0,
        major: Boolean(feature.properties.major),
        lng,
        lat,
      }
    })
    .filter((station) => Number.isFinite(station.lng) && Number.isFinite(station.lat))
    .sort((a, b) => a.chainage_m - b.chainage_m)

export const buildChainageBins = (geojson, riverCoordinates = null) => {
  const stations = stationsFromChainageGeojson(geojson)
  if (stations.length < 2) return { type: 'FeatureCollection', features: [] }

  const ring = closedRing(riverCoordinates)
  const lastM = stations[stations.length - 1].chainage_m
  const features = []

  for (let startM = 0; startM < lastM; startM += CHAINAGE_BIN_LENGTH_M) {
    const endM = Math.min(startM + CHAINAGE_BIN_LENGTH_M, lastM)
    const slice = stations.filter(
      (station) => station.chainage_m >= startM && station.chainage_m <= endM,
    )
    if (slice.length < 2) continue

    const leftHits = []
    const rightHits = []
    slice.forEach((station) => {
      const index = stations.findIndex((row) => row.chainage_m === station.chainage_m)
      const normal = normalAt(stations, index)
      if (ring) {
        leftHits.push(hitOnSide(station, normal, 1, ring))
        rightHits.push(hitOnSide(station, normal, -1, ring))
      } else {
        const left = offsetPoint(station, normal, CHAINAGE_BIN_HALF_WIDTH_M)
        const right = offsetPoint(station, normal, -CHAINAGE_BIN_HALF_WIDTH_M)
        leftHits.push({ lng: left[0], lat: left[1], edge: 0, u: 0 })
        rightHits.push({ lng: right[0], lat: right[1], edge: 0, u: 0 })
      }
    })

    const left = ring ? bankPolyline(leftHits, ring) : leftHits.map((hit) => [hit.lng, hit.lat])
    const right = ring ? bankPolyline(rightHits, ring) : rightHits.map((hit) => [hit.lng, hit.lat])
    const outline = [...left, ...right.reverse()]
    outline.push(outline[0])

    const mid = slice[Math.floor(slice.length / 2)]
    features.push({
      type: 'Feature',
      properties: {
        kind: 'bin',
        from: formatChainage(startM),
        to: formatChainage(endM),
        name: `${formatChainage(startM)}–${formatChainage(endM)}`,
        start_m: startM,
        end_m: endM,
        is_last: endM >= lastM ? 1 : 0,
        clipped_to_kml: ring ? 1 : 0,
        center_lng: mid.lng,
        center_lat: mid.lat,
      },
      geometry: { type: 'Polygon', coordinates: [outline] },
    })
  }

  return {
    type: 'FeatureCollection',
    name: 'Mula-Mutha chainage riverbank bins',
    clipped_to_kml: Boolean(ring),
    bin_length_m: CHAINAGE_BIN_LENGTH_M,
    features,
  }
}

export const binFilterForChainage = (metres) => {
  const m = Number(metres)
  if (!Number.isFinite(m)) return ['==', ['get', 'kind'], '__none__']
  return [
    'any',
    [
      'all',
      ['==', ['get', 'is_last'], 1],
      ['<=', ['get', 'start_m'], m],
      ['>=', ['get', 'end_m'], m],
    ],
    [
      'all',
      ['!=', ['get', 'is_last'], 1],
      ['<=', ['get', 'start_m'], m],
      ['>', ['get', 'end_m'], m],
    ],
  ]
}
