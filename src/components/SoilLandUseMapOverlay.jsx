import React, { useEffect, useState } from 'react'
import './SoilLandUseMapOverlay.css'
import { fetchAssetJson } from '../lib/fetchAssetJson'
import { LayerPanelPortal } from './LayerPanelSlots'

const URBAN_VEG_URL = '/asset/mula-mutha-urban-vegetation.json'
const SILT_URL = '/asset/mula-mutha-silt.json'
const LULC_URL = '/asset/mula-mutha-lulc.json'

const ClassRows = ({ heading, layer }) => (
  <div className="lulc-group">
    <div className="lulc-group-head">
      <span>{heading}</span>
      <em>
        {layer.total_area_ha != null
          ? `${layer.total_area_ha} ha`
          : layer.feature_count != null
            ? `${layer.feature_count} patches`
            : null}
      </em>
    </div>
    {layer.classes.map((row) => (
      <div className="lulc-class" key={`${layer.id}-${row.class}`}>
        <div className="lulc-class-meta">
          <span className="lulc-sw" style={{ background: row.color }} />
          <span className="lulc-label">{row.label}</span>
          <span className="lulc-val">
            {row.area_ha != null
              ? `${row.area_ha} ha`
              : row.polygons != null
                ? `${row.polygons}`
                : ''}
          </span>
          <strong className="lulc-pct">{row.share_pct}%</strong>
        </div>
        <div className="lulc-track">
          <div
            className="lulc-fill"
            style={{ width: `${row.share_pct}%`, background: row.color }}
          />
        </div>
      </div>
    ))}
  </div>
)

