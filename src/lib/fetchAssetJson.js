// public/_redirects rewrites every unmatched path to index.html with a 200, so
// an asset missing from a deploy arrives as HTML that still passes response.ok.
// Parsing that as JSON raises a bare syntax error which reads like a corrupt
// file, hiding the real cause: the file was never deployed.
const LOOKS_LIKE_HTML = /^\s*(<!doctype|<html)/i

export async function fetchAssetJson(url, label = url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${label} → ${response.status} for ${url}`)

  const body = await response.text()
  if (LOOKS_LIKE_HTML.test(body)) {
    throw new Error(`${label} → ${url} is missing from this deploy (server returned index.html)`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${label} → ${url} did not contain valid JSON`)
  }
}
