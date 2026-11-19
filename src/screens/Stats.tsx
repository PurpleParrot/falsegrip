import { useCallback, useMemo, useState } from 'react'
import { COMPARE_COLORS, COMPARE_MAX, CompareView, itemLabel, sharedMetrics, type CompareItem } from '../components/CompareView'
import { ExercisePicker } from '../components/ExercisePicker'
import { IconChevron } from '../components/Icons'
import { StatsView } from '../components/StatsView'
import { TotalsView } from '../components/TotalsView'
import { useExercises, useSessions, useSettings, useTemplates } from '../hooks'
import { t } from '../i18n'
import type { Exercise } from '../model'
import { buildCsv, downloadFile, fileUser, metricsFor } from '../stats'

const KEY = 'falsegrip.stats.sel'
const KEY_CMP = 'falsegrip.stats.compare'
const KEY_VIEW = 'falsegrip.stats.view'

type Sel = { exId: string; levelId: string | null }

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function Stats() {
  const { map, list } = useExercises()
  const sessions = useSessions()
  const templates = useTemplates()
  const settings = useSettings()
  const [pickerOpen, setPickerOpen] = useState(false)
  // kept while the sheet animates closed, so the title doesn't flip
  const [pickerMode, setPickerMode] = useState<'main' | 'compare'>('main')
  const openPicker = (m: 'main' | 'compare') => {
    setPickerMode(m)
    setPickerOpen(true)
  }
  const [sel, setSel] = useState<Sel | null>(() => load(KEY, null))
  const [extra, setExtra] = useState<Sel[]>(() => load(KEY_CMP, []))
  const [view, setView] = useState<'exercises' | 'totals'>(() => load(KEY_VIEW, 'exercises'))
  const switchView = (v: 'exercises' | 'totals') => {
    setView(v)
    store(KEY_VIEW, v)
  }

  // default: most recently trained exercise
  const effective = useMemo(() => {
    if (sel && map.get(sel.exId)) return sel
    const b = sessions?.[0]?.blocks.find((x) => (map.get(x.exerciseId)?.kind ?? 'sets') === 'sets')
    if (b && map.get(b.exerciseId)) return { exId: b.exerciseId, levelId: b.levelId ?? null }
    const first = list.find((e) => (e.kind ?? 'sets') === 'sets')
    return first ? { exId: first.id, levelId: null } : null
  }, [sel, map, sessions, list])

  const toItem = useCallback(
    (s: Sel): CompareItem | null => {
      const ex = map.get(s.exId)
      if (!ex || ex.deletedAt) return null
      return { ex, levelId: ex.levels.length ? s.levelId : undefined }
    },
    [map],
  )
  const main = effective ? toItem(effective) : null
  const extraItems = useMemo(() => extra.map(toItem).filter((x): x is CompareItem => !!x), [extra, toItem])
  const items = main ? [main, ...extraItems] : []
  const comparing = extraItems.length > 0

  const setExtraStored = (v: Sel[]) => {
    setExtra(v)
    store(KEY_CMP, v)
  }

  // compare picker: only exercises that share at least one metric with the current selection
  const shared = useMemo(() => sharedMetrics(items).map((m) => m.id), [items])
  const compatible = useCallback(
    (ex: Exercise) => {
      const own = [...metricsFor(ex, ex.levels.length ? ex.levels[0].id : undefined), ...(ex.levels.length ? metricsFor(ex, null) : [])]
      if (!ex.levels.length && items.some((it) => it.ex.id === ex.id)) return false
      return own.some((m) => shared.includes(m.id))
    },
    [shared, items],
  )

  const exportCsv = () => {
    if (!sessions) return
    const tplNames = new Map((templates ?? []).map((x) => [x.id, x.name]))
    const csv = buildCsv(sessions, map, tplNames, settings.username ?? '')
    downloadFile(`falsegrip-${fileUser(settings.username)}${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
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
        <div className="segmented stats-switch">
          <button className={view === 'exercises' ? 'on' : ''} onClick={() => switchView('exercises')}>
            {t('stats.view.exercises')}
          </button>
          <button className={view === 'totals' ? 'on' : ''} onClick={() => switchView('totals')}>
            {t('stats.view.totals')}
          </button>
        </div>
        {view === 'totals' && sessions && <TotalsView sessions={sessions} exercises={map} />}
        {view === 'exercises' && (
        <>
        <button className="select-btn" onClick={() => openPicker('main')}>
          {comparing && <i className="dot-swatch" style={{ background: COMPARE_COLORS[0] }} />}
          <span className="grow">{main ? itemLabel(main) : t('stats.pickExercise')}</span>
          <IconChevron size={18} className="chev down" />
        </button>
        {extraItems.map((it, i) => (
          <div key={it.ex.id + String(it.levelId)} className="select-btn static">
            <i className="dot-swatch" style={{ background: COMPARE_COLORS[i + 1] }} />
            <span className="grow">{itemLabel(it)}</span>
            <button className="icon-btn small" aria-label={t('stats.compareRemove')} onClick={() => setExtraStored(extra.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        {main && items.length < COMPARE_MAX && (
          <button className="link small compare-add" onClick={() => openPicker('compare')}>
            + {t('stats.compareAdd')}
          </button>
        )}
        {main && sessions && !comparing && <StatsView key={main.ex.id + String(main.levelId)} ex={main.ex} levelId={main.levelId} sessions={sessions} />}
        {main && sessions && comparing && <CompareView items={items} sessions={sessions} />}
        </>
        )}
      </div>
      <ExercisePicker
        open={pickerOpen}
        allowWhole
        title={pickerMode === 'compare' ? t('stats.compareAdd') : undefined}
        filter={pickerMode === 'compare' ? compatible : undefined}
        onClose={() => setPickerOpen(false)}
        onPick={(e, lvl) => {
          const v = { exId: e.id, levelId: lvl }
          if (pickerMode === 'compare') {
            if (!items.some((it) => it.ex.id === e.id && (it.levelId ?? null) === (e.levels.length ? lvl : null))) setExtraStored([...extra, v])
          } else {
            setSel(v)
            store(KEY, v)
          }
        }}
      />
    </div>
  )
}
