import React from 'react'

/** Title row with a real checkbox that turns a map layer on/off. */
export const LayerCheckTitle = ({ id, checked, onChange, title, subtitle }) => (
  <div className="tss-map-legend-title">
    <label className="wq-layer-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="wq-layer-check-text">{title}</span>
    </label>
    {subtitle ? <small>{subtitle}</small> : null}
  </div>
)
