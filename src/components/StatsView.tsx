import { useEffect, useMemo, useState } from 'react'
import { fmtDate, fmtNum, fmtVals, exerciseName } from '../format'
import { t } from '../i18n'
import { bwPctOf, hasValue, type Exercise, type Session } from '../model'
import { buildSeries, metricsFor, rangeStart, weightsUsed, type MetricId } from '../stats'
import { useSettings } from '../hooks'
import { LineChart } from './LineChart'

type Range = '1m' | '3m' | '1y' | 'all'
const RANGES: Range[] = ['1m', '3m', '1y', 'all']

/** Metric selector + range + chart for one exercise / level. Used in Tab 3 and in the mini-stats overlay. */
export function StatsView({
  ex,
  levelId,
  sessions,
  compact,
}: {
  ex: Exercise
  levelId: string | null | undefined
  sessions: Session[]
  compact?: boolean
}) {
  const metrics = metricsFor(ex, levelId)
  const [metric, setMetric] = useState<MetricId>(metrics[0]?.id)
  const [range, setRange] = useState<Range>('3m')
  const weights = useMemo(() => weightsUsed(sessions, ex, levelId), [sessions, ex, levelId])
  const [atWeight, setAtWeight] = useState<number | null>(null)
  const { bodyweight } = useSettings()

  useEffect(() => {
    if (!metrics.some((m) => m.id === metric)) setMetric(metrics[0]?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, levelId])
  useEffect(() => {
    if (metric === 'repsAtWeight' && (atWeight === null || !weights.includes(atWeight))) setAtWeight(weights.at(-1) ?? 0)
  }, [metric, weights, atWeight])

  const def = metrics.find((m) => m.id === metric) ?? metrics[0]
  const series = useMemo(
    () => (def ? buildSeries(sessions, ex, levelId, def.id, rangeStart(range), { atWeight, bodyweight }) : []),
    [sessions, ex, levelId, def, range, atWeight, bodyweight],
  )
  const pts = series.flatMap((s) => s.points)
  const best = pts.length ? Math.max(...pts.map((p) => p.y)) : null

  // last values of this exercise (most recent session)
  const last = useMemo(() => {
    const s = sessions
      .filter((x) => !x.deletedAt)
      .sort((a, b) => b.startedAt - a.startedAt)
      .find((x) => x.blocks.some((b) => b.exerciseId === ex.id && (!levelId || b.levelId === levelId) && b.sets.some((st) => Object.values(st.sides).some(hasValue))))
    return s
  }, [sessions, ex.id, levelId])

  if (!def) return null
  return (
    <div className="stats-view">
      <select className="select" value={def.id} onChange={(e) => setMetric(e.target.value as MetricId)} aria-label={t('stats.metric')}>
        {metrics.map((m) => (
          <option key={m.id} value={m.id}>
            {t(m.label)}
          </option>
        ))}
      </select>
      {def.id === 'repsAtWeight' && weights.length > 0 && (
        <div className="chips">
          <span className="muted small">{t('stats.atWeight')}</span>
          {weights.map((w) => (
            <button key={w} className={`chip ${w === atWeight ? 'on' : ''}`} onClick={() => setAtWeight(w)}>
              {fmtNum(w)} kg
            </button>
          ))}
        </div>
      )}
      {(def.id === 'volume' || def.id === 'timeVolume') && <VolumeHint ex={ex} missingBw={!bodyweight} />}
      <div className="segmented small">
        {RANGES.map((r) => (
          <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
            {t(`stats.range.${r}`)}
          </button>
        ))}
      </div>
      <LineChart series={series} unit={def.unit} height={compact ? 170 : 220} />
      <div className="kpis">
        <div>
          <span className="muted small">{t('stats.best')}</span>
          <strong>
            {best !== null ? fmtNum(best, 1) : '–'} <small>{def.unit}</small>
          </strong>
        </div>
        <div>
          <span className="muted small">{t('stats.sessions')}</span>
          <strong>{series[0]?.points.length ?? 0}</strong>
        </div>
      </div>
      {last && (
        <div className="last-box">
          <span className="muted small">
            {t('stats.last')} · {fmtDate(last.startedAt)}
          </span>
          {last.blocks
            .filter((b) => b.exerciseId === ex.id && (!levelId || b.levelId === levelId))
            .map((b) => (
              <div key={b.id} className="small">
                {levelId === null && <span className="muted">{exerciseName(ex, b.levelId)}: </span>}
                {b.sets
                  .map((st) =>
                    Object.entries(st.sides)
                      .filter(([, v]) => hasValue(v))
                      .map(([side, v]) => (side === 'B' ? '' : side + ' ') + fmtVals(ex, v))
                      .join(' / '),
                  )
                  .filter(Boolean)
                  .join('  ·  ')}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function VolumeHint({ ex, missingBw }: { ex: Exercise; missingBw: boolean }) {
  const pct = bwPctOf(ex)
  return (
    <p className="muted small">
      {pct > 0 ? t('stats.volumeHint', { pct }) : t('stats.volumeHintNoBw')}
      {pct > 0 && missingBw && <span className="warn"> {t('stats.volumeNoBw')}</span>}
    </p>
  )
}
