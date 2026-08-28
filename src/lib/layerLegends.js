/** Color keys, shares/counts, and short provenance for MapViewsControl layers. */
export const LAYER_LEGENDS = {
  aqi: {
    provenance: 'Live',
    colors: [
      { color: '#1c8a55', label: 'Good', value: '0–50' },
      { color: '#b8860b', label: 'Moderate', value: '50–100' },
      { color: '#d2701a', label: 'Poor', value: '100–150' },
      { color: '#c2372a', label: 'Unhealthy', value: '150–200' },
      { color: '#6d28d9', label: 'Severe', value: '200–300' },
      { color: '#7f1d1d', label: 'Hazardous', value: '300+' },
    ],
  },
  chainage: {
    provenance: 'Model',
    colors: [
      { color: '#ffd166', label: 'Station / km mark', value: '100 m' },
      { color: '#ff7a18', label: 'Selected section', value: '1 km' },
    ],
  },
  erosion: {
    provenance: 'Estimated',
    colors: [
      { color: '#90ee90', label: 'No erosion', value: '83.1%' },
      { color: '#ffff00', label: 'Low erosion', value: '15.5%' },
      { color: '#ffa500', label: 'Moderate erosion', value: '1.4%' },
      { color: '#ff0000', label: 'High erosion', value: '0%' },
      { color: '#800000', label: 'Very high erosion', value: '0%' },
    ],
  },
  lithology: {
    provenance: 'Estimated',
    colors: [
      { color: '#00ffff', label: 'Water', value: '1.9%' },
      { color: '#8b0000', label: 'Basaltic / mafic', value: '16.4%' },
      { color: '#ff8c00', label: 'Weathered rock', value: '11.7%' },
      { color: '#ffd700', label: 'Alluvial / sedimentary', value: '8.2%' },
      { color: '#ff0000', label: 'Ferruginous / iron-rich', value: '10.3%' },
      { color: '#9370db', label: 'Clay-rich', value: '14.3%' },
      { color: '#708090', label: 'Silica-rich', value: '34.1%' },
      { color: '#a0522d', label: 'Mixed rock-soil', value: '3.0%' },
      { color: '#0066cc', label: 'River channel (cartographic blue)', value: 'annot.' },
    ],
  },
  tributaries: {
    provenance: 'Estimated',
    colors: [
      { color: '#12b5a8', label: 'Named streams', value: '7' },
      { color: '#5ad2f4', label: 'Joining feeders', value: '31' },
      { color: '#f4a261', label: 'Drains / nullahs', value: '4' },
      { color: '#3d8bfd', label: 'Canals', value: '7' },
      { color: '#8d99ae', label: 'Ditches', value: '7' },
    ],
  },
  mainstem: {
    provenance: 'Estimated',
    colors: [{ color: '#1d4e89', label: 'Main stem (Mula / Mutha)', value: '4' }],
  },
  tss: {
    provenance: 'Estimated',
    colors: [
      { color: '#2196F3', label: 'Low TSS', value: '≤0.62' },
      { color: '#FFC107', label: 'Medium', value: '0.62–1.17' },
      { color: '#F44336', label: 'High', value: '>1.17' },
    ],
  },
  ndci: {
    provenance: 'Estimated',
    colors: [
      { color: '#C8E6C9', label: 'Low chlorophyll', value: '<0' },
      { color: '#1B5E20', label: 'High chlorophyll', value: '≥0' },
    ],
  },
  ndwi: {
    provenance: 'Estimated',
    colors: [
      { color: '#8D6E63', label: 'Non-water', value: '≤0' },
      { color: '#0D47A1', label: 'Water', value: '>0' },
    ],
  },
  wst: {
    provenance: 'Estimated',
    colors: [
      { color: '#1565C0', label: 'Very low', value: '<27°C' },
      { color: '#64B5F6', label: 'Low', value: '27–30°C' },
      { color: '#FFD54F', label: 'Moderate', value: '30–33°C' },
      { color: '#E53935', label: 'High', value: '33–36°C' },
      { color: '#8E0000', label: 'Very high', value: '≥36°C' },
    ],
  },
  'ndsi-salinity': {
    provenance: 'Estimated',
    colors: [
      { color: '#0000FF', label: 'Very low', value: '-1.00 to -0.60' },
      { color: '#00BFFF', label: 'Low', value: '-0.60 to -0.20' },
      { color: '#00FF00', label: 'Moderate', value: '-0.20 to 0.20' },
      { color: '#FFFF00', label: 'High', value: '0.20 to 0.60' },
      { color: '#FF0000', label: 'Very high', value: '0.60 to 1.00' },
    ],
  },
  'wrd-floodlines': {
    provenance: 'Estimated',
    colors: [
      { color: '#1565c0', label: 'Blue flood line', value: 'survey' },
      { color: '#c62828', label: 'Red flood line', value: 'survey' },
      { color: '#2e7d32', label: 'Green bank line', value: 'survey' },
    ],
  },
  garbage: {
    provenance: 'Estimated',
    colors: [{ color: '#c45c26', label: 'Detected garbage site', value: '67' }],
  },
  'silt-class': {
    provenance: 'Estimated',
    colors: [
      { color: '#44ce1b', label: 'Low', value: '22.6%' },
      { color: '#cedd54', label: 'Moderate', value: '37.1%' },
      { color: '#f3b549', label: 'High', value: '23.5%' },
      { color: '#e51f1f', label: 'Very high', value: '16.8%' },
    ],
  },
  'lulc-2021': {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '17.6%' },
      { color: '#e6a23c', label: 'Crop land', value: '14.6%' },
      { color: '#a9a9a9', label: 'Barren land', value: '6.6%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.3%' },
      { color: '#c62828', label: 'Settlements', value: '57.8%' },
    ],
  },
  'lulc-2022': {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '17.3%' },
      { color: '#e6a23c', label: 'Crop land', value: '14.6%' },
      { color: '#a9a9a9', label: 'Barren land', value: '6.4%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.4%' },
      { color: '#c62828', label: 'Settlements', value: '58.3%' },
    ],
  },
  'lulc-2023': {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '16.2%' },
      { color: '#e6a23c', label: 'Crop land', value: '13.9%' },
      { color: '#a9a9a9', label: 'Barren land', value: '8.0%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.3%' },
      { color: '#c62828', label: 'Settlements', value: '58.6%' },
    ],
  },
  'lulc-2024': {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '14.2%' },
      { color: '#e6a23c', label: 'Crop land', value: '12.2%' },
      { color: '#a9a9a9', label: 'Barren land', value: '8.5%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.1%' },
      { color: '#c62828', label: 'Settlements', value: '61.9%' },
    ],
  },
  'lulc-2025': {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '16.6%' },
      { color: '#e6a23c', label: 'Crop land', value: '11.5%' },
      { color: '#a9a9a9', label: 'Barren land', value: '7.6%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.4%' },
      { color: '#c62828', label: 'Settlements', value: '60.9%' },
    ],
  },
  'lulc-2026': {
    provenance: 'Estimated',
    colors: [
      { color: '#2196f3', label: 'Water bodies', value: '2.7%' },
      { color: '#c62828', label: 'Settlements', value: '7.3%' },
      { color: '#006400', label: 'Forest/dense Vegetation', value: '40.1%' },
      { color: '#f4c430', label: 'Cropland', value: '21.2%' },
      { color: '#8d6e63', label: 'Barren land', value: '28.8%' },
    ],
  },
  // Alias kept for any leftover id references; mirrors 2025.
  lulc: {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Forest', value: '16.6%' },
      { color: '#e6a23c', label: 'Crop land', value: '11.5%' },
      { color: '#a9a9a9', label: 'Barren land', value: '7.6%' },
      { color: '#2196f3', label: 'Water bodies', value: '3.4%' },
      { color: '#c62828', label: 'Settlements', value: '60.9%' },
    ],
  },
  'silt-volume': {
    provenance: 'Estimated',
    colors: [
      { color: '#f7fbff', label: 'Low volume', value: '0' },
      { color: '#6baed6', label: 'Mid', value: '—' },
      { color: '#08306b', label: 'High volume', value: '94' },
    ],
  },
  'urban-veg': {
    provenance: 'Estimated',
    colors: [
      { color: '#d9f0a3', label: 'Sparse', value: '56%' },
      { color: '#78c679', label: 'Moderate', value: '21.8%' },
      { color: '#31a354', label: 'Dense', value: '20.7%' },
      { color: '#006837', label: 'Very dense', value: '1.5%' },
    ],
  },
  type: {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Trees', value: '60.3%' },
      { color: '#8B4513', label: 'Shrub / scrub', value: '13.3%' },
      { color: '#7CFC00', label: 'Grass / herbaceous', value: '25.3%' },
      { color: '#800080', label: 'Mixed / diverse', value: '1.0%' },
    ],
  },
  health: {
    provenance: 'Estimated',
    colors: [
      { color: '#006400', label: 'Very healthy', value: '51.5%' },
      { color: '#32CD32', label: 'Healthy', value: '19.9%' },
      { color: '#FFFF00', label: 'Moderate', value: '13.2%' },
      { color: '#FF8C00', label: 'Poor', value: '9.5%' },
      { color: '#FF0000', label: 'Critical', value: '6.0%' },
    ],
  },
  'flood-heat': {
    provenance: 'Estimated',
    colors: [{ color: '#c2372a', label: 'Flood water', value: 'heat' }],
  },
  'water-heat': {
    provenance: 'Estimated',
    colors: [{ color: '#2f9bd6', label: 'Surface water', value: 'heat' }],
  },
  depth: {
    provenance: 'Estimated',
    colors: [
      { color: '#0000ff', label: 'Shallow 1.5–1.6 m', value: '0.9%' },
      { color: '#00ff00', label: 'Low 1.6–1.7 m', value: '16%' },
      { color: '#ffff00', label: 'Moderate 1.7–1.8 m', value: '57.8%' },
      { color: '#ff8000', label: 'High 1.8–1.9 m', value: '20.4%' },
      { color: '#ff0000', label: 'Very high 1.9–2.0 m', value: '4.9%' },
    ],
  },
  bathymetry: {
    provenance: 'Estimated',
    colors: [
      { color: '#0000ff', label: 'Shallow 1.5–1.6 m', value: '0.9%' },
      { color: '#00ff00', label: 'Low 1.6–1.7 m', value: '16%' },
      { color: '#ffff00', label: 'Moderate 1.7–1.8 m', value: '57.8%' },
      { color: '#ff8000', label: 'High 1.8–1.9 m', value: '20.4%' },
      { color: '#ff0000', label: 'Very high 1.9–2.0 m', value: '4.9%' },
    ],
  },
}

export const legendForLayer = (layerId) => LAYER_LEGENDS[layerId] || null

export const lulcLegendId = (year) => (year ? `lulc-${year}` : 'lulc')
