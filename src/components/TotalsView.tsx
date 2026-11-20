import { useMemo, useState } from 'react'
import { fmtNum } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Session } from '../model'
import { rangeStart, sessionTotals, type Series } from '../stats'
import { COMPARE_COLORS } from './CompareView'
import { LineChart } from './LineChart'
import { FrequencyLine } from './StatsView'

type Range = '1m' | '3m' | '1y' | 'all'
const RANGES: Range[] = ['1m', '3m', '1y', 'all']
type Mode = 'session' | 'group'

/** Volume over all exercises: per training, or per muscle group. */
export function TotalsView({ sessions, exercises }: { sessions: Session[]; exercises: Map<string, Exercise> }) {
  const [mode, setMode] = useState<Mode>('session')
  const [range, setRange] = useState<Range>('3m')
  const { bodyweight } = useSettings()
  const totals = useMemo(() => sessionTotals(sessions, exercises, rangeStart(range), bodyweight), [sessions, exercises, range, bodyweight])

  // muscle groups with data in range, biggest first
  const groupSums = useMemo(() => {
    const sums = new Map<MuscleGroup, number>()
    for (const x of totals) for (const [g, v] of Object.entries(x.groups) as [MuscleGroup, number][]) sums.set(g, (sums.get(g) ?? 0) + v)
    return MUSCLE_GROUPS.filter((g) => sums.has(g)).sort((a, b) => sums.get(b)! - sums.get(a)!)
  }, [totals])
  const [picked, setPicked] = useState<MuscleGroup[] | null>(null)
  const groups = (picked ?? groupSums.slice(0, 3)).filter((g) => groupSums.includes(g))

  const toggle = (g: MuscleGroup) => {
    const cur = groups
    if (cur.includes(g)) setPicked(cur.filter((x) => x !== g))
    else if (cur.length < COMPARE_COLORS.length) setPicked([...cur, g])
  }

  const series: Series[] =
    mode === 'session'
      ? [{ side: 'B', points: totals.map((x) => ({ t: x.t, y: x.total, sessionId: x.sessionId })) }]
      : groups.map((g, i) => ({
          side: 'B',
          key: g,
          label: t(`mg.${g}`),
          color: COMPARE_COLORS[i],
          points: totals.filter((x) => x.groups[g]).map((x) => ({ t: x.t, y: Math.round(x.groups[g]!), sessionId: x.sessionId })),
        }))

  const vals = totals.map((x) => x.total)
  const best = vals.length ? Math.max(...vals) : null
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null

  return (
    <div className="stats-view">
      <div className="segmented">
        <button className={mode === 'session' ? 'on' : ''} onClick={() => setMode('session')}>
          {t('totals.perSession')}
        </button>
        <button className={mode === 'group' ? 'on' : ''} onClick={() => setMode('group')}>
          {t('totals.perGroup')}
        </button>
      </div>
      <p className="muted small">
        {t(mode === 'session' ? 'totals.hint' : 'totals.hintGroup')}
        {!bodyweight && <span className="warn"> {t('stats.volumeNoBw')}</span>}
      </p>
      {mode === 'group' && groupSums.length > 0 && (
        <div className="chips">
          {groupSums.map((g) => {
            const i = groups.indexOf(g)
            return (
              <button key={g} className={`chip ${i >= 0 ? 'on' : ''}`} onClick={() => toggle(g)}>
                {i >= 0 && <i className="dot-swatch" style={{ background: COMPARE_COLORS[i] }} />} {t(`mg.${g}`)}
              </button>
            )
          })}
        </div>
      )}
      <div className="segmented small">
        {RANGES.map((r) => (
          <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
            {t(`stats.range.${r}`)}
          </button>
        ))}
      </div>
      <LineChart series={series} unit="kg" height={240} />
      <FrequencyLine sessions={sessions} />
      {mode === 'session' ? (
        <div className="kpis three">
          <div>
            <span className="muted small">{t('stats.best')}</span>
            <strong>
              {best !== null ? fmtNum(best) : '–'} <small>kg</small>
            </strong>
          </div>
          <div>
            <span className="muted small">{t('totals.avg')}</span>
            <strong>
              {avg !== null ? fmtNum(avg) : '–'} <small>kg</small>
            </strong>
          </div>
          <div>
            <span className="muted small">{t('stats.sessions')}</span>
            <strong>{vals.length}</strong>
          </div>
        </div>
      ) : (
        <div className="compare-legend">
          {series.map((s) => {
            const sum = s.points.reduce((a, p) => a + p.y, 0)
            return (
              <div key={s.key} className="compare-row">
                <i style={{ background: s.color }} />
                <span className="grow">{s.label}</span>
                <span className="muted small">
                  Ø <strong className="ink">{s.points.length ? fmtNum(Math.round(sum / s.points.length)) : '–'}</strong> kg ·{' '}
                  {t('totals.sum')} {fmtNum(Math.round(sum))} kg
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
