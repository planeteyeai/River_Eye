// Return-period flood corridors (10 / 25 / 100 year) for the Mula-Mutha reach.
//
// Two inputs are combined:
//   1. The published Khadakwasla annual-peak flood statistics (PMC flood
//      frequency analysis, 1940-2007) fitted with a Gumbel distribution to get
//      Q10/Q25/Q100. See DATA_SOURCES.txt section 5.1 for the source and its
//      confidence caveat. No external flood API is called: the Open-Meteo /
//      GloFAS feeds were removed from this app on request.
//   2. The channel width extracted from the user's KML polygon, cell by cell,
//      as served by the twin /meta endpoint.
//
// The corridor width is scaled from the channel width with the classic
// downstream hydraulic-geometry relation W ~ Q^b, taking bankfull as the
// 2-year flood. That is a documented approximation, NOT a surveyed flood line:
// no DEM or bathymetry is involved, so the corridor cannot capture terrain
// controls, embankments, backwater or urban drainage. It is labelled
// "Estimated" everywhere it is shown.

// Khadakwasla annual peak record as published (see DATA_SOURCES.txt 5.1).
export const GAUGE_RECORD = {
  station: 'Khadakwasla (PMC flood frequency analysis)',
  firstYear: 1940,
  lastYear: 2007,
  years: 68,
  meanAnnualPeak: 1165,
  recordPeak: 3211,
  recordPeakYear: 1958,
}

// Bankfull discharge is conventionally taken near the 1.5-2 year flood.
const BANKFULL_RETURN_PERIOD = 2

// Exponent of the width-discharge relation W = a*Q^b. Field studies put b in
// 0.4-0.5 for channels; the upper end is used since overbank flow widens faster.
const WIDTH_EXPONENT = 0.5

// Pune's valley is confined by built-up terraces, so the corridor is not
// allowed to run away on either bank.
const MAX_SPREAD_M = 450

const METERS_PER_DEG_LAT = 110540

const EULER_MASCHERONI = 0.5772

export const RETURN_PERIODS = [10, 25, 100]

export const ZONE_STYLES = {
  10: { color: '#1668b3', label: '10-year', note: '10% chance in any year' },
  25: { color: '#d2701a', label: '25-year', note: "4% · Pune's blue line" },
  100: { color: '#c2372a', label: '100-year', note: "1% · Pune's red line" },
}

export const ZONE_METHOD =
  'Khadakwasla published annual peaks (Gumbel) scaled onto the KML channel width.'

// Gumbel reduced variate for return period T.
const reducedVariate = (T) => -Math.log(-Math.log(1 - 1 / T))

/**
 * Gumbel parameters from the two figures the published analysis actually gives:
 * the mean annual peak, and the largest peak in the record. The record peak is
 * treated as the (n+1)-year event under the Weibull plotting position, which is
 * the standard way to place the largest observation of an n-year series.
 */
const fitGauge = ({ years, meanAnnualPeak, recordPeak }) => {
  const yRecord = reducedVariate(years + 1)
  const beta = (recordPeak - meanAnnualPeak) / (yRecord - EULER_MASCHERONI)
  const mu = meanAnnualPeak - EULER_MASCHERONI * beta
  return { mu, beta }
}

/**
 * Q10/Q25/Q100 (plus the bankfull reference) in m3/s at Khadakwasla.
 * Synchronous and offline — the record is a fixed published series.
 */
export const getReturnPeriods = () => {
  const { mu, beta } = fitGauge(GAUGE_RECORD)
  const levels = {}
  ;[BANKFULL_RETURN_PERIOD, 5, ...RETURN_PERIODS, 50].forEach((T) => {
    levels[T] = mu + beta * reducedVariate(T)
  })

  return {
    source: `${GAUGE_RECORD.station}, ${GAUGE_RECORD.firstYear}–${GAUGE_RECORD.lastYear}`,
    levels,
    years: GAUGE_RECORD.years,
    firstYear: GAUGE_RECORD.firstYear,
    lastYear: GAUGE_RECORD.lastYear,
    meanAnnualMax: GAUGE_RECORD.meanAnnualPeak,
    mu,
    beta,
  }
}

