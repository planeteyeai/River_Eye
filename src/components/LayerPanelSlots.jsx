import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const LayerPanelSlotContext = createContext(null)

const slotKey = (viewId, layerId) => (layerId ? `${viewId}::${layerId}` : viewId)

/**
 * Lets the theme overlays render their legend/detail card inside the matching
 * group (or layer row) of the Layers panel instead of floating over the map.
 */
export const LayerPanelSlotProvider = ({ children }) => {
  const [slots, setSlots] = useState({})

  const registerSlot = useCallback((key, element) => {
    setSlots((current) => {
      if (element) {
        if (current[key] === element) return current
        return { ...current, [key]: element }
      }
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const value = useMemo(() => ({ slots, registerSlot }), [slots, registerSlot])

  return (
    <LayerPanelSlotContext.Provider value={value}>
      {children}
    </LayerPanelSlotContext.Provider>
  )
}

export const LayerPanelSlot = ({
  viewId,
  layerId = null,
  className = 'map-views-extra',
}) => {
  const context = useContext(LayerPanelSlotContext)
  const registerSlot = context?.registerSlot
  const key = slotKey(viewId, layerId)
  const attach = useCallback(
    (element) => {
      registerSlot?.(key, element)
    },
    [registerSlot, key],
  )

  if (!registerSlot) return null
  return <div className={className} ref={attach} />
}

export const LayerPanelPortal = ({ viewId, layerId = null, children }) => {
  const context = useContext(LayerPanelSlotContext)
  const target = context?.slots?.[slotKey(viewId, layerId)]
  if (!target) return null
  return createPortal(children, target)
}
