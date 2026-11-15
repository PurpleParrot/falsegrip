import { useMemo, useState } from 'react'
import { groupByMuscle, matches } from '../components/ExercisePicker'
import { IconChevron, IconPlus, IconSearch } from '../components/Icons'
import { exerciseName } from '../format'
import { useExercises, useTemplates } from '../hooks'
import { t } from '../i18n'
import { navigate } from '../router'

export function Library({ segment }: { segment: 'exercises' | 'templates' }) {
  const { list, map } = useExercises()
  const templates = useTemplates()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const filtered = useMemo(() => list.filter((e) => matches(e, q)), [list, q])

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="screen">
      <header className="topbar">
        <div className="segmented grow">
          <button className={segment === 'exercises' ? 'on' : ''} onClick={() => navigate('/library', { replace: true })}>
            {t('library.exercises')}
          </button>
          <button className={segment === 'templates' ? 'on' : ''} onClick={() => navigate('/library/templates', { replace: true })}>
            {t('library.templates')}
          </button>
        </div>
      </header>

      {segment === 'exercises' ? (
        <>
          <label className="search">
            <IconSearch size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.search')} />
          </label>
          {filtered.length === 0 && <p className="muted center pad">{t('library.noResults')}</p>}
          {groupByMuscle(filtered).map(([g, exs]) => (
            <section key={g} className="group">
              <h3 className="group-title">{t(`mg.${g}` as never)}</h3>
              {exs.map((ex) => (
                <div key={ex.id} className="list-group">
                  <div className="list-item">
                    <button className="grow left" onClick={() => navigate(`/exercise/${ex.id}`)}>
                      {ex.name}
                      <span className="muted small block">
                        {[
                          t(`eq.${ex.equipment}`),
                          ex.unilateral ? 'L/R' : null,
                          (['weight', 'reps', 'time'] as const).filter((f) => ex.fields[f]).map((f) => t(`field.${f}`)).join(' + '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                    {ex.levels.length > 0 && (
                      <button className="chip-btn" onClick={() => toggle(ex.id)}>
                        {t('library.levels', { n: ex.levels.length })}
                        <IconChevron size={16} className={`chev ${expanded.has(ex.id) || q ? 'down' : ''}`} />
                      </button>
                    )}
                  </div>
                  {ex.levels.length > 0 && (expanded.has(ex.id) || !!q) && (
                    <div className="sub-list">
                      {ex.levels.map((l) => (
                        <button key={l.id} className="list-item sub" onClick={() => navigate(`/exercise/${ex.id}`)}>
                          <span className="grow">{l.name} {ex.name}</span>
                          <span className="muted small">{l.intensity} %</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </>
      ) : (
        <div className="pad-x">
          {templates && templates.length === 0 && <p className="muted center pad">{t('library.noTemplates')}</p>}
          {templates?.map((tpl) => (
            <button key={tpl.id} className="card tpl-card" onClick={() => navigate(`/template/${tpl.id}`)}>
              <strong>{tpl.name}</strong>
              <div className="muted small">
                {tpl.items.map((it) => `${it.sets}× ${exerciseName(map.get(it.exerciseId), it.levelId)}`).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
      <div style={{ height: 90 }} />
      <button
        className="fab"
        onClick={() => navigate(segment === 'exercises' ? '/exercise/new' : '/template/new')}
        aria-label={segment === 'exercises' ? t('library.newExercise') : t('library.newTemplate')}
      >
        <IconPlus size={28} />
      </button>
    </div>
  )
}
