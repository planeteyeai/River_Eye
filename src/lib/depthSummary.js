const DEPTH_SUMMARY_URL = '/asset/mula-mutha-depth-summary.json'

let cachedSummary = null

export async function fetchDepthSummary() {
  if (cachedSummary) return cachedSummary
  const response = await fetch(DEPTH_SUMMARY_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Depth summary → ${response.status}`)
  cachedSummary = await response.json()
  return cachedSummary
}

export function clearDepthSummaryCache() {
  cachedSummary = null
}
