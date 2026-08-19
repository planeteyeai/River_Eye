// Monthly silt classification + volume GroundOverlays from the Jan-Jul 2026 KMZ pack.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const asset = path.join(root, 'public/asset')

const srcDir =
  process.argv[2] ||
  'c:/Users/Kunal.Desale/Downloads/8bd9b727189f478698b5f10a2a7fde45/Jan_2026_to_Jun_2026_Silt_Classification'

const unpack = path.join(root, 'tmp-silt-kmz')
if (fs.existsSync(unpack)) fs.rmSync(unpack, { recursive: true, force: true })
fs.mkdirSync(unpack, { recursive: true })

const CLASS_DEFS = [
  { id: 1, key: '44CE1B', label: 'Low', color: '#44ce1b' },
  { id: 2, key: 'CEDD54', label: 'Moderate', color: '#cedd54' },
  { id: 3, key: 'F3B549', label: 'High', color: '#f3b549' },
  { id: 4, key: 'E51F1F', label: 'Very High', color: '#e51f1f' },
]

const MONTHS = [
  {
    id: 0,
    month: '2026-01',
    label: 'Jan 2026',
    classification: 'Jan_2026_Silt_Classification.kmz',
    volume: 'Jan_2026_Silt_Volume_Surface__1_.kmz',
  },
  {
    id: 1,
    month: '2026-02',
    label: 'Feb 2026',
    classification: 'Feb_2026_Silt_Classification.kmz',
    volume: 'Feb_2026_Silt_Volume_Surface.kmz',
  },
  {
    id: 2,
    month: '2026-03',
    label: 'Mar 2026',
    classification: 'Mar_2026_Silt_Classification.kmz',
    volume: 'Mar_2026_Silt_Volume_Surface.kmz',
  },
  {
    id: 3,
    month: '2026-04',
    label: 'Apr 2026',
    classification: 'Apr_2026_Silt_Classification.kmz',
    volume: 'Apr_2026_Silt_Volume_Surface.kmz',
  },
  {
    id: 4,
    month: '2026-05',
    label: 'May 2026',
    classification: 'May_2026_Silt_Classification.kmz',
    volume: 'May_2026_Silt_Volume_Surface.kmz',
  },
  {
    id: 5,
    month: '2026-06',
    label: 'Jun 2026',
    classification: 'Jun_2026_Silt_Classification.kmz',
    volume: 'Jun_2026_Silt_Volume_Surface.kmz',
  },
  {
    id: 6,
    month: '2026-07',
    label: 'Jul 2026',
    classification: 'Jul_2026_Silt_Classification__1_.kmz',
    volume: 'Jul_2026_Silt_Volume_Surface__1_.kmz',
  },
]

const unzip = (kmzPath, dest) => {
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
}

const findFile = (dir, predicate) => {
  const walk = (here) => {
    for (const entry of fs.readdirSync(here, { withFileTypes: true })) {
      const full = path.join(here, entry.name)
      if (entry.isDirectory()) {
        const hit = walk(full)
        if (hit) return hit
      } else if (predicate(entry.name)) {
        return full
      }
    }
    return null
  }
  return walk(dir)
}

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

const extractOverlay = (kmzName, destName) => {
  const kmzPath = path.join(srcDir, kmzName)
  if (!fs.existsSync(kmzPath)) throw new Error(`Missing ${kmzPath}`)
  const dest = path.join(unpack, destName)
  unzip(kmzPath, dest)
  const kmlPath = findFile(dest, (name) => name.toLowerCase().endsWith('.kml'))
  const pngPath = findFile(dest, (name) => name.toLowerCase() === 'overlay.png')
  if (!kmlPath || !pngPath) throw new Error(`No overlay in ${kmzName}`)
  const kml = fs.readFileSync(kmlPath, 'utf8')
  const outPng = path.join(asset, `${destName}.png`)
  fs.copyFileSync(pngPath, outPng)
  return {
    kml,
    bounds: boxFromKml(kml),
    raster: `/asset/${destName}.png`,
    bytes: fs.statSync(outPng).size,
    description: kml.match(/<description>([^<]+)<\/description>/)?.[1] || '',
  }
}