const movingAverage = (values, window) => {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    let sum = 0
    let count = 0
    for (let k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k += 1) {
      sum += values[k]
      count += 1
    }
    return sum / count
  })
}

const metersPerDegLon = (latDeg) => 111320 * Math.cos((latDeg * Math.PI) / 180)

// Unit normal to the centreline, computed in local metres so the offset is a
// true distance rather than a constant angular step.
const normalAt = (lon, lat, i) => {
  const a = Math.max(0, i - 2)
  const b = Math.min(lon.length - 1, i + 2)
  const mx = metersPerDegLon(lat[i])
  const dx = (lon[b] - lon[a]) * mx
  const dy = (lat[b] - lat[a]) * METERS_PER_DEG_LAT
  const length = Math.hypot(dx, dy) || 1
  return { nx: -dy / length, ny: dx / length }
}

const offsetPoint = (lon, lat, normal, distanceM) => {
  const mx = metersPerDegLon(lat) || 1
  return [lon + (normal.nx * distanceM) / mx, lat + (normal.ny * distanceM) / METERS_PER_DEG_LAT]
}

/**
 * Corridor polygons for each requested return period, widest first so the
 * nesting reads correctly when they are stacked on the map.
 */
export const buildFloodZones = (meta, returnPeriods, activeYears = RETURN_PERIODS) => {
  if (!meta?.lon?.length || !returnPeriods) return null

  const { lon, lat, real_width_m: rawWidth } = meta
  const n = lon.length
  if (!rawWidth?.length) return null

  const channelWidth = movingAverage(rawWidth.slice(0, n), 25)
  const cellLengthM = ((meta.reach_km || 0) * 1000) / n

  const q = returnPeriods.levels
  const bankfull = q[BANKFULL_RETURN_PERIOD]

  // ~350 vertices per bank keeps the outline smooth without bloating the source.
  const step = Math.max(1, Math.round(n / 350))
  const indices = []
  for (let i = 0; i < n; i += step) indices.push(i)
  if (indices[indices.length - 1] !== n - 1) indices.push(n - 1)

  const years = [...activeYears].sort((a, b) => b - a)
  const features = []
  const summary = []

  years.forEach((T) => {
    if (!Number.isFinite(q[T])) return

    const ratio = Math.max(1, q[T] / (bankfull || 1))
    const widths = channelWidth.map((width) =>
      Math.min(width * ratio ** WIDTH_EXPONENT, width + 2 * MAX_SPREAD_M)
    )

    const smoothed = movingAverage(widths, 15)
    const leftBank = []
    const rightBank = []
    indices.forEach((i) => {
      const normal = normalAt(lon, lat, i)
      const half = smoothed[i] / 2
      leftBank.push(offsetPoint(lon[i], lat[i], normal, half))
      rightBank.push(offsetPoint(lon[i], lat[i], normal, -half))
    })

    const ring = [...leftBank, ...rightBank.reverse()]
    ring.push(ring[0])

    const stats = {
      years: T,
      dischargeM3s: q[T],
      minWidthM: Math.min(...smoothed),
      maxWidthM: Math.max(...smoothed),
      meanWidthM: smoothed.reduce((a, b) => a + b, 0) / n,
      areaKm2: smoothed.reduce((sum, w) => sum + w * cellLengthM, 0) / 1e6,
      color: ZONE_STYLES[T]?.color || '#c2372a',
    }

    features.push({
      type: 'Feature',
      properties: {
        returnPeriod: T,
        label: ZONE_STYLES[T]?.label || `${T}-year`,
        color: stats.color,
        meanWidthM: Math.round(stats.meanWidthM),
        dischargeM3s: Math.round(q[T]),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
    summary.push(stats)
  })

  if (!features.length) return null

  return {
    collection: { type: 'FeatureCollection', features },
    summary: summary.sort((a, b) => a.years - b.years),
    method: ZONE_METHOD,
    record: {
      years: returnPeriods.years,
      firstYear: returnPeriods.firstYear,
      lastYear: returnPeriods.lastYear,
      source: returnPeriods.source,
    },
  }
}
