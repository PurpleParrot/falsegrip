import { useMemo, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { IconChevron } from '../components/Icons'
import { StatsView } from '../components/StatsView'
import { exerciseName } from '../format'
import { useExercises, useSessions, useTemplates } from '../hooks'
import { t } from '../i18n'
import { buildCsv, downloadFile } from '../stats'

const KEY = 'falsegrip.stats.sel'

export function Stats() {
  const { map, list } = useExercises()
  const sessions = useSessions()
  const templates = useTemplates()
  const [picker, setPicker] = useState(false)
  const [sel, setSel] = useState<{ exId: string; levelId: string | null } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      return null
    }
  })

  // default: most recently trained exercise
  const effective = useMemo(() => {
    if (sel && map.get(sel.exId)) return sel
    const b = sessions?.[0]?.blocks[0]
    if (b && map.get(b.exerciseId)) return { exId: b.exerciseId, levelId: b.levelId ?? null }
    return list[0] ? { exId: list[0].id, levelId: null } : null
  }, [sel, map, sessions, list])

  const ex = effective ? map.get(effective.exId) : undefined
  const levelId = ex ? (ex.levels.length ? effective!.levelId : undefined) : undefined

  const exportCsv = () => {
    if (!sessions) return
    const tplNames = new Map((templates ?? []).map((x) => [x.id, x.name]))
    const csv = buildCsv(sessions, map, tplNames)
    downloadFile(`falsegrip-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="grow">{t('tab.stats')}</h1>
        <button className="btn small ghost" onClick={exportCsv}>
          {t('stats.csv')}
        </button>
      </header>
      <div className="pad-x">
        <button className="select-btn" onClick={() => setPicker(true)}>
          <span className="grow">
            {ex ? (levelId === null ? `${ex.name} · ${t('stats.wholeExercise')}` : exerciseName(ex, levelId)) : t('stats.pickExercise')}
          </span>
          <IconChevron size={18} className="chev down" />
        </button>
        {ex && sessions && <StatsView key={ex.id + String(levelId)} ex={ex} levelId={levelId} sessions={sessions} />}
      </div>
      <ExercisePicker
        open={picker}
        allowWhole
        onClose={() => setPicker(false)}
        onPick={(e, lvl) => {
          const v = { exId: e.id, levelId: lvl }
          setSel(v)
          try {
            localStorage.setItem(KEY, JSON.stringify(v))
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  )
}
