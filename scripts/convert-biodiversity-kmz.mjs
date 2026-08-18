// Build biodiversity vegetation-type assets from the supplied KMZ.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const srcKmz =
  process.argv[2] ||
  'c:/Users/Kunal.Desale/Downloads/eb3c93c20f2944a1a4655fc21bac443a.kmz'

const outPng = path.join(root, 'public/asset/mula-mutha-biodiversity-overlay.png')
const outKml = path.join(root, 'public/asset/mula-mutha-biodiversity.kml')
const outJson = path.join(root, 'public/asset/mula-mutha-biodiversity.json')

const tmp = path.join(root, 'tmp-biodiv-extract')
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

const kml = fs.readFileSync(path.join(tmp, 'doc.kml'), 'utf8')
fs.copyFileSync(path.join(tmp, 'overlay.png'), outPng)
fs.copyFileSync(path.join(tmp, 'doc.kml'), outKml)

const box = {
  north: Number(kml.match(/<north>([^<]+)<\/north>/)?.[1]),
  south: Number(kml.match(/<south>([^<]+)<\/south>/)?.[1]),
  east: Number(kml.match(/<east>([^<]+)<\/east>/)?.[1]),
  west: Number(kml.match(/<west>([^<]+)<\/west>/)?.[1]),
}

const CLASS_DEFS = [
  { id: 1, key: '006400', label: 'Trees', color: '#006400' },
  { id: 2, key: '8B4513', label: 'Shrub / Scrub', color: '#8B4513' },
  { id: 3, key: '7CFC00', label: 'Grass / Herbaceous', color: '#7CFC00' },
  { id: 4, key: '800080', label: 'Mixed / Diverse', color: '#800080' },
]

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

fs.rmSync(tmp, { recursive: true, force: true })
console.log('wrote', outJson)
console.log('wrote', outPng)
