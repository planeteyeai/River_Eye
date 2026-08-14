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

export const fetchMeta = () => get('/meta')
export const fetchState = () => get('/state')
export const fetchMargins = () => get('/margins')
export const fetchAlerts = () => get('/alerts')
export const fetchScorecard = () => get('/scorecard')
export const fetchProfile = (leadH) => get(`/forecast/profile?lead=${leadH}`)
export const fetchHydrograph = (cell) => get(`/hydrograph?cell=${cell}`)
export const advanceSim = (hours = 6) => get(`/advance?hours=${hours}`, { method: 'POST' })

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
