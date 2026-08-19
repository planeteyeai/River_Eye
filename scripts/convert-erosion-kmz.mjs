// Bank erosion hotspot GroundOverlay (2016–2026) from the supplied KMZ.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const asset = path.join(root, 'public/asset')

const srcKmz =
  process.argv[2] ||
  'c:/Users/Kunal.Desale/Downloads/83d9c994ab974aaea0052c4103f77abb.kmz'

const outPng = path.join(asset, 'mula-mutha-erosion-hotspots.png')
const outLegend = path.join(asset, 'mula-mutha-erosion-hotspots-legend.png')
const outKml = path.join(asset, 'mula-mutha-erosion-hotspots.kml')
const outJson = path.join(asset, 'mula-mutha-erosion-hotspots.json')

const CLASS_DEFS = [
  { id: 0, key: '90EE90', label: 'No erosion', color: '#90ee90' },
  { id: 1, key: 'FFFF00', label: 'Low erosion', color: '#ffff00' },
  { id: 2, key: 'FFA500', label: 'Moderate erosion', color: '#ffa500' },
  { id: 3, key: 'FF0000', label: 'High erosion', color: '#ff0000' },
  { id: 4, key: '800000', label: 'Very high erosion', color: '#800000' },
]

const tmp = path.join(root, 'tmp-erosion-kmz')
if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })

execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${srcKmz.replace(/'/g, "''")}', '${tmp.replace(/'/g, "''")}')`,
  ],
  { stdio: 'inherit' },
)

const findFile = (dir, predicate) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = findFile(full, predicate)
      if (hit) return hit
    } else if (predicate(entry.name)) {
      return full
    }
  }
  return null
}

const kmlPath = findFile(tmp, (name) => name.toLowerCase().endsWith('.kml'))
const pngPath = findFile(tmp, (name) => name.toLowerCase() === 'overlay.png')
const legendPath = findFile(tmp, (name) => name.toLowerCase() === 'legend.png')
if (!kmlPath || !pngPath) throw new Error('No GroundOverlay in KMZ')

const kml = fs.readFileSync(kmlPath, 'utf8')
fs.copyFileSync(kmlPath, outKml)
fs.copyFileSync(pngPath, outPng)
if (legendPath) fs.copyFileSync(legendPath, outLegend)

const box = {
  north: Number(kml.match(/<north>([^<]+)<\/north>/)?.[1]),
  south: Number(kml.match(/<south>([^<]+)<\/south>/)?.[1]),
  east: Number(kml.match(/<east>([^<]+)<\/east>/)?.[1]),
  west: Number(kml.match(/<west>([^<]+)<\/west>/)?.[1]),
}

execFileSync(
  'python',
  [
    path.join(root, 'scripts/sample-biodiversity-overlay.py'),
    outPng,
    outJson,
    JSON.stringify(box),
    JSON.stringify(CLASS_DEFS),
  ],
  { stdio: 'inherit' },
)

const doc = JSON.parse(fs.readFileSync(outJson, 'utf8'))
const classes = doc.layers?.[0]?.classes || []
const rewritten = {
  name: 'Bank Erosion Hotspot (2016–2026)',
  theme: 'Geology',
  period: '2016-2026',
  sensor: 'Unconfirmed in KMZ (year-to-year erosion count, clipped to Mula-Mutha AOI)',
  note:
    "Hotspot = number of year-to-year periods with detected erosion. Overlay clipped so 'No erosion' does not spill onto surrounding land. High / very high classes are in the KMZ legend but have no pixels in this clip.",
  bounds: box,
  raster: '/asset/mula-mutha-erosion-hotspots.png',
  legend: legendPath ? '/asset/mula-mutha-erosion-hotspots-legend.png' : null,
  imageCoordinates: [
    [box.west, box.north],
    [box.east, box.north],
    [box.east, box.south],
    [box.west, box.south],
  ],
  classes,
  total_pixels: doc.layers?.[0]?.total_pixels,
  total_area_ha: doc.layers?.[0]?.total_area_ha,
  source_kmz: '83d9c994ab974aaea0052c4103f77abb.kmz',
  source_name: kml.match(/<name>([^<]+)<\/name>/)?.[1] || 'Erosion_Hotspots_2016_2026',
}

fs.writeFileSync(outJson, JSON.stringify(rewritten, null, 2), 'utf8')
console.log('wrote', outJson)
console.log('wrote', outPng)
