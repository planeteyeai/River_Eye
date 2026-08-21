/** Shared nine monitoring themes — landing page and signed-in hub.
 *
 *  Each theme lists which shipped datasets open with it. Themes with an empty
 *  `datasets` array are scope cards only (map lands with no thematic layer).
 *
 *  Salinity intrusion and Water quality share the same water-quality map view;
 *  WST (thermal) sits with TSS / NDCI / NDWI / BOD–COD there. Soil & land use
 *  opens the urban vegetation classification and the monthly silt rasters. Biodiversity opens the
 *  vegetation-type raster from the KMZ overlay. Climate impact opens the
 *  flood / surface-water heatmap from flood_water_timeseries.xlsx. Geology
 *  opens joining streams and the 2016–2026 bank-erosion hotspot overlay
 *  on the map, plus the satellite-derived bathymetry dashboard.
 */

export const MONITORING_THEMES = [
  {
    name: 'Hydrology',
    desc: 'Rainfall, river stage, discharge, soil moisture, flood extent',
    to: '/dashboard?view=flood',
    datasets: ['twin'],
  },
  {
    name: 'Geology',
    desc: 'Spectral lithology, bank erosion hotspots, joining streams, and satellite-derived bathymetry',
    to: '/dashboard?view=geology',
    datasets: ['lithology', 'erosion', 'tributaries', 'bathymetry'],
  },
  {
    name: 'Biodiversity',
    desc: 'Vegetation type and health — trees, shrub, grass and score bands',
    to: '/dashboard?view=biodiversity',
    datasets: ['biodiversity'],
  },
  {
    name: 'Soil & land use',
    desc: 'LULC 2021–2026, river silt class and volume, plus urban vegetation',
    to: '/dashboard?view=landuse',
    datasets: ['lulc', 'silt', 'urbanveg'],
  },
  {
    name: 'Salinity intrusion',
    desc: 'Salt-wedge tracking up to Ganjem via thermal & radar proxies',
    to: '/dashboard?view=waterquality',
    datasets: ['wst', 'tss', 'ndci', 'ndwi', 'bodcod'],
  },
  {
    name: 'Water quality',
    desc: 'TSS, NDCI, NDWI and WST July overlays, plus BOD–COD demo',
    to: '/dashboard?view=waterquality',
    datasets: ['tss', 'ndci', 'ndwi', 'wst', 'bodcod'],
  },
  {
    name: 'Pollution',
    desc: 'Mining runoff, sewage plumes, oil spills, solid-waste dumping',
    to: '/dashboard',
    datasets: [],
  },
  {
    name: 'Climate impact',
    desc: 'Flood and surface-water heatmap across seven 2026 image pairs',
    to: '/dashboard?view=climate',
    datasets: ['floodwater'],
  },
  {
    name: 'Socio-economic',
    desc: 'Night-lights, fishing activity, tourism footprint, sand mining',
    to: '/dashboard',
    datasets: [],
  },
]
