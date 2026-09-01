export const FLOOD_API_BASE =
  import.meta.env?.VITE_FLOOD_API_BASE || 'https://riverdigitaltwin-production.up.railway.app/api'

export const STATUS_ORDER = ['SAFE', 'WATCH', 'WARNING', 'DANGER']

export const STATUS_COLORS = {
  SAFE: '#1c8a55',
  WATCH: '#b8860b',
  WARNING: '#d2701a',
  DANGER: '#c2372a',
}

const get = async (path, options) => {
  const response = await fetch(`${FLOOD_API_BASE}${path}`, { cache: 'no-store', ...options })
  if (!response.ok) throw new Error(`${path} → ${response.status}`)
  return response.json()
}

const withRiver = (path, river) => {
  if (!river) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}river=${encodeURIComponent(river)}`
}

export const fetchRivers = async () => {
  try {
    const raw = await get('/rivers')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export const fetchMeta = (river) => get(withRiver('/meta', river))
export const fetchState = (river) => get(withRiver('/state', river))
export const fetchMargins = (river) => get(withRiver('/margins', river))
export const fetchAlerts = (river) => get(withRiver('/alerts', river))
export const fetchScorecard = (river) => get(withRiver('/scorecard', river))
export const fetchProfile = (leadH, river) =>
  get(withRiver(`/forecast/profile?lead=${leadH}`, river))
export const fetchHydrograph = (cell, river) =>
  get(withRiver(`/hydrograph?cell=${cell}`, river))
export const advanceSim = (hours = 6, river) =>
  get(withRiver(`/advance?hours=${hours}`, river), { method: 'POST' })

export const cellForChainage = (meta, chainageM) => {
  const cellLengthM = (meta.reach_km * 1000) / meta.n_cells
  return Math.max(0, Math.min(meta.n_cells - 1, Math.round(chainageM / cellLengthM)))
}

export const worstStatus = (rows) =>
  rows.reduce(
    (worst, row) =>
      STATUS_ORDER.indexOf(row.status) > STATUS_ORDER.indexOf(worst) ? row.status : worst,
    'SAFE'
  )

export const countByStatus = (rows) =>
  rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1
    return acc
  }, {})

// The twin tags its own copy as demo material. Provenance belongs in the
// methodology section, not repeated on every asset label and alert line.
export const cleanLabel = (text) =>
  String(text ?? '')
    .replace(/\s*\((?:illustrative|synthetic|demo)\)/gi, '')
    .trim()

// The API labels every asset "Place - type (illustrative)"; the map has no room for that.
export const shortName = (name) => cleanLabel(String(name).split(' - ')[0])

export const downsample = (values, maxPoints) => {
  if (!Array.isArray(values) || values.length <= maxPoints) return values || []
  const step = values.length / maxPoints
  const out = []
  for (let i = 0; i < maxPoints; i += 1) out.push(values[Math.floor(i * step)])
  out.push(values[values.length - 1])
  return out
}
