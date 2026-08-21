import React, { useEffect, useMemo, useState } from 'react'
import './ChainageLayerCard.css'
import { binBoundsForChainage, formatChainage } from '../lib/chainageBins'

const ChainageLayerCard = ({ inputId = 'layer-chainage', focusChainage = null }) => {
  const [open, setOpen] = useState(false)
  const selection = useMemo(() => {
    if (!focusChainage) return null
    const bin = binBoundsForChainage(focusChainage.chainage_m)
    if (!bin) return null
    return {
      bin,
      station: focusChainage.name || formatChainage(focusChainage.chainage_m),
      lng: focusChainage.lng,
      lat: focusChainage.lat,
    }
  }, [focusChainage])

  useEffect(() => {
    if (selection) setOpen(true)
  }, [selection?.bin?.name, selection?.station])

  return (
    <div className={`chainage-layer-card${open ? ' is-open' : ''}`}>
      <div className="chainage-layer-head">
        <span className="chainage-layer-check-text">Chainage</span>
        <button
          type="button"
          className="chainage-layer-info"
          aria-expanded={open}
          aria-controls={`${inputId}-info-body`}
          onClick={() => setOpen((current) => !current)}
        >
          Info
          <span className="chainage-layer-caret" aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div className="chainage-layer-body" id={`${inputId}-info-body`}>
          <small>
            {selection
              ? `Selected section ${selection.bin.name}`
              : 'Centreline stations every 100 m · 0+000 to 16+400'}
          </small>
          {selection ? (
            <div className="chainage-layer-stats">
              <span>
                <em>Section</em>
                {selection.bin.name}
              </span>
              <span>
                <em>Station</em>
                {selection.station}
              </span>
              <span>
                <em>Length</em>
                {(selection.bin.length_m / 1000).toFixed(1)} km
              </span>
              {Number.isFinite(selection.lng) ? (
                <span>
                  <em>Location</em>
                  {selection.lat.toFixed(4)}, {selection.lng.toFixed(4)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="chainage-layer-hint">
              Click a yellow kilometre box, a station, or the scale to see that section here.
            </p>
          )}
          <span>
            <i style={{ background: '#ffd166' }} />
            km boxes and 100 m ticks
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default ChainageLayerCard
