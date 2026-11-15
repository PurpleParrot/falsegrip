import { useState } from 'react'
import { IconPlus, IconSettings } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { exerciseName, fmtDuration, fmtMonth, fmtMonthShort, fmtWeekday } from '../format'
import { useExercises, useSessions, useTemplates } from '../hooks'
import { t } from '../i18n'
import { setFilled, type Session, type Template } from '../model'
import { navigate } from '../router'
import { startSession } from '../sessions'

export function Trainings() {
  const sessions = useSessions()
  const templates = useTemplates()
  const { map: exMap } = useExercises()
  const [startOpen, setStartOpen] = useState(false)

  const groups: { key: string; label: string; items: Session[] }[] = []
  for (const s of sessions ?? []) {
    const d = new Date(s.startedAt)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let g = groups.at(-1)
    if (!g || g.key !== key) groups.push((g = { key, label: fmtMonth(s.startedAt), items: [] }))
    g.items.push(s)
  }

  const start = async (tpl: Template | null) => {
    const id = await startSession(tpl, exMap)
    navigate(`/session/${id}`)
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1>{t('tab.trainings')}</h1>
        <span className="grow" />
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label={t('settings.title')}>
          <IconSettings />
        </button>
      </header>

      {sessions && sessions.length === 0 && <p className="muted center pad">{t('trainings.empty')}</p>}

      {groups.map((g) => (
        <section key={g.key} className="month">
          <h2 className="month-title">
            {g.label} <span className="muted">· {t(g.items.length === 1 ? 'trainings.count.one' : 'trainings.count.other', { n: g.items.length })}</span>
          </h2>
          {g.items.map((s) => {
            const running = !s.endedAt
            const blocks = s.blocks
              .map((b) => ({ name: exerciseName(exMap.get(b.exerciseId), b.levelId), n: b.sets.filter(setFilled).length }))
              .filter((b) => b.n > 0 || running)
            return (
              <button key={s.id} className="session-row" onClick={() => navigate(`/session/${s.id}`)}>
                <div className="date-col">
                  <span className="wd">{fmtWeekday(s.startedAt)}</span>
                  <span className="day">{new Date(s.startedAt).getDate()}</span>
                  <span className="mon">{fmtMonthShort(s.startedAt)}</span>
                </div>
                <div className={`card session-card ${running ? 'running' : ''}`}>
                  <div className="session-card-head">
                    <strong>{s.name || t('start.free')}</strong>
                    <span className={running ? 'badge' : 'muted small'}>
                      {running ? t('trainings.running') : fmtDuration((s.endedAt ?? s.startedAt) - s.startedAt)}
                    </span>
                  </div>
                  <div className="session-card-ex muted small">
                    {blocks.length
                      ? blocks.slice(0, 4).map((b, i) => (
                          <div key={i}>
                            {b.n}× {b.name}
                          </div>
                        ))
                      : t('trainings.noExercises')}
                    {blocks.length > 4 && <div>…</div>}
                  </div>
                </div>
              </button>
            )
          })}
        </section>
      ))}
      <div style={{ height: 90 }} />

      <button className="fab" onClick={() => setStartOpen(true)} aria-label={t('start.title')}>
        <IconPlus size={28} />
      </button>

      <Sheet open={startOpen} onClose={() => setStartOpen(false)} title={t('start.title')}>
        <div className="menu">
          <button className="start-item primary" onClick={() => start(null)}>
            <strong>{t('start.free')}</strong>
            <span className="muted small">{t('start.freeSub')}</span>
          </button>
          {templates?.map((tpl) => (
            <button key={tpl.id} className="start-item" onClick={() => start(tpl)}>
              <strong>{tpl.name}</strong>
              <span className="muted small">
                {tpl.items
                  .slice(0, 4)
                  .map((it) => exerciseName(exMap.get(it.exerciseId), it.levelId))
                  .join(' · ') || t('start.exercises', { n: 0 })}
              </span>
            </button>
          ))}
          {templates && templates.length === 0 && <p className="muted small pad">{t('start.noTemplates')}</p>}
        </div>
      </Sheet>
    </div>
  )
}
