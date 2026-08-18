import fs from 'fs'

const src = 'c:/Users/Kunal.Desale/Downloads/b3ff349b41944af598e7015e55bf1c22.kml'
const destGeo = 'public/asset/mula-mutha-depth-class.geojson'
const destKml = 'public/asset/mula-mutha-depth-class.kml'
const destSummary = 'public/asset/mula-mutha-depth-summary.json'

const xml = fs.readFileSync(src, 'utf8')
fs.copyFileSync(src, destKml)

const labels = {
  0: 'Shallow',
  1: 'Low depth',
  2: 'Moderate depth',
  3: 'High depth',
  4: 'Very high depth',
}

const colors = {
  0: '#0000ff',
  1: '#00ff00',
  2: '#ffff00',
  3: '#ff8000',
  4: '#ff0000',
}

/** KML `lng,lat[,alt]` whitespace-separated list → GeoJSON ring, explicitly closed. */
const parseRing = (text) => {
  const ring = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number)
      return [lng, lat]
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))

  if (ring.length < 3) return null
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first])
  return ring
}

/** A KML <Polygon> carries one outer ring plus any number of holes. */
const parsePolygon = (polygonXml) => {
  const outerMatch = polygonXml.match(
    /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/,
  )
  if (!outerMatch) return null
  const outer = parseRing(outerMatch[1])
  if (!outer) return null

  const rings = [outer]
  const innerRe =
    /<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/g
  let inner
  while ((inner = innerRe.exec(polygonXml))) {
    const hole = parseRing(inner[1])
    if (hole) rings.push(hole)
  }
  return rings
}

const features = []
let polygonCount = 0
let skipped = 0

const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/g
let placemark
while ((placemark = placemarkRe.exec(xml))) {
  const body = placemark[1]

  const clsMatch = body.match(/<Data name=['"]depth_class['"]>\s*<value>\s*(\d+)\s*<\/value>/)
  if (!clsMatch) {
    skipped += 1
    continue
  }
  const cls = Number(clsMatch[1])

  const nameMatch = body.match(/<name>([^<]*)<\/name>/)
  const name = nameMatch ? nameMatch[1].trim() : ''

  const countMatch = body.match(/<Data name=['"]count['"]>\s*<value>\s*(\d+)\s*<\/value>/)

  // MultiGeometry placemarks hold several <Polygon> blocks; keep every one of them.
  const polygons = []
  const polygonRe = /<Polygon>([\s\S]*?)<\/Polygon>/g
  let polygonMatch
  while ((polygonMatch = polygonRe.exec(body))) {
    const rings = parsePolygon(polygonMatch[1])
    if (rings) polygons.push(rings)
  }

  if (!polygons.length) {
    skipped += 1
    continue
  }
  polygonCount += polygons.length

  const geometry =
    polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons }

  features.push({
    type: 'Feature',
    properties: {
      depth_class: cls,
      class: cls,
      label: labels[cls] || `Class ${cls}`,
      range: name,
      name,
      cell_count: countMatch ? Number(countMatch[1]) : null,
      parameter: 'Water depth',
      color: colors[cls] || '#6b8798',
    },
    geometry,
  })
}

const collection = {
  type: 'FeatureCollection',
  name: 'Mula-Mutha Water Depth',
  source_name: 'Water depth',
  legend: Object.keys(labels)
    .map(Number)
    .sort((a, b) => a - b)
    .map((cls) => ({ class: cls, label: labels[cls], color: colors[cls] })),
  features,
}

fs.writeFileSync(destGeo, JSON.stringify(collection))

const buckets = {}
for (const f of features) {
  const cls = f.properties.depth_class
  if (!buckets[cls]) buckets[cls] = { count: 0, cells: 0, min: Infinity, max: -Infinity }
  buckets[cls].count += 1
  buckets[cls].cells += f.properties.cell_count || 0
  const m = String(f.properties.range || '').match(/([\d.]+)-([\d.]+)/)
  if (m) {
    buckets[cls].min = Math.min(buckets[cls].min, Number(m[1]))
    buckets[cls].max = Math.max(buckets[cls].max, Number(m[2]))
  }
}

const totalCells = Object.values(buckets).reduce((sum, b) => sum + b.cells, 0)

const summary = {
  source_kml: 'b3ff349b41944af598e7015e55bf1c22.kml',
  parameter: 'Water depth',
  unit: 'm',
  total_patches: features.length,
  total_cells: totalCells,
  classes: Object.keys(labels)
    .map(Number)
    .sort((a, b) => a - b)
    .map((cls) => {
      const bucket = buckets[cls] || { count: 0, cells: 0, min: null, max: null }
      const hasRange = Number.isFinite(bucket.min) && Number.isFinite(bucket.max)
      return {
        class: cls,
        label: labels[cls],
        color: colors[cls],
        range_min: hasRange ? bucket.min : null,
        range_max: hasRange ? bucket.max : null,
        range_label: hasRange ? `${bucket.min.toFixed(1)}–${bucket.max.toFixed(1)} m` : '—',
        patches: bucket.count,
        count: bucket.cells,
        pct: totalCells ? Math.round((bucket.cells / totalCells) * 1000) / 10 : 0,
      }
    }),
}

fs.writeFileSync(destSummary, JSON.stringify(summary, null, 2))

console.log('features', features.length, 'polygons', polygonCount, 'skipped', skipped)
console.log('wrote', destGeo, 'bytes', fs.statSync(destGeo).size)
console.log('wrote', destSummary)
console.log(summary.classes.map((c) => `${c.label}: ${c.patches} patches / ${c.count} cells (${c.pct}%)`).join('\n'))
