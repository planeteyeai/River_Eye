import { fetchAssetJson } from './fetchAssetJson'

export const DTM_META_URL = '/asset/mula-mutha-dtm.json'

const METERS_PER_DEG_LAT = 110574

let cache = null

export async function loadDtmGrid() {
  if (cache) return cache
  const meta = await fetchAssetJson(DTM_META_URL, 'FABDEM DTM')
  const response = await fetch(meta.bin, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`DTM bin → ${response.status}`)
  const buffer = await response.arrayBuffer()
  const expected = meta.width * meta.height * 4
  if (buffer.byteLength < expected) {
    throw new Error(`DTM bin too small (${buffer.byteLength} < ${expected})`)
  }
  const elevations = new Float32Array(buffer, 0, meta.width * meta.height)
  cache = { meta, elevations }
  return cache
}

/** Approximate ground area of one DTM cell (m²) from WGS84 pixel size. */
export function cellAreaM2(meta) {
  const dLon = Number(meta?.pixel_size_deg)
  const dLat = Number(meta?.pixel_size_deg)
  if (!Number.isFinite(dLon) || dLon <= 0) return 0
  const south = Number(meta?.bounds?.south)
  const north = Number(meta?.bounds?.north)
  const midLat = Number.isFinite(south) && Number.isFinite(north)
    ? (south + north) / 2
    : 18.535
  const metersPerDegLon = 111320 * Math.cos((midLat * Math.PI) / 180)
  return dLon * metersPerDegLon * dLat * METERS_PER_DEG_LAT
}

/**
 * Bathtub spread stats at waterLevelM.
 * Area = wet cells × cell area; volume = Σ (stage − elev) × cell area.
 */
export function summarizeInundation(elevations, meta, waterLevelM) {
  const cellM2 = cellAreaM2(meta)
  let wetCells = 0
  let depthSumM = 0
  if (!elevations?.length || !Number.isFinite(waterLevelM) || cellM2 <= 0) {
    return {
      wetCells: 0,
      totalCells: elevations?.length || 0,
      wetSharePct: 0,
      areaM2: 0,
      areaKm2: 0,
      volumeM3: 0,
      volumeMm3: 0,
      meanDepthM: 0,
      cellAreaM2: cellM2,
    }
  }
  for (let i = 0; i < elevations.length; i += 1) {
    const elev = elevations[i]
    if (!Number.isFinite(elev) || elev > waterLevelM) continue
    wetCells += 1
    depthSumM += waterLevelM - elev
  }
  const areaM2 = wetCells * cellM2
  const volumeM3 = depthSumM * cellM2
  return {
    wetCells,
    totalCells: elevations.length,
    wetSharePct: (wetCells / elevations.length) * 100,
    areaM2,
    areaKm2: areaM2 / 1e6,
    volumeM3,
    volumeMm3: volumeM3 / 1e6,
    meanDepthM: wetCells > 0 ? depthSumM / wetCells : 0,
    cellAreaM2: cellM2,
  }
}

export function formatInundationArea(stats) {
  if (!stats) return '—'
  const { areaKm2, areaM2 } = stats
  if (areaKm2 >= 0.1) return `${areaKm2.toFixed(2)} km²`
  if (areaM2 >= 100) return `${(areaM2 / 1e4).toFixed(1)} ha`
  return `${Math.round(areaM2)} m²`
}

export function formatInundationVolume(stats) {
  if (!stats) return '—'
  const { volumeMm3, volumeM3 } = stats
  if (volumeMm3 >= 0.01) return `${volumeMm3.toFixed(2)} Mm³`
  if (volumeM3 >= 1000) return `${(volumeM3 / 1000).toFixed(1)} ×10³ m³`
  return `${Math.round(volumeM3)} m³`
}

/**
 * Build a MapLibre image-source data URL for bathtub inundation at waterLevelM.
 * Native FABDEM cells (~30 m) are upsampled and lightly blurred so map edges
 * are not stair-stepped; the wet/dry test is still elev ≤ stage per DTM cell.
 */
export function renderInundationDataUrl(
  elevations,
  meta,
  waterLevelM,
  { opacity = 0.92, scale = 4, blurPx = 1.6 } = {},
) {
  const { width, height } = meta
  const native = document.createElement('canvas')
  native.width = width
  native.height = height
  const nctx = native.getContext('2d', { willReadFrequently: true })
  const image = nctx.createImageData(width, height)
  const data = image.data
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)

  for (let i = 0; i < elevations.length; i += 1) {
    const elev = elevations[i]
    const px = i * 4
    if (!Number.isFinite(elev) || elev > waterLevelM) {
      data[px] = 0
      data[px + 1] = 0
      data[px + 2] = 0
      data[px + 3] = 0
      continue
    }
    // Deeper relative fill → slightly darker blue
    const depth = Math.max(0, waterLevelM - elev)
    const t = Math.max(0, Math.min(1, depth / 8))
    data[px] = Math.round(30 + 40 * (1 - t))
    data[px + 1] = Math.round(110 + 70 * (1 - t))
    data[px + 2] = Math.round(200 + 40 * t)
    data[px + 3] = alpha
  }

  nctx.putImageData(image, 0, 0)

  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  // Soften cell stairs (~0.4 native cell at scale 4).
  if (blurPx > 0) octx.filter = `blur(${blurPx}px)`
  octx.drawImage(native, 0, 0, outW, outH)
  octx.filter = 'none'
  return out.toDataURL('image/png')
}

export function defaultFloodStageM(meta) {
  if (!meta) return 540
  const min = Number(meta.elevation_min_m)
  const max = Number(meta.elevation_max_m)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 540
  // Start near the low corridor so water appears quickly when scrubbing up.
  return Math.round((min + (max - min) * 0.18) * 10) / 10
}
