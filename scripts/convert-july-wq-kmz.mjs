import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const asset = path.join(root, 'public/asset')

const srcDir =
  process.argv[2] ||
  'c:/Users/Kunal.Desale/Downloads/e26f9dcc9f5542aabde877f7c2dfca31/JULY NDCI NDVI TSS &WST'

const unpack = path.join(root, 'tmp-july-wq')
if (fs.existsSync(unpack)) fs.rmSync(unpack, { recursive: true, force: true })
fs.mkdirSync(unpack, { recursive: true })

const boxFromKml = (kml) => ({
  north: Number(kml.match(/<north>([^<]+)<\/north>/)?.[1]),
  south: Number(kml.match(/<south>([^<]+)<\/south>/)?.[1]),
  east: Number(kml.match(/<east>([^<]+)<\/east>/)?.[1]),
  west: Number(kml.match(/<west>([^<]+)<\/west>/)?.[1]),
})

const coordsFromBox = (box) => [
  [box.west, box.north],
  [box.east, box.north],
  [box.east, box.south],
  [box.west, box.south],
]

const layers = [
  {
    id: 'tss',
    title: 'Turbidity / TSS',
    kmz: 'MulaMutha_Turbidity',
    pngName: 'MulaMutha_Turbidity.png',
    outPng: 'mula-mutha-tss-overlay.png',
    outKml: 'mula-mutha-tss-class.kml',
    classes: [
      { class: 1, label: 'Low', range: 'TSS ≤ 0.62', color: '#2196F3' },
      { class: 2, label: 'Medium', range: '0.62–1.17', color: '#FFC107' },
      { class: 3, label: 'High', range: '> 1.17', color: '#F44336' },
    ],
  },
  {
    id: 'ndci',
    title: 'NDCI — Chlorophyll',
    kmz: 'MulaMutha_NDCI',
    pngName: 'MulaMutha_NDCI.png',
    outPng: 'mula-mutha-ndci-overlay.png',
    outKml: 'mula-mutha-ndci-class.kml',
    classes: [
      { class: 1, label: 'Low Chlorophyll', range: 'NDCI < 0', color: '#C8E6C9' },
      { class: 2, label: 'High Chlorophyll', range: 'NDCI ≥ 0', color: '#1B5E20' },
    ],
  },
  {
    id: 'ndwi',
    title: 'NDWI — Water Detection',
    kmz: 'MulaMutha_NDWI',
    pngName: 'MulaMutha_NDWI.png',
    outKml: 'mula-mutha-ndwi-class.kml',
    outPng: 'mula-mutha-ndwi-overlay.png',
    classes: [
      { class: 1, label: 'Non-water', range: 'NDWI ≤ 0', color: '#8D6E63' },
      { class: 2, label: 'Water', range: 'NDWI > 0', color: '#0D47A1' },
    ],
  },
  {
    id: 'wst',
    title: 'WST — Temperature',
    kmz: 'MulaMutha_WST_Temperature',
    pngName: 'MulaMutha_WST_Temperature.png',
    outPng: 'mula-mutha-wst-overlay.png',
    outKml: 'mula-mutha-wst-class.kml',
    classes: [
      { class: 1, label: 'Very Low', range: '<27 °C', color: '#1565C0' },
      { class: 2, label: 'Low', range: '27–<30 °C', color: '#64B5F6' },
      { class: 3, label: 'Moderate', range: '30–<33 °C', color: '#FFD54F' },
      { class: 4, label: 'High', range: '33–<36 °C', color: '#E53935' },
      { class: 5, label: 'Very High', range: '≥36 °C', color: '#8E0000' },
    ],
  },
]

const built = []
for (const layer of layers) {
  const kmzPath = path.join(srcDir, `${layer.kmz}.kmz`)
  const dest = path.join(unpack, layer.kmz)
  fs.mkdirSync(dest, { recursive: true })
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${kmzPath.replace(/'/g, "''")}', '${dest.replace(/'/g, "''")}')`,
    ],
    { stdio: 'inherit' },
  )
  const kmlPath = path.join(dest, 'doc.kml')
  const pngPath = path.join(dest, layer.pngName)
  if (!fs.existsSync(kmlPath) || !fs.existsSync(pngPath)) {
    throw new Error(`Missing extracted files for ${layer.id}: ${kmlPath}`)
  }
  const kml = fs.readFileSync(kmlPath, 'utf8')
  fs.copyFileSync(pngPath, path.join(asset, layer.outPng))
  fs.copyFileSync(kmlPath, path.join(asset, layer.outKml))
  const bounds = boxFromKml(kml)
  const pngStat = fs.statSync(path.join(asset, layer.outPng))
  built.push({
    id: layer.id,
    title: layer.title,
    source_kmz: `${layer.kmz}.kmz`,
    captured: 'July 2026',
    raster: `/asset/${layer.outPng}`,
    kml: `/asset/${layer.outKml}`,
    bounds,
    imageCoordinates: coordsFromBox(bounds),
    classes: layer.classes,
    bytes: pngStat.size,
  })
  console.log('wrote', layer.outPng, pngStat.size, 'bytes', bounds)
}

const doc = {
  name: 'Mula-Mutha water-quality overlays',
  captured: 'July 2026',
  note:
    'Classified GroundOverlay rasters from the July NDCI / NDWI / TSS / WST KMZ pack. The download folder was labelled NDVI; the file is NDWI (water classification). Same AOI as the biodiversity overlays except WST, which is a slightly larger LatLonBox.',
  layers: built,
}

const outJson = path.join(asset, 'mula-mutha-wq-overlays.json')
fs.writeFileSync(outJson, JSON.stringify(doc, null, 2))
fs.rmSync(unpack, { recursive: true, force: true })
console.log('wrote', outJson)
console.log('source dir', srcDir)
