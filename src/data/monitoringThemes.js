/** Shared nine monitoring themes — landing page and signed-in hub.
 *
 *  Each theme lists which shipped datasets open with it. Themes with an empty
 *  `datasets` array are scope cards only (map lands with no thematic layer).
 *
 *  Salinity intrusion and Water quality share the same water-quality map view;
 *  WST (thermal) sits with TSS / NDCI / NDWI / BOD–COD there.
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
    desc: 'Lithology, fault lines, bank erosion, mining subsidence',
    to: '/dashboard',
    datasets: [],
  },
  {
    name: 'Biodiversity',
    desc: 'Forest & mangrove health, habitat corridors, fish habitat proxies',
    to: '/dashboard',
    datasets: [],
  },
  {
    name: 'Soil & land use',
    desc: 'LULC change, Khazan salinity, crop monitoring, urban sprawl',
    to: '/dashboard',
    datasets: [],
  },
  {
    name: 'Salinity intrusion',
    desc: 'Salt-wedge tracking up to Ganjem via thermal & radar proxies',
    to: '/dashboard?view=waterquality',
    datasets: ['wst', 'tss', 'ndci', 'ndwi', 'bodcod'],
  },
  {
    name: 'Water quality',
    desc: 'TSS, NDCI, NDWI and WST class maps, plus BOD–COD demo',
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
    desc: 'Sea-level rise, rainfall trends, drought and flood frequency',
    to: '/dashboard?view=flood',
    datasets: ['twin'],
  },
  {
    name: 'Socio-economic',
    desc: 'Night-lights, fishing activity, tourism footprint, sand mining',
    to: '/dashboard',
    datasets: [],
  },
]
