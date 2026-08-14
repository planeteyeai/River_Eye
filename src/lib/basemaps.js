export const EMPTY_MAP_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openstreetmap.us/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f5f5f5' },
    },
  ],
}

export const BASEMAPS = [
  {
    id: 'google-3d',
    label: 'Google 3D Map',
    group: '3D',
    description: 'Satellite draped on live 3D terrain',
    tiles: [
      'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    ],
    attribution: '© Google · DEM AWS Terrarium',
    maxzoom: 20,
    mode3d: true,
    preview: 'linear-gradient(160deg,#0b1a12 0%,#1a4a2e 35%,#c4a35a 70%,#67e8f9 100%)',
  },
  {
    id: 'esri-3d',
    label: 'Esri 3D Map',
    group: '3D',
    description: 'World imagery on 3D elevation mesh',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    overlayTiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Esri, Maxar · DEM AWS Terrarium',
    overlayAttribution: 'Esri Reference',
    maxzoom: 19,
    mode3d: true,
    preview: 'linear-gradient(160deg,#142018 0%,#3d5a32 40%,#dde6ee 75%,#fbbf24 100%)',
  },
  {
    id: 'google-satellite',
    label: 'Google Satellite',
    group: 'Google',
    description: 'True top-down satellite imagery',
    tiles: [
      'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    ],
    attribution: '© Google',
    maxzoom: 20,
    topDown: true,
    preview: 'linear-gradient(135deg,#1a3a2a,#3d6b4f 40%,#8fbc8f)',
  },
  {
    id: 'google-hybrid',
    label: 'Google Hybrid',
    group: 'Google',
    description: 'Satellite + road labels',
    tiles: [
      'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    ],
    attribution: '© Google',
    maxzoom: 20,
    topDown: true,
    preview: 'linear-gradient(135deg,#1a3320,#2f5d40 50%,#c4a35a)',
  },
  {
    id: 'google-roadmap',
    label: 'Google Roads',
    group: 'Google',
    description: 'Classic Google street map',
    tiles: [
      'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    ],
    attribution: '© Google',
    maxzoom: 20,
    preview: 'linear-gradient(135deg,#e8eef5,#b8c9dc 45%,#7aa0c4)',
  },
  {
    id: 'google-terrain',
    label: 'Google Terrain',
    group: 'Google',
    description: 'Terrain relief with roads',
    tiles: [
      'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    ],
    attribution: '© Google',
    maxzoom: 15,
    preview: 'linear-gradient(135deg,#d5e8c8,#8fbc8f 40%,#c4a574)',
  },
  {
    id: 'esri-satellite',
    label: 'Esri Imagery',
    group: 'Esri',
    description: 'World imagery basemap',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
    topDown: true,
    preview: 'linear-gradient(135deg,#1c2e1c,#4a6b3a 50%,#9aaa7a)',
  },
  {
    id: 'carto-light',
    label: 'Positron Light',
    group: 'Street',
    description: 'Minimal light canvas',
    tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
    attribution: '© CARTO © OSM',
    maxzoom: 20,
    preview: 'linear-gradient(135deg,#ffffff,#e8eef5 50%,#c5d0de)',
  },
]

export const DEFAULT_BASEMAP = 'google-satellite'

export const BASEMAP_MAP = Object.fromEntries(BASEMAPS.map((b) => [b.id, b]))

export const BASEMAP_GROUPS = ['3D', 'Google', 'Esri', 'Street']