/** Soil & land use detail — rendered inside the Land use group of the Layers panel. */
const SoilLandUseMapOverlay = ({
  showExtentLayer = false,
  showSiltClassLayer = false,
  showSiltVolumeLayer = false,
  siltPeriodId = 5,
  onSiltPeriodChange,
  showLulcLayer = false,
  lulcPeriodId = 4,
  onLulcPeriodChange,
}) => {
  const [doc, setDoc] = useState(null)
  const [silt, setSilt] = useState(null)
  const [lulc, setLulc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [openInfoId, setOpenInfoId] = useState('lulc')

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(URBAN_VEG_URL, 'Urban vegetation')
      .then((json) => !cancelled && setDoc(json))
      .catch((error) => {
        console.error('Failed to load urban vegetation classes', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(SILT_URL, 'Silt classification')
      .then((json) => !cancelled && setSilt(json))
      .catch((error) => {
        console.error('Failed to load silt classification', error)
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAssetJson(LULC_URL, 'LULC')
      .then((json) => !cancelled && setLulc(json))
      .catch((error) => {
        console.error('Failed to load LULC', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const siltOn = showSiltClassLayer || showSiltVolumeLayer
  const typeLayer = doc?.layers?.find((layer) => layer.id === 'type')
  const healthLayer = doc?.layers?.find((layer) => layer.id === 'health')
  const infoRows = showExtentLayer
    ? [
        { id: 'type', title: 'Vegetation type', layer: typeLayer, heading: 'Vegetation type' },
        { id: 'health', title: 'Vegetation health', layer: healthLayer, heading: 'Vegetation health' },
      ]
    : []

  const periods = silt?.periods || []
  const active = periods.find((row) => row.id === siltPeriodId) || periods[0]
  const classLayer = active?.classification
    ? {
        id: 'silt',
        total_area_ha: active.classification.total_area_ha,
        classes: active.classification.classes,
      }
    : null
  const maxVeryHigh = Math.max(...periods.map((row) => (
    row.classification?.classes?.find((cls) => cls.class === 4)?.share_pct || 0
  )), 1)

  const lulcPeriods = lulc?.periods || []
  const activeLulc = lulcPeriods.find((row) => row.id === lulcPeriodId) || lulcPeriods[0]
  const lulcClassLayer = activeLulc
    ? {
        id: `lulc-${activeLulc.year}`,
        total_area_ha: activeLulc.total_area_ha,
        feature_count: activeLulc.feature_count,
        classes: activeLulc.classes || [],
      }
    : null
  const forestShareOf = (row) =>
    row.classes?.find((cls) => /forest/i.test(cls.label))?.share_pct || 0
  const settleShareOf = (row) =>
    row.classes?.find((cls) => /settlement/i.test(cls.label))?.share_pct || 0
  const maxForest = Math.max(...lulcPeriods.map(forestShareOf), 1)
  const maxSettle = Math.max(...lulcPeriods.map(settleShareOf), 1)

  const toggleInfo = (id) => {
    setOpenInfoId((current) => (current === id ? null : id))
  }

  const showGroupDetail = siltOn || showExtentLayer

  return (
    <>
      <LayerPanelPortal viewId="landuse" layerId="lulc">
        {showLulcLayer && activeLulc && lulcClassLayer ? (
          <div className="lulc-embed panel-embed" aria-label="LULC year timeseries">
            <div className="lulc-series-block">
              <div className="lulc-period-head">
                <strong>
                  {activeLulc.label}
                  {activeLulc.kind === 'polygons'
                    ? ` · ${activeLulc.feature_count} patches`
                    : activeLulc.total_area_ha != null
                      ? ` · ${activeLulc.total_area_ha} ha`
                      : ''}
                </strong>
                <span className="lulc-year-tag">{activeLulc.year}</span>
              </div>
              <div className="lulc-stats">
                <span>
                  <em>Forest</em>
                  {forestShareOf(activeLulc)}%
                </span>
                <span>
                  <em>Settlements</em>
                  {settleShareOf(activeLulc)}%
                </span>
              </div>
              <div className="lulc-year-bars" role="tablist" aria-label="LULC year timeseries">
                {lulcPeriods.map((row) => {
                  const selected = row.id === activeLulc.id
                  const forestShare = forestShareOf(row)
                  const settleShare = settleShareOf(row)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`lulc-year-bar${selected ? ' is-on' : ''}`}
                      onClick={() => onLulcPeriodChange?.(row.id)}
                      title={`${row.year} · forest ${forestShare}% · settlements ${settleShare}%`}
                    >
                      <span
                        className="lulc-year-bar-forest"
                        style={{ height: `${Math.max(6, (forestShare / maxForest) * 100)}%` }}
                      />
                      <span
                        className="lulc-year-bar-settle"
                        style={{ height: `${Math.max(4, (settleShare / maxSettle) * 100)}%` }}
                      />
                      <em>{row.year}</em>
                    </button>
                  )
                })}
              </div>
              <div className="lulc-bar-caption">
                Tap a year to change the map · green = forest / class 2, red = settlements / class 4
              </div>
            </div>
          </div>
        ) : null}
      </LayerPanelPortal>

      {showGroupDetail ? (
        <LayerPanelPortal viewId="landuse">
          <div className="lulc-embed panel-embed" aria-label="Soil and land use detail">
            {siltOn && loadError ? (
              <p className="lulc-note">Silt rasters did not load. {loadError}</p>
            ) : null}

            {siltOn && active && classLayer ? (
              <>
                <div className="lulc-period-head">
                  <strong>{active.label}</strong>
                  <span>{classLayer.total_area_ha} ha classed</span>
                </div>
                <div className="lulc-months" role="tablist" aria-label="Silt month">
                  {periods.map((row) => {
                    const veryHigh = row.classification?.classes?.find((cls) => cls.class === 4)?.share_pct || 0
                    const selected = row.id === active.id
                    return (
                      <button
                        key={row.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={`lulc-month${selected ? ' is-on' : ''}`}
                        onClick={() => onSiltPeriodChange?.(row.id)}
                        title={`${row.label} · very high ${veryHigh}%`}
                      >
                        <span
                          className="lulc-month-bar"
                          style={{ height: `${Math.max(8, (veryHigh / maxVeryHigh) * 100)}%` }}
                        />
                        <em>{row.label.slice(0, 3)}</em>
                      </button>
                    )
                  })}
                </div>
                <div className={`lulc-info-drop${openInfoId === 'silt' ? ' is-open' : ''}`}>
                  <div className="lulc-info-head">
                    <span className="lulc-check-text">Silt classes</span>
                    <button
                      type="button"
                      className="lulc-info-toggle"
                      aria-expanded={openInfoId === 'silt'}
                      onClick={() => toggleInfo('silt')}
                    >
                      Info
                      <span className="lulc-info-caret" aria-hidden="true" />
                    </button>
                  </div>
                  {openInfoId === 'silt' ? (
                    <div className="lulc-info-body">
                      <ClassRows heading="Relative silt class" layer={classLayer} />
                      {showSiltVolumeLayer ? (
                        <div className="lulc-volume-scale">
                          <span>0</span>
                          <span className="lulc-volume-bar" />
                          <span>{active.volume?.scale_max}</span>
                          <em>volume scale shared Jan-Jul · unit unconfirmed</em>
                        </div>
                      ) : null}
                      {silt.csv ? (
                        <p className="lulc-note">
                          Workbook window {silt.csv.start_date} to {silt.csv.end_date}:
                          water {silt.csv.water_area_ha} ha, mean score {silt.csv.mean_silt_score}.
                          Those areas are one composite, not the month on the map.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {infoRows.map((row) => {
              if (!row.layer) return null
              const isOpen = openInfoId === row.id
              return (
                <div
                  key={row.id}
                  className={`lulc-info-drop${isOpen ? ' is-open' : ''}`}
                >
                  <div className="lulc-info-head">
                    <span className="lulc-check-text">{row.title}</span>
                    <button
                      type="button"
                      className="lulc-info-toggle"
                      aria-expanded={isOpen}
                      aria-controls={`lulc-urban-info-${row.id}`}
                      onClick={() => toggleInfo(row.id)}
                    >
                      Info
                      <span className="lulc-info-caret" aria-hidden="true" />
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="lulc-info-body" id={`lulc-urban-info-${row.id}`}>
                      <ClassRows heading={row.heading} layer={row.layer} />
                    </div>
                  ) : null}
                </div>
              )
            })}
            <p className="lulc-prov">Estimated · classed LULC + silt product</p>
          </div>
        </LayerPanelPortal>
      ) : null}
    </>
  )
}

export default SoilLandUseMapOverlay
