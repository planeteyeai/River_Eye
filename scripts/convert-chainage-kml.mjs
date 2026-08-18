import fs from 'fs'

const src = process.argv[2] || 'c:/Users/Kunal.Desale/Downloads/e16af4da5acc48c597e4e8b1c64a5d74.kml'
const destGeo = 'public/asset/mula-mutha-chainage.geojson'
const destKml = 'public/asset/mula-mutha-chainage.kml'

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

const chainageMFromName = (name) => {
  const match = String(name).match(/^(\d+)\+(\d{3})$/)
  if (!match) return null
  return Number(match[1]) * 1000 + Number(match[2])
}

const features = []

const lineMatch = xml.match(
  /<name>River Centerline<\/name>[\s\S]*?<coordinates>([^<]+)<\/coordinates>/,
)
if (lineMatch) {
  const coords = parsePairs(lineMatch[1])
  features.push({
    type: 'Feature',
    properties: { kind: 'centerline', name: 'River Centerline' },
    geometry: { type: 'LineString', coordinates: coords },
  })
}

const pointRe =
  /<Placemark[\s\S]*?<name>(\d+\+\d{3})<\/name>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/Placemark>/g
let match
while ((match = pointRe.exec(xml))) {
  const name = match[1]
  const [lng, lat] = match[2].trim().split(',').map(Number)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
  const chainage_m = chainageMFromName(name)
  features.push({
    type: 'Feature',
    properties: {
      kind: 'station',
      name,
      chainage_m,
      km: chainage_m / 1000,
      major: chainage_m % 1000 === 0,
    },
    geometry: { type: 'Point', coordinates: [lng, lat] },
  })
}

const stations = features.filter((f) => f.properties.kind === 'station')
const collection = {
  type: 'FeatureCollection',
  name: 'Mula-Mutha chainage',
  source_name: 'Mula Mutha River – Chainage Analysis',
  interval_m: 100,
  station_count: stations.length,
  first: stations[0]?.properties.name || null,
  last: stations[stations.length - 1]?.properties.name || null,
  features,
}

fs.writeFileSync(destGeo, JSON.stringify(collection))
console.log(
  'wrote',
  destGeo,
  'features',
  features.length,
  'stations',
  stations.length,
  collection.first,
  '→',
  collection.last,
  'bytes',
  fs.statSync(destGeo).size,
)
