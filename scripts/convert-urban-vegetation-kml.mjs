// Extract the urban vegetation classification from the Google Earth KML export.
//
// The KML is a pair of GroundOverlays: a LatLonBox extent plus an HTML table of
// class shares in each <description>. The referenced overlay PNGs are NOT part
// of a .kml-only export, so only the extent and the tables can be recovered.
import fs from 'fs'

const src = process.argv[2] || 'c:/Users/Kunal.Desale/Downloads/c0bd6d6d12cd420595b6636dd6732585.kml'
const destJson = 'public/asset/mula-mutha-urban-vegetation.json'
const destKml = 'public/asset/mula-mutha-urban-vegetation.kml'

const xml = fs.readFileSync(src, 'utf8')
fs.copyFileSync(src, destKml)

const rgbToHex = (rgb) => {
  const [r, g, b] = rgb.split(',').map((v) => Number(v.trim()))
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const number = (text) => Number(String(text).replace(/,/g, ''))

const folderRe = /<Folder>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>[\s\S]*?<north>([^<]+)<\/north>\s*<south>([^<]+)<\/south>\s*<east>([^<]+)<\/east>\s*<west>([^<]+)<\/west>[\s\S]*?<\/Folder>/g

const rowRe = /<tr><td[^>]*background:rgb\(([^)]+)\)[^>]*>[\s\S]*?<\/td><td[^>]*>([^<]+)<\/td><td[^>]*>([\d,]+)<\/td><td[^>]*>([\d.]+)\s*ha<\/td><td[^>]*>([\d.]+)%<\/td><\/tr>/g

const layers = []
let bounds = null
let match

while ((match = folderRe.exec(xml))) {
  const [, folderName, description, north, south, east, west] = match
  bounds = {
    north: Number(north),
    south: Number(south),
    east: Number(east),
    west: Number(west),
  }

  const classes = []
  let row
  rowRe.lastIndex = 0
  while ((row = rowRe.exec(description))) {
    classes.push({
      class: classes.length + 1,
      label: row[2].trim(),
      color: rgbToHex(row[1]),
      pixels: number(row[3]),
      area_ha: Number(row[4]),
      share_pct: Number(row[5]),
    })
  }
  if (!classes.length) continue

  layers.push({
    id: folderName.toLowerCase().includes('health') ? 'health' : 'type',
    title: folderName.trim(),
    classes,
    total_pixels: classes.reduce((sum, c) => sum + c.pixels, 0),
    total_area_ha: Number(classes.reduce((sum, c) => sum + c.area_ha, 0).toFixed(1)),
  })
}

if (!layers.length || !bounds) throw new Error('no classified folders found in the KML')

const { north, south, east, west } = bounds
const extent = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { label: 'Vegetation classification extent · strict 1 km buffer' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    },
  ],
}

const doc = {
  name: (xml.match(/<Document>\s*<name>([^<]+)<\/name>/) || [])[1] || 'Vegetation classification',
  sensor: 'Sentinel-2',
  pixel_size_m: 10,
  captured: 'May 2026',
  note: 'Class 0 (outside the strict 1 km buffer) is not rendered.',
  // The KML points at type_overlay.png / health_overlay.png, which a .kml-only
  // export leaves behind. Fill these in if the .kmz is supplied.
  raster: { type: null, health: null },
  bounds,
  extent,
  layers,
}

fs.writeFileSync(destJson, JSON.stringify(doc, null, 2))
console.log('wrote', destJson)
layers.forEach((layer) => {
  console.log(
    `${layer.id}: ${layer.classes.length} classes · ${layer.total_pixels} px · ${layer.total_area_ha} ha`
  )
  layer.classes.forEach((c) =>
    console.log(`   ${c.class} ${c.label} ${c.color} ${c.area_ha} ha ${c.share_pct}%`)
  )
})
console.log('bounds', bounds)
