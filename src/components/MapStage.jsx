import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const MapStageSlotsContext = createContext(null)

export const useMapStageSlots = () => useContext(MapStageSlotsContext)

export const useMapStageFooter = () => useContext(MapStageSlotsContext)?.footerNode

export const useMapStageLeft = () => useContext(MapStageSlotsContext)?.leftNode

export const useMapStageRight = () => useContext(MapStageSlotsContext)?.rightNode

const LEFT_RAIL_WIDTH = '52px'
const LEFT_DETAIL_WIDTH = 'min(320px, 38vw)'
const RIGHT_PANEL_WIDTH = 'min(280px, 34vw)'

/**
 * Map stage: left sidebar · map · right sidebar, with an optional footer row.
 * Portaled panels shrink the map instead of covering it.
 * Layer category icons float on the map (MapViewsControl); left column is
 * reserved for future docked panels.
 */
const MapStage = ({ children }) => {
  const [leftNode, setLeftNode] = useState(null)
  const [rightNode, setRightNode] = useState(null)
  const [footerNode, setFooterNode] = useState(null)
  const bodyRef = useRef(null)
  const stageRef = useRef(null)
  const lastColumnsRef = useRef({ left: null, right: null })

  const syncGridColumns = useCallback(() => {
    const body = bodyRef.current
    const stage = stageRef.current
    if (!body) return

    let leftWidth = '0px'
    if (leftNode?.childElementCount > 0) {
      const hasDetail = leftNode.querySelector('.map-views-sidebar.has-detail')
      leftWidth = hasDetail ? LEFT_DETAIL_WIDTH : LEFT_RAIL_WIDTH
    }

    const rightWidth = rightNode?.childElementCount > 0 ? RIGHT_PANEL_WIDTH : '0px'

    const prev = lastColumnsRef.current
    const changed = prev.left !== leftWidth || prev.right !== rightWidth
    if (!changed) return

    lastColumnsRef.current = { left: leftWidth, right: rightWidth }
    body.style.setProperty('--map-stage-left-width', leftWidth)
    body.style.setProperty('--map-stage-right-width', rightWidth)

    if (stage) {
      stage.classList.toggle('has-left-sidebar', leftWidth !== '0px')
      stage.classList.toggle('has-left-sidebar-detail', leftWidth === LEFT_DETAIL_WIDTH)
      stage.classList.toggle('has-right-sidebar', rightWidth !== '0px')
    }

    // After layout paints, ask the map to resize once (avoids mid-frame white clear).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('map-stage-layout-change'))
      })
    })
  }, [leftNode, rightNode])

  useLayoutEffect(() => {
    syncGridColumns()
  }, [syncGridColumns])

  useEffect(() => {
    syncGridColumns()

    // Only watch structural / class changes that can open or close sidebars.
    // Do not re-enter via map-stage-layout-change (that caused a resize loop).
    const observer = new MutationObserver(() => {
      syncGridColumns()
    })
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    }
    if (leftNode) observer.observe(leftNode, observerConfig)
    if (rightNode) observer.observe(rightNode, observerConfig)

    return () => {
      observer.disconnect()
      if (bodyRef.current) {
        bodyRef.current.style.removeProperty('--map-stage-left-width')
        bodyRef.current.style.removeProperty('--map-stage-right-width')
      }
      lastColumnsRef.current = { left: null, right: null }
    }
  }, [leftNode, rightNode, syncGridColumns])

  const slots = useMemo(
    () => ({ leftNode, rightNode, footerNode }),
    [leftNode, rightNode, footerNode],
  )

  return (
    <MapStageSlotsContext.Provider value={slots}>
      <div className="map-stage" ref={stageRef}>
        <div className="map-stage-body" ref={bodyRef}>
          <div className="map-stage-left" ref={setLeftNode} />
          <div className="map-stage-map">
            {children}
          </div>
          <div className="map-stage-right" ref={setRightNode} />
        </div>
        <div className="map-stage-footer" ref={setFooterNode} />
      </div>
    </MapStageSlotsContext.Provider>
  )
}

export default MapStage
