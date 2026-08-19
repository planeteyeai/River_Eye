import fs from 'fs'

const src = process.argv[2] || 'c:/Users/Kunal.Desale/Downloads/e026fb3446f44831a85a726f4f98a06c.kml'
const destGeo = 'public/asset/mula-mutha-tributaries.geojson'
const destKml = 'public/asset/mula-mutha-tributaries.kml'

const xml = fs.readFileSync(src, 'utf8')
fs.copyFileSync(src, destKml)

const parsePairs = (text) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number)
      return [lng, lat]
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))

const simpleData = (block, key) => {
  const match = block.match(new RegExp(`<SimpleData name="${key}">([^<]*)</SimpleData>`))
  return match ? match[1].trim() : ''
}

const MAIN_STEM = new Set(['Mula', 'Mutha', 'Mula-Mutha'])

const classify = (name, waterway) => {
  if (MAIN_STEM.has(name) || (waterway === 'river' && MAIN_STEM.has(name))) return 'mainstem'
  if (waterway === 'river') return 'mainstem'
  if (waterway === 'stream') return 'stream'
  if (waterway === 'drain') return 'drain'
  if (waterway === 'canal') return 'canal'
  if (waterway === 'ditch') return 'ditch'
  return 'feeder'
}

const features = []
const placemarkRe = /<Placemark[\s\S]*?<\/Placemark>/g
let block
while ((block = placemarkRe.exec(xml))) {
  const xmlBlock = block[0]
  const nameMatch = xmlBlock.match(/<name>([^<]*)<\/name>/)
  const name = nameMatch ? nameMatch[1].trim() : ''
  const waterway = simpleData(xmlBlock, 'waterway')
  const osmId = simpleData(xmlBlock, 'osm_id')
  const intermittent = simpleData(xmlBlock, 'intermittent')
  const tunnel = simpleData(xmlBlock, 'tunnel')
  const lines = [...xmlBlock.matchAll(/<LineString>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/LineString>/g)]
    .map((row) => parsePairs(row[1]))
    .filter((coords) => coords.length >= 2)
  if (!lines.length) continue

  const geometry =
    lines.length === 1
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines }

  features.push({
    type: 'Feature',
    properties: {
      name: name || null,
      waterway: waterway || null,
      class: classify(name, waterway),
      osm_id: osmId || null,
      intermittent: intermittent || null,
      tunnel: tunnel || null,
    },
    geometry,
  })
}

const counts = {}
for (const feature of features) {
  const key = feature.properties.class
  counts[key] = (counts[key] || 0) + 1
}

const collection = {
  type: 'FeatureCollection',
  name: 'Mula-Mutha joining streams',
  source_name: 'clipped OSM waterways (e026fb3446f44831a85a726f4f98a06c.kml)',
  feature_count: features.length,
  counts,
  classes: [
    { id: 'mainstem', label: 'Main stem (Mula / Mutha)', color: '#1d4e89', count: counts.mainstem || 0 },
    { id: 'stream', label: 'Named streams', color: '#12b5a8', count: counts.stream || 0 },
    { id: 'feeder', label: 'Joining feeders', color: '#5ad2f4', count: counts.feeder || 0 },
    { id: 'drain', label: 'Drains / nullahs', color: '#f4a261', count: counts.drain || 0 },
    { id: 'canal', label: 'Canals', color: '#3d8bfd', count: counts.canal || 0 },
    { id: 'ditch', label: 'Ditches', color: '#8d99ae', count: counts.ditch || 0 },
  ],
  features,
}

fs.writeFileSync(destGeo, JSON.stringify(collection))
console.log('wrote', destGeo, 'features', features.length, counts)
