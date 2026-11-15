import { useMemo, useState } from 'react'
import { useExercises } from '../hooks'
import { t } from '../i18n'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../model'
import { IconChevron, IconSearch } from './Icons'
import { Sheet } from './Sheet'

export function groupByMuscle(list: Exercise[]): [MuscleGroup | 'none', Exercise[]][] {
  const groups = new Map<MuscleGroup | 'none', Exercise[]>()
  for (const ex of list) {
    const g = ex.muscleGroups[0] ?? 'none'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(ex)
  }
  const order: (MuscleGroup | 'none')[] = [...MUSCLE_GROUPS, 'none']
  return order.filter((g) => groups.has(g)).map((g) => [g, groups.get(g)!])
}

export function matches(ex: Exercise, q: string) {
  if (!q) return true
  const s = q.toLowerCase()
  return ex.name.toLowerCase().includes(s) || ex.levels.some((l) => `${l.name} ${ex.name}`.toLowerCase().includes(s))
}

/** Pick an exercise or a concrete progression level. Exercises with levels require choosing a level. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  allowWhole,
}: {
  open: boolean
  onClose: () => void
  onPick: (ex: Exercise, levelId: string | null) => void
  /** allow picking an exercise with levels as a whole (statistics) */
  allowWhole?: boolean
}) {
  const { list } = useExercises()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const filtered = useMemo(() => list.filter((e) => matches(e, q)), [list, q])
  const pick = (ex: Exercise, lvl: string | null) => {
    onPick(ex, lvl)
    onClose()
    setQ('')
    setExpanded(null)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('picker.title')} full>
      <label className="search">
        <IconSearch size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.search')} />
      </label>
      {filtered.length === 0 && <p className="muted center pad">{t('library.noResults')}</p>}
      {groupByMuscle(filtered).map(([g, exs]) => (
        <section key={g} className="group">
          <h3 className="group-title">{t(`mg.${g}` as never)}</h3>
          {exs.map((ex) =>
            ex.levels.length ? (
              <div key={ex.id} className="list-group">
                <button className="list-item" onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}>
                  <span className="grow">{ex.name}</span>
                  <span className="muted small">{t('library.levels', { n: ex.levels.length })}</span>
                  <IconChevron size={18} className={`chev ${expanded === ex.id || q ? 'down' : ''}`} />
                </button>
                {(expanded === ex.id || !!q) && (
                  <div className="sub-list">
                    {allowWhole && (
                      <button className="list-item sub" onClick={() => pick(ex, null)}>
                        {t('stats.wholeExercise')}
                      </button>
                    )}
                    {ex.levels.map((l) => (
                      <button key={l.id} className="list-item sub" onClick={() => pick(ex, l.id)}>
                        <span className="grow">
                          {l.name} {ex.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button key={ex.id} className="list-item" onClick={() => pick(ex, null)}>
                <span className="grow">{ex.name}</span>
              </button>
            ),
          )}
        </section>
      ))}
    </Sheet>
  )
}
