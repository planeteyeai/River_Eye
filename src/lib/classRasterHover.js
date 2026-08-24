/** Sample a classed overlay PNG at a lon/lat using GroundOverlay corners. */

const cache = new Map()

export const CLASS_HOVER_EVENT = 'rivereye-class-hover'

export const hexToRgb = (hex) => {
  const h = String(hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const matchClassByRgb = (r, g, b, classes, maxDelta = 54) => {
  let best = null
  let bestD = maxDelta
  for (const row of classes || []) {
    const rgb = hexToRgb(row.color)
    if (!rgb) continue
    const d = Math.abs(r - rgb[0]) + Math.abs(g - rgb[1]) + Math.abs(b - rgb[2])
    if (d < bestD) {
      bestD = d
      best = row
    }
  }
  return best
}

export const classNoteValue = (row) => {
  if (!row) return ''
  if (row.value != null && row.value !== '') return String(row.value)
  if (Number.isFinite(row.share_pct)) return `${row.share_pct}%`
  return ''
}

export const loadClassRaster = async (url) => {
  if (!url) return null
  if (cache.has(url)) return cache.get(url)
  const pending = (async () => {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    return {
      width: canvas.width,
      height: canvas.height,
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    }
  })()
  cache.set(url, pending)
  try {
    return await pending
  } catch (error) {
    cache.delete(url)
    throw error
  }
}

export const sampleClassRaster = (raster, lng, lat, corners, classes) => {
  if (!raster || !corners?.length || lng == null || lat == null) return null
  const west = corners[0][0]
  const north = corners[0][1]
  const east = corners[1][0]
  const south = corners[2][1]
  if (lng < west || lng > east || lat > north || lat < south) return null
  const u = (lng - west) / (east - west || 1)
  const v = (north - lat) / (north - south || 1)
  const x = Math.min(raster.width - 1, Math.max(0, Math.floor(u * raster.width)))
  const y = Math.min(raster.height - 1, Math.max(0, Math.floor(v * raster.height)))
  const i = (y * raster.width + x) * 4
  if (raster.data[i + 3] < 28) return null
  return matchClassByRgb(raster.data[i], raster.data[i + 1], raster.data[i + 2], classes)
}

export const publishClassHover = (note) => {
  window.dispatchEvent(new CustomEvent(CLASS_HOVER_EVENT, { detail: note }))
}
