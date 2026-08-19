import React, { useState } from 'react'
import './ChainageLayerCard.css'

const ChainageLayerCard = ({ checked = false, onToggle, inputId = 'layer-chainage' }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className={`chainage-layer-card${checked ? '' : ' is-off'}${open ? ' is-open' : ''}`}>
      <div className="chainage-layer-head">
        <label className="chainage-layer-check" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(checked)}
            onChange={(event) => onToggle?.(event.target.checked)}
          />
          <span className="chainage-layer-check-text">Chainage</span>
        </label>
        <button
          type="button"
          className="chainage-layer-info"
          aria-expanded={open}
          aria-controls="chainage-layer-info-body"
          onClick={() => setOpen((current) => !current)}
        >
          Info
          <span className="chainage-layer-caret" aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div className="chainage-layer-body" id="chainage-layer-info-body">
          <small>Centreline stations every 100 m · 0+000 to 16+400</small>
          <span>
            <i style={{ background: '#ffd166' }} />
            km marks and 100 m ticks
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default ChainageLayerCard
