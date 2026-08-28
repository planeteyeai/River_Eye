/** Mula–Mutha study envelope (WQ rasters, twin corridor). */
export const MULA_MUTHA_BOUNDS = [
  [73.85023001288063, 18.509966092339564],
  [73.99602658349323, 18.561529389648026],
]

/** Padding for fitBounds when sidebars/footer are open. */
export const getMapStagePadding = () => {
  const leftEl = document.querySelector('.map-stage-left')
  const rightEl = document.querySelector('.map-stage-right')
  const footer = document.querySelector('.map-stage-footer:not(:empty)')
  const footerH = footer?.offsetHeight || 0

  return {
    top: 56,
    bottom: 72 + footerH,
    left: (leftEl?.offsetWidth || 0) + 20,
    right: (rightEl?.offsetWidth || 0) + 20,
  }
}
