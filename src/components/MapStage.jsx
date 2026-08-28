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
 */
const MapStage = ({ children }) => {
  const [leftNode, setLeftNode] = useState(null)
  const [rightNode, setRightNode] = useState(null)
  const [footerNode, setFooterNode] = useState(null)
  const bodyRef = useRef(null)
  const stageRef = useRef(null)

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
    body.style.setProperty('--map-stage-left-width', leftWidth)
    body.style.setProperty('--map-stage-right-width', rightWidth)

    if (stage) {
      stage.classList.toggle('has-left-sidebar', leftWidth !== '0px')
      stage.classList.toggle('has-left-sidebar-detail', leftWidth === LEFT_DETAIL_WIDTH)
      stage.classList.toggle('has-right-sidebar', rightWidth !== '0px')
    }

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('map-stage-layout-change'))
    })
  }, [leftNode, rightNode])

  useLayoutEffect(() => {
    syncGridColumns()
  }, [syncGridColumns])

  useEffect(() => {
    syncGridColumns()

    const onLayoutChange = () => syncGridColumns()
    window.addEventListener('map-stage-layout-change', onLayoutChange)

    const observer = new MutationObserver(onLayoutChange)
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    }
    if (leftNode) observer.observe(leftNode, observerConfig)
    if (rightNode) observer.observe(rightNode, observerConfig)

    return () => {
      window.removeEventListener('map-stage-layout-change', onLayoutChange)
      observer.disconnect()
      if (bodyRef.current) {
        bodyRef.current.style.removeProperty('--map-stage-left-width')
        bodyRef.current.style.removeProperty('--map-stage-right-width')
      }
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
