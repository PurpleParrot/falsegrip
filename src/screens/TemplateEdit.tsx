import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { IconBack, IconDown, IconLink, IconTrash, IconUnlink, IconUp } from '../components/Icons'
import { NumInput } from '../components/NumInput'
import { db, softDelete } from '../db'
import { exerciseName, fieldLabel } from '../format'
import { useExercises } from '../hooks'
import { t } from '../i18n'
import { fieldsOf, groupSupersets, kindOf, linkWithNext, normalizeSupersets, now, splitAfter, uid, type Template, type TemplateItem } from '../model'
import { goBack } from '../router'

function blank(): Template {
  const ts = now()
  return { id: uid(), createdAt: ts, updatedAt: ts, deletedAt: null, name: '', items: [] }
}

export function TemplateEdit({ id }: { id: string }) {
  const isNew = id === 'new'
  const stored = useLiveQuery(() => (isNew ? undefined : db.templates.get(id)), [id])
  const { map } = useExercises()
  const [tpl, setTpl] = useState<Template | null>(isNew ? blank() : null)
  const [picker, setPicker] = useState(false)
  const [targetsOpen, setTargetsOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!isNew && stored && !tpl) setTpl(structuredClone(stored))
  }, [stored, isNew, tpl])

  if (!tpl) return <div className="screen" />

  const setItems = (items: TemplateItem[]) => setTpl({ ...tpl, items: normalizeSupersets(items) })
  const patchItem = (iid: string, p: Partial<TemplateItem>) => setItems(tpl.items.map((x) => (x.id === iid ? { ...x, ...p } : x)))
  const move = (i: number, d: number) => {
    const a = [...tpl.items]
    const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    setItems(a)
  }

  const save = async () => {
    const name = tpl.name.trim() || t('template.title.new')
    await db.templates.put({ ...tpl, name, updatedAt: now() })
    goBack('/library/templates')
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => goBack('/library/templates')} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1 className="grow">{isNew ? t('template.title.new') : t('template.title.edit')}</h1>
        <button className="btn primary small" onClick={save}>
          {t('common.save')}
        </button>
      </header>

      <div className="form pad-x">
        <label>
          <span>{t('template.name')}</span>
          <input value={tpl.name} placeholder={t('template.namePlaceholder')} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
        </label>

        {groupSupersets(tpl.items).map((g) => {
          const card = (it: TemplateItem) => {
          const i = tpl.items.indexOf(it)
          const next = tpl.items[i + 1]
          const linkedNext = !!it.supersetId && next?.supersetId === it.supersetId
          const ex = map.get(it.exerciseId)
          const fields = ex ? fieldsOf(ex) : []
          return (
            <div key={it.id} className="card tpl-item">
              <div className="tpl-item-head">
                <strong className="grow">{exerciseName(ex, it.levelId)}</strong>
                <button
                  className={`icon-btn ${linkedNext ? 'accent' : ''}`}
                  disabled={!next}
                  aria-label={linkedNext ? t('superset.split') : t('superset.linkNext')}
                  onClick={() => setItems(linkedNext ? splitAfter(tpl.items, i) : linkWithNext(tpl.items, i))}
                >
                  {linkedNext ? <IconUnlink size={18} /> : <IconLink size={18} />}
                </button>
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconUp size={18} />
                </button>
                <button className="icon-btn" disabled={i === tpl.items.length - 1} onClick={() => move(i, 1)}>
                  <IconDown size={18} />
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={t('template.removeItem')}
                  onClick={() => {
                    if (confirm(t('template.removeItemConfirm', { name: exerciseName(ex, it.levelId) })))
                      setItems(tpl.items.filter((x) => x.id !== it.id))
                  }}
                >
                  <IconTrash size={18} />
                </button>
              </div>
              {kindOf(ex) === 'sets' && (
              <div className="tpl-item-row">
                <span className="muted">{t('template.sets')}</span>
                <div className="stepper">
                  <button onClick={() => patchItem(it.id, { sets: Math.max(1, it.sets - 1) })}>−</button>
                  <span>{it.sets}</span>
                  <button onClick={() => patchItem(it.id, { sets: Math.min(20, it.sets + 1) })}>+</button>
                </div>
                <span className="grow" />
                <button className="link small" onClick={() => setTargetsOpen(targetsOpen === it.id ? null : it.id)}>
                  {t('template.targets')}
                </button>
              </div>
              )}
              {targetsOpen === it.id && ex && (
                <div className="tpl-targets" style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}>
                  {fields.map((f) => (
                    <label key={f}>
                      <span className="muted small">{fieldLabel(ex, f)}</span>
                      <NumInput
                        value={it.targets?.[f]}
                        decimal={f === 'weight'}
                        placeholder="–"
                        onChange={(n) => patchItem(it.id, { targets: { ...it.targets, [f]: n } })}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
          }
          return g.id ? (
            <div key={g.id} className="superset">
              <span className="superset-label">{t('superset.label')}</span>
              {g.items.map(card)}
            </div>
          ) : (
            card(g.items[0])
          )
        })}

        <button className="btn big-add" onClick={() => setPicker(true)}>
          {t('template.addExercise')}
        </button>

        {!isNew && (
          <button
            className="btn danger-outline block"
            onClick={async () => {
              if (confirm(t('template.deleteConfirm'))) {
                await softDelete('templates', tpl.id)
                goBack('/library/templates')
              }
            }}
          >
            {t('template.delete')}
          </button>
        )}
        <div style={{ height: 40 }} />
      </div>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex, levelId) => setItems([...tpl.items, { id: uid(), exerciseId: ex.id, levelId, sets: 3, targets: null }])}
      />
    </div>
  )
}
