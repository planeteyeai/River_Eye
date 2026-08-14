import fs from 'fs'

const src = 'c:/Users/Kunal.Desale/Downloads/d420f9d7acba418cbac3311a0c8b8284.kml'
const destGeo = 'public/asset/mula-mutha-silt-class.geojson'
const destKml = 'public/asset/mula-mutha-silt-class.kml'

const xml = fs.readFileSync(src, 'utf8')
fs.copyFileSync(src, destKml)

const labels = {
  1: 'Low Silt',
  2: 'Moderate Silt',
  3: 'High Silt',
  4: 'Very High Silt',
}
const ranges = {
  1: '0–0.25',
  2: '0.25–0.50',
  3: '0.50–0.75',
  4: '0.75–1.00',
}

const features = []
const re =
  /<Placemark>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<Data name="class_value"><value>(\d)<\/value><\/Data>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/Placemark>/g

let match
while ((match = re.exec(xml))) {
  const name = match[1].trim()
  const cls = Number(match[2])
  if (!labels[cls]) continue
  const ring = match[3]
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number)
      return [lng, lat]
    })
  if (ring.length < 3) continue
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first])

  features.push({
    type: 'Feature',
    properties: {
      class: cls,
      label: labels[cls],
      range: ranges[cls],
      name,
      parameter: 'Relative Silt Level',
    },
    geometry: { type: 'Polygon', coordinates: [ring] },
  })
}

const collection = {
  type: 'FeatureCollection',
  name: 'Mula-Mutha Relative Silt Level',
  source_name: 'Relative Silt Level',
  legend: [
    { class: 1, label: 'Low Silt', range: '0–0.25' },
    { class: 2, label: 'Moderate Silt', range: '0.25–0.50' },
    { class: 3, label: 'High Silt', range: '0.50–0.75' },
    { class: 4, label: 'Very High Silt', range: '0.75–1.00' },
  ],
  features,
}

fs.writeFileSync(destGeo, JSON.stringify(collection))
const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }
for (const f of features) counts[f.properties.class] += 1
console.log('wrote', destGeo, 'features', features.length, counts, 'bytes', fs.statSync(destGeo).size)
