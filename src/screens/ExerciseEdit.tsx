import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { IconBack, IconDown, IconTrash, IconUp } from '../components/Icons'
import { db, newExercise, softDelete } from '../db'
import { t } from '../i18n'
import { EQUIPMENT, evenIntensities, FIELD_ORDER, MUSCLE_GROUPS, now, uid, type Exercise, type FieldKey } from '../model'
import { goBack } from '../router'

const PRESETS: FieldKey[][] = [['reps'], ['weight', 'reps'], ['time'], ['weight', 'time'], ['reps', 'time']]

export function ExerciseEdit({ id }: { id: string }) {
  const isNew = id === 'new'
  const stored = useLiveQuery(() => (isNew ? undefined : db.exercises.get(id)), [id])
  const [ex, setEx] = useState<Exercise | null>(isNew ? newExercise() : null)
  const [showIntensity, setShowIntensity] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isNew && stored && !ex) setEx(structuredClone(stored))
  }, [stored, isNew, ex])

  if (!ex) return <div className="screen" />

  const patch = (p: Partial<Exercise>) => setEx({ ...ex, ...p })
  const setLevels = (levels: Exercise['levels'], custom = ex.intensityCustom) => {
    if (!custom) {
      const ints = evenIntensities(levels.length)
      levels = levels.map((l, i) => ({ ...l, intensity: ints[i] }))
    }
    setEx({ ...ex, levels, intensityCustom: custom })
  }

  const save = async () => {
    if (!ex.name.trim()) return setError(t('exercise.needName'))
    if (!FIELD_ORDER.some((f) => ex.fields[f])) return setError(t('exercise.needField'))
    const levels = ex.levels.filter((l) => l.name.trim()).map((l) => ({ ...l, name: l.name.trim() }))
    await db.exercises.put({ ...ex, name: ex.name.trim(), levels, updatedAt: now() })
    goBack('/library')
  }

  const presetActive = (p: FieldKey[]) => FIELD_ORDER.every((f) => ex.fields[f] === p.includes(f))

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => goBack('/library')} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1 className="grow">{isNew ? t('exercise.title.new') : t('exercise.title.edit')}</h1>
        <button className="btn primary small" onClick={save}>
          {t('common.save')}
        </button>
      </header>

      <div className="form pad-x">
        {error && <p className="error">{error}</p>}
        <label>
          <span>{t('exercise.name')}</span>
          <input value={ex.name} placeholder={t('exercise.namePlaceholder')} onChange={(e) => patch({ name: e.target.value })} autoCapitalize="words" />
        </label>

        <div className="field">
          <span>{t('exercise.fields')}</span>
          <div className="chips">
            {FIELD_ORDER.map((f) => (
              <button key={f} className={`chip ${ex.fields[f] ? 'on' : ''}`} onClick={() => patch({ fields: { ...ex.fields, [f]: !ex.fields[f] } })}>
                {t(`field.${f}`)}
              </button>
            ))}
          </div>
          <div className="chips preset-row">
            <span className="muted small">{t('exercise.presets')}:</span>
            {PRESETS.map((p) => (
              <button
                key={p.join()}
                className={`chip small ${presetActive(p) ? 'on' : ''}`}
                onClick={() => patch({ fields: { weight: p.includes('weight'), reps: p.includes('reps'), time: p.includes('time') } })}
              >
                {p.map((f) => t(`field.${f}`)).join(' + ')}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t('exercise.side')}</span>
          <div className="segmented">
            <button className={!ex.unilateral ? 'on' : ''} onClick={() => patch({ unilateral: false })}>
              {t('exercise.bilateral')}
            </button>
            <button className={ex.unilateral ? 'on' : ''} onClick={() => patch({ unilateral: true })}>
              {t('exercise.unilateral')}
            </button>
          </div>
        </div>

        <div className="field">
          <span>{t('exercise.muscles')}</span>
          <div className="chips">
            {MUSCLE_GROUPS.map((m) => {
              const on = ex.muscleGroups.includes(m)
              return (
                <button
                  key={m}
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => patch({ muscleGroups: on ? ex.muscleGroups.filter((x) => x !== m) : [...ex.muscleGroups, m] })}
                >
                  {t(`mg.${m}`)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <span>{t('exercise.equipment')}</span>
          <div className="chips">
            {EQUIPMENT.map((e) => (
              <button key={e} className={`chip ${ex.equipment === e ? 'on' : ''}`} onClick={() => patch({ equipment: e })}>
                {t(`eq.${e}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t('exercise.levels')}</span>
          <p className="muted small">{t('exercise.levelsHint')}</p>
          {ex.levels.map((l, i) => (
            <div key={l.id} className="level-row">
              <span className="set-no">{i + 1}</span>
              <input
                value={l.name}
                placeholder={t('exercise.levelName')}
                onChange={(e) => setLevels(ex.levels.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))}
              />
              {showIntensity && (
                <span className="pct">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={l.intensity}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))
                      setLevels(ex.levels.map((x) => (x.id === l.id ? { ...x, intensity: n } : x)), true)
                    }}
                  />
                  %
                </span>
              )}
              <button className="icon-btn" disabled={i === 0} onClick={() => setLevels(swap(ex.levels, i, i - 1))}>
                <IconUp size={18} />
              </button>
              <button className="icon-btn" disabled={i === ex.levels.length - 1} onClick={() => setLevels(swap(ex.levels, i, i + 1))}>
                <IconDown size={18} />
              </button>
              <button className="icon-btn danger" onClick={() => setLevels(ex.levels.filter((x) => x.id !== l.id))}>
                <IconTrash size={18} />
              </button>
            </div>
          ))}
          <button className="link" onClick={() => setLevels([...ex.levels, { id: uid(), name: '', intensity: 100 }])}>
            + {t('exercise.addLevel')}
          </button>
          {ex.levels.length > 1 && (
            <div className="intensity-links">
              <button className="link muted small" onClick={() => setShowIntensity((x) => !x)}>
                {t('exercise.intensity')}
              </button>
              {ex.intensityCustom && (
                <button className="link muted small" onClick={() => setLevels(ex.levels, false)}>
                  {t('exercise.intensityReset')}
                </button>
              )}
            </div>
          )}
        </div>

        {!isNew && (
          <button
            className="btn danger-outline block"
            onClick={async () => {
              if (confirm(t('exercise.deleteConfirm'))) {
                await softDelete('exercises', ex.id)
                goBack('/library')
              }
            }}
          >
            {t('exercise.delete')}
          </button>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const a = [...arr]
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}
