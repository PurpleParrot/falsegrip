import { useMemo, useState } from 'react'
import { fmtDateShort, fmtNum } from '../format'
import { t } from '../i18n'
import type { Series } from '../stats'

const COLORS: Record<string, string> = { B: 'var(--accent)', L: 'var(--accent)', R: 'var(--accent-2)' }

/** Simple, gently animated SVG line chart. Tap to inspect a point. */
export function LineChart({ series, unit, height = 200 }: { series: Series[]; unit: string; height?: number }) {
  const W = 340
  const H = height
  const pad = { l: 36, r: 12, t: 14, b: 22 }
  const all = series.flatMap((s) => s.points)
  const [sel, setSel] = useState<{ k: number; i: number } | null>(null)
  const colorOf = (s: Series) => s.color ?? COLORS[s.side]
  const labelled = series.some((s) => s.label)

  const geo = useMemo(() => {
    if (!all.length) return null
    const ts = all.map((p) => p.t)
    const ys = all.map((p) => p.y)
    let t0 = Math.min(...ts)
    let t1 = Math.max(...ts)
    if (t0 === t1) {
      t0 -= 86400000
      t1 += 86400000
    }
    let y0 = Math.min(...ys)
    let y1 = Math.max(...ys)
    if (y1 - y0 < 1e-9) {
      const d = Math.max(1, Math.abs(y1) * 0.25)
      y0 = Math.max(0, y0 - d)
      y1 = y1 + d
    } else {
      const span = y1 - y0
      y0 = Math.max(0, y0 - span * 0.15)
      y1 = y1 + span * 0.15
    }
    const x = (tt: number) => pad.l + ((tt - t0) / (t1 - t0)) * (W - pad.l - pad.r)
    const y = (yy: number) => pad.t + (1 - (yy - y0) / (y1 - y0)) * (H - pad.t - pad.b)
    return { t0, t1, y0, y1, x, y }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(all), H])

  if (!geo) return <p className="muted center pad">{t('stats.noData')}</p>

  const selS = sel ? series[sel.k] : undefined
  const selected = selS && sel ? selS.points[sel.i] : null
  const gridYs = [0, 0.5, 1].map((f) => geo.y0 + f * (geo.y1 - geo.y0))

  return (
    <div className="chart">
      <div className="chart-readout">
        {selected ? (
          <>
            <strong>
              {fmtNum(selected.y, 1)} {unit}
            </strong>
            <span className="muted"> · {fmtDateShort(selected.t)}</span>
            {series.length > 1 && (
              <span className="muted"> · {selS!.label ?? (selS!.side === 'L' ? t('stats.left') : t('stats.right'))}</span>
            )}
          </>
        ) : labelled ? (
          <span className="muted small">{t('stats.tapHint')}</span>
        ) : series.length > 1 ? (
          <span className="legend">
            <i style={{ background: COLORS.L }} /> {t('stats.left')} <i style={{ background: COLORS.R }} /> {t('stats.right')}
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onClick={() => setSel(null)}>
        {gridYs.map((gy, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={geo.y(gy)} y2={geo.y(gy)} className="grid" />
            <text x={pad.l - 6} y={geo.y(gy) + 4} className="axis" textAnchor="end">
              {fmtNum(gy, geo.y1 - geo.y0 < 6 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 4} className="axis">
          {fmtDateShort(geo.t0)}
        </text>
        <text x={W - pad.r} y={H - 4} className="axis" textAnchor="end">
          {fmtDateShort(geo.t1)}
        </text>
        {series.map((s, k) => {
          if (!s.points.length) return null
          const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(p.t).toFixed(1)},${geo.y(p.y).toFixed(1)}`).join(' ')
          return (
            <g key={(s.key ?? s.side) + d.length}>
              <path d={d} className="line" pathLength={1} style={{ stroke: colorOf(s) }} />
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={geo.x(p.t)}
                  cy={geo.y(p.y)}
                  r={sel?.k === k && sel.i === i ? 6 : 3.5}
                  className="dot"
                  style={{ fill: colorOf(s) }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSel({ k, i })
                  }}
                />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
