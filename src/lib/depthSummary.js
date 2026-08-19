import { fetchAssetJson } from './fetchAssetJson'

const DEPTH_SUMMARY_URL = '/asset/mula-mutha-depth-summary.json'

let cachedSummary = null

export async function fetchDepthSummary() {
  if (cachedSummary) return cachedSummary
  cachedSummary = await fetchAssetJson(DEPTH_SUMMARY_URL, 'Depth summary')
  return cachedSummary
}

export function clearDepthSummaryCache() {
  cachedSummary = null
}
