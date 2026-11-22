import { useMemo, useState } from 'react'
import { fmtDateShort, fmtMonth, fmtNum } from '../format'
import { t } from '../i18n'
import { bucketPoints, effectiveBucket, regression, REGRESSION_MIN, trendPct, type Bucket, type Point, type Series } from '../stats'

const COLORS: Record<string, string> = { B: 'var(--accent)', L: 'var(--accent)', R: 'var(--accent-2)' }

/**
 * Simple, gently animated SVG line chart. Tap to inspect a point.
 * `bucket`: at most one point per week / month (mean); with less data it shows weeks or every training. Trend and regression line always use the individual trainings.
 */
export function LineChart({
  series: raw,
  unit,
  height = 200,
  bucket: maxBucket,
}: {
  series: Series[]
  unit: string
  height?: number
  bucket?: Bucket
}) {
  const W = 340
  const H = height
  // with little data, step down from the range's bucket (month → week → every training)
  const bucket = maxBucket ? effectiveBucket(raw.flatMap((s) => s.points), maxBucket) : undefined
  const series = useMemo(
    () => (bucket ? raw.map((s) => ({ ...s, points: bucketPoints(s.points, bucket) })) : raw),
    [raw, bucket],
  )
  // dashed regression line per series from REGRESSION_MIN trainings on, over the individual trainings
  const regs = raw.map((s) => {
    const r = s.points.length >= REGRESSION_MIN ? regression(s.points) : null
    if (!r) return null
    const t0 = s.points[0].t
    const t1 = s.points[s.points.length - 1].t
    return { t0, t1, y0: r.a + r.b * t0, y1: r.a + r.b * t1 }
  })
  const all: Point[] = [
    ...series.flatMap((s) => s.points),
    ...regs.flatMap((r) => (r ? [{ t: r.t0, y: r.y0, sessionId: '' }, { t: r.t1, y: r.y1, sessionId: '' }] : [])),
  ]
  // left padding wide enough for the longest axis label (e.g. "10.953")
  const maxY = all.length ? Math.max(...all.map((p) => p.y)) * 1.15 : 0
  const pad = { l: Math.max(30, fmtNum(maxY, 0).length * 6 + 10), r: 12, t: 14, b: 22 }
  const [sel, setSel] = useState<{ k: number; i: number } | null>(null)
  // mouse hover (desktop): small tooltip right next to the point
  const [hov, setHov] = useState<{ k: number; i: number } | null>(null)
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
  const hovS = hov ? series[hov.k] : undefined
  const hovP = hovS && hov ? hovS.points[hov.i] : null
  const gridYs = [0, 0.5, 1].map((f) => geo.y0 + f * (geo.y1 - geo.y0))
  // date of a point; weekly/monthly means: "Woche ab 3. Nov." / "November 2026" and how many trainings
  const when = (p: Point) =>
    p.from === undefined
      ? fmtDateShort(p.t)
      : `${bucket === 'month' ? fmtMonth(p.from) : t('stats.weekOf', { date: fmtDateShort(p.from) })} · ${(p.count ?? 1) === 1 ? t('stats.oneTraining') : t('stats.nTrainings', { n: p.count ?? 1 })}`

  // Trend "▲ +12 %": one line → badge in the top-right corner; several lines → small box at the end of each line
  const BOX_H = 16
  const BOX_W = 62
  const GAP = 7
  // how much line runs through a box spanning [x0, x1] × [top, top + BOX_H]: lines sampled every 2 units (+3 margin)
  const crossings = (x0: number, x1: number, top: number) => {
    let n = 0
    for (const s of series)
      for (let i = 1; i < s.points.length; i++) {
        const ax = geo.x(s.points[i - 1].t), bx = geo.x(s.points[i].t)
        const ay = geo.y(s.points[i - 1].y), by = geo.y(s.points[i].y)
        const lo = Math.max(x0, ax), hi = Math.min(x1, bx)
        if (lo > hi || bx === ax) continue
        // sample along the segment's length so steep pieces count as much as flat ones
        const len = Math.hypot(bx - ax, by - ay)
        for (let d = 0; d <= len; d += 2) {
          const xx = ax + ((bx - ax) * d) / len
          const yy = ay + ((by - ay) * d) / len
          if (xx >= lo && xx <= hi && yy >= top - 3 && yy <= top + BOX_H + 3) n++
        }
      }
    return n
  }
  const trends = series
    .map((s, k) => {
      const r = trendPct(raw[k].points)
      const last = s.points.at(-1)
      if (r === null || !last) return null
      const x = Math.min(geo.x(last.t), W - 6)
      const py = geo.y(last.y)
      // candidates: right above / below the point, then one box height further away;
      // pick the one no line runs through, preferring close spots and (on a tie) the side the own line doesn't come from
      const prev = s.points.at(-2)
      const fromAbove = prev !== undefined && geo.y(prev.y) < py
      const options = [
        { top: py - GAP - BOX_H, pref: fromAbove ? 1 : 0 },
        { top: py + GAP, pref: fromAbove ? 0 : 1 },
        { top: py - GAP - 2 * BOX_H - 2, pref: 2 },
        { top: py + GAP + BOX_H + 2, pref: 3 },
      ]
        .filter((o) => o.top >= 0 && o.top + BOX_H <= H - pad.b + 6)
        .map((o) => ({ ...o, cross: crossings(x - BOX_W + 6, x + 6, o.top) }))
        .sort((a, b) => a.cross - b.cross || a.pref - b.pref)
      return { s, r: Math.round(r), x, top: options[0]?.top ?? py - GAP - BOX_H }
    })
    .filter((x) => x !== null)
    .sort((a, b) => a.top - b.top)
  // push boxes apart when lines end close together
  for (let i = 1; i < trends.length; i++) {
    const prev = trends[i - 1]
    if (Math.abs(trends[i].x - prev.x) < 60 && trends[i].top - prev.top < BOX_H + 2) trends[i].top = prev.top + BOX_H + 2
  }
  const trendText = (r: number) => (
    <>
      {r > 0 ? '▲' : r < 0 ? '▼' : '▶'} {r > 0 ? '+' : ''}
      {fmtNum(r, 0)} %
    </>
  )
  const trendCls = (r: number) => `trend ${r > 0 ? 'up' : r < 0 ? 'down' : ''}`
  // "one line" = one visible line (a compared exercise without data in range doesn't count)
  const single = series.filter((s) => s.points.length).length === 1 ? trends[0] : undefined

  return (
    <div className="chart">
      <div className="chart-readout">
        <div className="chart-readout-main">
        {selected ? (
          <>
            <strong>
              {selected.from !== undefined && 'Ø '}
              {fmtNum(selected.y, 1)} {unit}
            </strong>
            <span className="muted"> · {when(selected)}</span>
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
        {single && (
          <span className={`${trendCls(single.r)} corner`} title={t('stats.trendHint')}>
            {trendText(single.r)}
          </span>
        )}
      </div>
      <div className="chart-plot">
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
        {regs.map((r, k) =>
          r ? (
            <line
              key={'reg' + k}
              x1={geo.x(r.t0)}
              y1={geo.y(r.y0)}
              x2={geo.x(r.t1)}
              y2={geo.y(r.y1)}
              className="reg-line"
              style={{ stroke: colorOf(raw[k]) }}
            />
          ) : null,
        )}
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
                  r={(sel?.k === k && sel.i === i) || (hov?.k === k && hov.i === i) ? 6 : 3.5}
                  className="dot"
                  style={{ fill: colorOf(s) }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSel({ k, i })
                  }}
                />
              ))}
              {/* larger invisible hit area for mouse hover */}
              {s.points.map((p, i) => (
                <circle
                  key={'h' + i}
                  cx={geo.x(p.t)}
                  cy={geo.y(p.y)}
                  r={10}
                  className="dot-hit"
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHov({ k, i })}
                  onPointerLeave={() => setHov(null)}
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
      {!single &&
        trends.map(({ s, r, x, top }) => (
          <span
            key={'trend' + (s.key ?? s.side)}
            className={`${trendCls(r)} at-point`}
            title={t('stats.trendHint')}
            style={{
              left: `${(x / W) * 100}%`,
              top: `${(top / H) * 100}%`,
              ['--line-color' as string]: colorOf(s),
            }}
          >
            {trendText(r)}
          </span>
        ))}
      {hovP && hovS && (
        <div
          className={`chart-tip ${geo.x(hovP.t) > W * 0.6 ? 'left' : ''}`}
          style={{ left: `${(geo.x(hovP.t) / W) * 100}%`, top: `${(geo.y(hovP.y) / H) * 100}%` }}
        >
          <strong>
            {hovP.from !== undefined && 'Ø '}
            {fmtNum(hovP.y, 1)} {unit}
          </strong>
          <span className="muted"> · {when(hovP)}</span>
          {hovS.label && <span className="muted"> · {hovS.label}</span>}
        </div>
      )}
      </div>
    </div>
  )
}
