import { exerciseName, fmtDate, fmtVals } from '../format'
import { t } from '../i18n'
import { hasValue, type Exercise, type Session } from '../model'

/** All past sessions containing this exercise (all levels), newest first. */
export function HistoryList({ ex, sessions, excludeId }: { ex: Exercise; sessions: Session[]; excludeId?: string }) {
  const rows = sessions
    .filter((s) => !s.deletedAt && s.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => ({ s, blocks: s.blocks.filter((b) => b.exerciseId === ex.id && b.sets.some((st) => Object.values(st.sides).some(hasValue))) }))
    .filter((r) => r.blocks.length)
  if (!rows.length) return <p className="muted center pad">{t('history.empty')}</p>
  return (
    <div className="history">
      {rows.map(({ s, blocks }) => (
        <div key={s.id} className="history-item">
          <div className="history-head">
            <strong>{fmtDate(s.startedAt)}</strong>
            <span className="muted small">{s.name || t('start.free')}</span>
          </div>
          {blocks.map((b) => (
            <div key={b.id}>
              {ex.levels.length > 0 && <div className="accent small">{exerciseName(ex, b.levelId)}</div>}
              {b.sets.map((st, i) => {
                const parts = Object.entries(st.sides).filter(([, v]) => hasValue(v))
                if (!parts.length) return null
                return (
                  <div key={st.id} className="history-set">
                    <span className="set-no small">{i + 1}</span>
                    <span>
                      {parts.map(([side, v]) => (side === 'B' ? '' : side + ': ') + fmtVals(ex, v)).join('   ')}
                      {st.note && <span className="muted"> · {st.note}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
