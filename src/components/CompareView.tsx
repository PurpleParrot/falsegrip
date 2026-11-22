import { useEffect, useMemo, useState } from 'react'
import { exerciseName, fmtNum } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import type { Exercise, Session } from '../model'
import { bucketFor, buildSeries, metricsFor, rangeStart, type MetricDef, type MetricId, type Series } from '../stats'
import { LineChart } from './LineChart'

export const COMPARE_COLORS = ['var(--accent)', 'var(--accent-2)', '#e9d39a', '#b9a3e3', '#8fd18f']
export const COMPARE_MAX = COMPARE_COLORS.length

type Range = '1m' | '3m' | '1y' | 'all'
const RANGES: Range[] = ['1m', '3m', '1y', 'all']

export interface CompareItem {
  ex: Exercise
  levelId: string | null | undefined
}

export const itemLabel = (it: CompareItem) =>
  it.levelId === null ? `${it.ex.name} · ${t('stats.wholeExercise')}` : exerciseName(it.ex, it.levelId)

/** Metrics every item can show (same id = same dimension). "Reps at weight" needs a per-exercise weight, so it is left out. */
export function sharedMetrics(items: CompareItem[]): MetricDef[] {
  if (!items.length) return []
  const [first, ...rest] = items.map((it) => metricsFor(it.ex, it.levelId).filter((m) => m.id !== 'repsAtWeight'))
  return first.filter((m) => rest.every((r) => r.some((x) => x.id === m.id)))
}

/** Several exercises in one chart. Unilateral exercises are merged into one line (L + R). */
export function CompareView({ items, sessions }: { items: CompareItem[]; sessions: Session[] }) {
  const metrics = sharedMetrics(items)
  const [metric, setMetric] = useState<MetricId | undefined>(metrics[0]?.id)
  const [range, setRange] = useState<Range>('3m')
  const { bodyweight } = useSettings()
  const def = metrics.find((m) => m.id === metric) ?? metrics[0]

  useEffect(() => {
    if (def && def.id !== metric) setMetric(def.id)
  }, [def, metric])

  const series: Series[] = useMemo(
    () =>
      def
        ? items.map((it, i) => ({
            ...buildSeries(sessions, it.ex, it.levelId, def.id, rangeStart(range), { bodyweight, combineSides: true })[0],
            key: it.ex.id + String(it.levelId),
            label: itemLabel(it),
            color: COMPARE_COLORS[i],
          }))
        : [],
    [items, sessions, def, range, bodyweight],
  )

  if (!def) return <p className="muted center pad">{t('stats.compareNone')}</p>
  const isVol = def.id === 'volume' || def.id === 'timeVolume'
  return (
    <div className="stats-view">
      <select className="select" value={def.id} onChange={(e) => setMetric(e.target.value as MetricId)} aria-label={t('stats.metric')}>
        {metrics.map((m) => (
          <option key={m.id} value={m.id}>
            {t(m.label)}
          </option>
        ))}
      </select>
      {isVol && !bodyweight && <p className="small warn">{t('stats.volumeNoBw')}</p>}
      <div className="segmented small">
        {RANGES.map((r) => (
          <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
            {t(`stats.range.${r}`)}
          </button>
        ))}
      </div>
      <LineChart series={series} unit={def.unit} height={240} bucket={bucketFor(range)} />
      <div className="compare-legend">
        {series.map((s) => {
          const best = s.points.length ? Math.max(...s.points.map((p) => p.y)) : null
          return (
            <div key={s.key} className="compare-row">
              <i style={{ background: s.color }} />
              <span className="grow">{s.label}</span>
              <span className="muted small">
                {s.points.length} × · {t('stats.best')}{' '}
                <strong className="ink">{best !== null ? fmtNum(best, 1) : '–'}</strong> {def.unit}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