const sampleClasses = (pngRel, bounds) => {
  const raw = execFileSync(
    'python',
    [
      path.join(root, 'scripts/sample-silt-overlay.py'),
      path.join(root, 'public', pngRel.replace(/^\//, '')),
      JSON.stringify(bounds),
      JSON.stringify(CLASS_DEFS),
    ],
    { encoding: 'utf8' },
  )
  return JSON.parse(raw.trim().split('\n').pop())
}

const csvPath = path.join(srcDir, 'River_Silt_Statistics (2).csv')
const csv = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/)
const headers = csv[0].split(',')
const values = csv[1].split(',')
const csvRow = Object.fromEntries(headers.map((h, i) => [h, values[i]]))
const km2ToHa = (n) => Math.round(Number(n) * 100 * 10) / 10

const periods = MONTHS.map((month) => {
  const slug = `mula-mutha-silt-class-${month.month}`
  const volSlug = `mula-mutha-silt-volume-${month.month}`
  const classification = extractOverlay(month.classification, slug)
  const volume = extractOverlay(month.volume, volSlug)
  const sampled = sampleClasses(classification.raster, classification.bounds)
  console.log(month.label, sampled.classes.map((c) => `${c.label} ${c.share_pct}%`).join(', '))
  return {
    id: month.id,
    month: month.month,
    label: month.label,
    classification_kmz: month.classification,
    volume_kmz: month.volume,
    bounds: classification.bounds,
    imageCoordinates: coordsFromBox(classification.bounds),
    classification: {
      raster: classification.raster,
      bytes: classification.bytes,
      classes: sampled.classes,
      total_pixels: sampled.opaque_pixels,
      total_area_ha: sampled.total_area_ha,
    },
    volume: {
      raster: volume.raster,
      bytes: volume.bytes,
      bounds: volume.bounds,
      imageCoordinates: coordsFromBox(volume.bounds),
      scale_max: 94.31,
      unit: 'unconfirmed',
    },
  }
})

const doc = {
  name: 'Mula-Mutha silt classification',
  source_folder: 'Jan_2026_to_Jun_2026_Silt_Classification',
  source_id: '8bd9b727189f478698b5f10a2a7fde45',
  captured: '2026-01 to 2026-07',
  kind: 'Estimated',
  sensor: 'Sentinel-2 (from KMZ pack; exact scenes not listed per month)',
  note: 'Discrete silt classes 1-4 from monthly GroundOverlays. Volume surface uses a shared 0-94.31 colour scale across months; the unit is unconfirmed in the KMZ. Class 0 (no data) is transparent. CSV areas are one Jun-Aug window, not monthly.',
  default_period: 5,
  classes: CLASS_DEFS.map(({ id, label, color }) => ({ class: id, label, color })),
  csv: {
    file: 'River_Silt_Statistics (2).csv',
    start_date: csvRow.Start_Date,
    end_date: csvRow.End_Date,
    water_area_ha: km2ToHa(csvRow.Water_Area_km2),
    mean_silt_score: Number(Number(csvRow.Mean_Silt_Score).toFixed(3)),
    sentinel2_image_count: Number(csvRow.Sentinel2_Image_Count),
    classes: [
      { class: 1, label: 'Low', area_ha: km2ToHa(csvRow.Low_Silt_Area_km2), share_pct: Number(Number(csvRow.Low_Silt_Percent).toFixed(1)) },
      { class: 2, label: 'Moderate', area_ha: km2ToHa(csvRow.Moderate_Silt_Area_km2), share_pct: Number(Number(csvRow.Moderate_Silt_Percent).toFixed(1)) },
      { class: 3, label: 'High', area_ha: km2ToHa(csvRow.High_Silt_Area_km2), share_pct: Number(Number(csvRow.High_Silt_Percent).toFixed(1)) },
      { class: 4, label: 'Very High', area_ha: km2ToHa(csvRow.Very_High_Silt_Area_km2), share_pct: Number(Number(csvRow.Very_High_Silt_Percent).toFixed(1)) },
    ],
  },
  periods,
}

fs.writeFileSync(path.join(asset, 'mula-mutha-silt.json'), JSON.stringify(doc, null, 2))
fs.rmSync(unpack, { recursive: true, force: true })
console.log('wrote public/asset/mula-mutha-silt.json periods', periods.length)
