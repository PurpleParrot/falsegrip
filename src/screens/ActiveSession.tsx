import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { HistoryList } from '../components/HistoryList'
import {
  IconBack,
  IconChart,
  IconDown,
  IconEdit,
  IconHistory,
  IconMore,
  IconNote,
  IconSort,
  IconPlus,
  IconCopy,
  IconSwap,
  IconTimer,
  IconTrash,
  IconUp,
  IconLink,
  IconUnlink,
} from '../components/Icons'
import { NumInput } from '../components/NumInput'
import { Menu, Sheet } from '../components/Sheet'
import { StatsView } from '../components/StatsView'
import { SwipeRow } from '../components/SwipeRow'
import { db } from '../db'
import { exerciseName, fieldLabel, fmtClock, fmtDate, fmtNum, fmtTime, toLocalInput } from '../format'
import { useExercises, useSessions, useSettings } from '../hooks'
import { t } from '../i18n'
import { blockFilled, exKey, fieldsOf, groupSupersets, hasValue, kindOf, setFilled, sidesOf, type Block, type Exercise, type Session, type Side, type Template, type Vals } from '../model'
import { goBack, navigate } from '../router'
import {
  addBlock,
  addSet,
  applyVals,
  buildHistory,
  buildLastValues,
  personalRecords,
  deleteSession,
  deleteSet,
  finishSession,
  moveBlock,
  addOption,
  removeBlock,
  saveAsTemplate,
  sessionIsEmpty,
  setBlockText,
  toggleChecked,
  setNote,
  setValue,
  suggestionFor,
  swapBlock,
  updateSession,
  type LastValues,
  findTemplateByName,
  linkBlockWithNext,
  unlinkBlock,
} from '../sessions'
import { displaySeconds, useTimer } from '../timer'

export function ActiveSession({ id }: { id: string }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id], null)
  const sessions = useSessions()
  const { map: exMap } = useExercises()
  const settings = useSettings()
  const timer = useTimer()

  const [noteOpen, setNoteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reorder, setReorder] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [swapFor, setSwapFor] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<{ kind: 'history' | 'stats'; block: Block } | null>(null)
  const [tplName, setTplName] = useState<string | null>(null)
  const [tplConflict, setTplConflict] = useState<Template | null>(null)
  const [toast, setToast] = useState('')
  const [noteFor, setNoteFor] = useState<{ blockId: string; setId: string; text: string } | null>(null)

  const last = useMemo(
    () => (session && sessions ? buildLastValues(sessions, session.startedAt, session.id) : new Map()),
    [sessions, session?.startedAt, session?.id],
  ) as LastValues
  const history = useMemo(
    () => (session && sessions ? buildHistory(sessions, exMap, session.startedAt, session.id) : new Map()),
    [sessions, exMap, session?.startedAt, session?.id],
  )
  const prs = useMemo(() => (session ? personalRecords(session, exMap, history) : new Set<string>()), [session, exMap, history])

  // close an opened swipe row when tapping elsewhere
  useEffect(() => {
    if (!openRow) return
    const h = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest('[data-row-id]')
      if (el?.getAttribute('data-row-id') !== openRow) setOpenRow(null)
    }
    document.addEventListener('pointerdown', h, true)
    return () => document.removeEventListener('pointerdown', h, true)
  }, [openRow])

  if (session === null) return <div className="screen" />
  if (!session || session.deletedAt)
    return (
      <div className="screen">
        <header className="topbar">
          <button className="icon-btn" onClick={() => goBack()}>
            <IconBack />
          </button>
        </header>
        <p className="muted center pad">{t('session.notFound')}</p>
      </div>
    )

  const ended = !!session.endedAt
  const title = session.name || t('start.free')

  const finish = async () => {
    await finishSession(session.id)
    goBack('/')
  }

  /** back arrow: keep a running session running, only drop it if it is empty */
  const leave = async () => {
    if (sessionIsEmpty(session)) await deleteSession(session.id)
    goBack('/')
  }

  const saveTpl = async (overwrite?: Template) => {
    const name = tplName?.trim() || t('start.free')
    await saveAsTemplate(session, name, overwrite)
    setTplName(null)
    setTplConflict(null)
    setToast(t(overwrite ? 'session.templateOverwritten' : 'session.templateSaved', { name }))
    setTimeout(() => setToast(''), 2500)
  }

  const onPick = async (ex: Exercise, levelId: string | null) => {
    if (swapFor) {
      await swapBlock(session.id, swapFor, ex, levelId)
      setSwapFor(null)
    } else {
      const prev = last.get(exKey(ex.id, levelId))?.length
      await addBlock(session.id, ex, levelId, prev || 3)
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 80)
    }
  }

  return (
    <div className="screen session">
      <header className="topbar session-top">
        <button className="icon-btn" onClick={leave} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <button className="session-title" onClick={() => setNoteOpen((x) => !x)}>
          <strong>{title}</strong>
          <span className="muted small">
            {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}
            {session.note ? ' · ' : ''}
            {session.note && <IconNote size={12} />}
          </span>
        </button>
        <button className={`icon-btn timer-btn ${timer.running ? 'running' : ''}`} onClick={() => navigate('/timer')} aria-label={t('timer.title')}>
          <IconTimer />
          {timer.running && <span className="timer-mini">{fmtClock(Math.max(0, Math.round(displaySeconds(timer))))}</span>}
        </button>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="menu">
          <IconMore />
        </button>
      </header>

      {noteOpen && (
        <div className="session-note">
          <SessionTimes session={session} />
          <textarea
            rows={2}
            defaultValue={session.note}
            placeholder={t('session.notePlaceholder')}
            onChange={(e) => {
              const v = e.target.value
              void updateSession(session.id, (s) => (s.note = v))
            }}
          />
        </div>
      )}

      {reorder ? (
        <div className="reorder">
          {session.blocks.map((b, i) => (
            <div key={b.id} className="reorder-item">
              <span className="grow">{exerciseName(exMap.get(b.exerciseId), b.levelId)}</span>
              <button className="icon-btn" disabled={i === 0} onClick={() => moveBlock(session.id, b.id, -1)}>
                <IconUp />
              </button>
              <button className="icon-btn" disabled={i === session.blocks.length - 1} onClick={() => moveBlock(session.id, b.id, 1)}>
                <IconDown />
              </button>
            </div>
          ))}
          <button className="btn primary block" onClick={() => setReorder(false)}>
            {t('session.reorderDone')}
          </button>
        </div>
      ) : (
        <div className="cards">
          {session.blocks.length === 0 && <p className="muted center hint">{t('session.hint')}</p>}
          {groupSupersets(session.blocks).map((g) => {
            const card = (b: Block) => {
              const i = session.blocks.indexOf(b)
              const next = session.blocks[i + 1]
              return (
            <ExerciseCard
              key={b.id}
              session={session}
              block={b}
              inSuperset={!!g.id}
              canLinkNext={!!next && (!b.supersetId || next.supersetId !== b.supersetId)}
              onLinkNext={() => linkBlockWithNext(session.id, b.id)}
              onUnlink={() => unlinkBlock(session.id, b.id)}
              ex={exMap.get(b.exerciseId)}
              last={last}
              prs={prs}
              source={settings.suggestionSource}
              openRow={openRow}
              setOpenRow={setOpenRow}
              onSwap={() => {
                setSwapFor(b.id)
                setPickerOpen(true)
              }}
              onOverlay={(kind) => setOverlay({ kind, block: b })}
              onNote={(setId, text) => setNoteFor({ blockId: b.id, setId, text })}
            />
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
          <button className="btn big-add" onClick={() => setPickerOpen(true)}>
            {t('session.addExercise')}
          </button>
          <div style={{ height: 96 }} />
        </div>
      )}

      {!reorder && (
        <div className="finish-bar">
          <button className="btn primary finish" onClick={finish}>
            {ended ? t('session.done') : t('session.finish')}
          </button>
        </div>
      )}

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: t('session.reorder'), icon: <IconSort />, onClick: () => setReorder(true) },
          { label: t('session.editTime'), icon: <IconEdit />, onClick: () => setEditOpen(true) },
          { label: t('session.saveTemplate'), icon: <IconCopy />, onClick: () => setTplName(session.name || t('start.free')) },
          {
            label: t('session.delete'),
            icon: <IconTrash />,
            danger: true,
            onClick: async () => {
              if (confirm(t('session.deleteConfirm'))) {
                await deleteSession(session.id)
                goBack('/')
              }
            },
          },
        ]}
      />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setSwapFor(null)
        }}
        onPick={onPick}
      />

      <EditSessionSheet open={editOpen} onClose={() => setEditOpen(false)} session={session} />

      <Sheet
        open={!!overlay}
        onClose={() => setOverlay(null)}
        full
        title={
          overlay
            ? `${overlay.kind === 'history' ? t('history.title') : t('ministats.title')} · ${exerciseName(exMap.get(overlay.block.exerciseId), overlay.block.levelId)}`
            : ''
        }
      >
        {overlay && exMap.get(overlay.block.exerciseId) && sessions && (
          overlay.kind === 'history' ? (
            <HistoryList ex={exMap.get(overlay.block.exerciseId)!} sessions={sessions} excludeId={session.id} />
          ) : (
            <StatsView
              ex={exMap.get(overlay.block.exerciseId)!}
              levelId={overlay.block.levelId ?? undefined}
              sessions={sessions}
              compact
            />
          )
        )}
      </Sheet>

      <Sheet
        open={tplName !== null}
        onClose={() => {
          setTplName(null)
          setTplConflict(null)
        }}
        title={t('session.saveTemplate')}
      >
        {tplName !== null && (
          <div className="form">
            <label>
              <span>{t('template.name')}</span>
              <input
                autoFocus
                value={tplName}
                onChange={(e) => {
                  setTplName(e.target.value)
                  setTplConflict(null)
                }}
              />
            </label>
            {tplConflict ? (
              <>
                <p className="small">{t('session.templateExists', { name: tplConflict.name })}</p>
                <button className="btn primary block" onClick={() => saveTpl(tplConflict)}>
                  {t('session.templateOverwrite')}
                </button>
                <button className="btn block" onClick={() => saveTpl()}>
                  {t('session.templateSaveNew')}
                </button>
              </>
            ) : (
              <button
                className="btn primary block"
                onClick={async () => {
                  const existing = await findTemplateByName(tplName.trim() || t('start.free'))
                  if (existing) setTplConflict(existing)
                  else await saveTpl()
                }}
              >
                {t('common.save')}
              </button>
            )}
          </div>
        )}
      </Sheet>

      {toast && <div className="toast">{toast}</div>}

      <Sheet open={!!noteFor} onClose={() => setNoteFor(null)} title={t('session.setNote')}>
        {noteFor && (
          <div className="form">
            <textarea
              autoFocus
              rows={3}
              defaultValue={noteFor.text}
              onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })}
            />
            <button
              className="btn primary block"
              onClick={async () => {
                await setNote(session.id, noteFor.blockId, noteFor.setId, noteFor.text.trim())
                setNoteFor(null)
              }}
            >
              {t('common.save')}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function ExerciseCard({
  session,
  block,
  ex,
  last,
  prs,
  source,
  openRow,
  setOpenRow,
  onSwap,
  onOverlay,
  onNote,
  inSuperset,
  canLinkNext,
  onLinkNext,
  onUnlink,
}: {
  session: Session
  block: Block
  inSuperset: boolean
  canLinkNext: boolean
  onLinkNext: () => void
  onUnlink: () => void
  ex: Exercise | undefined
  last: LastValues
  prs: Set<string>
  source: 'last' | 'targets'
  openRow: string | null
  setOpenRow: (id: string | null) => void
  onSwap: () => void
  onOverlay: (k: 'history' | 'stats') => void
  onNote: (setId: string, text: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const fields = ex ? fieldsOf(ex) : []
  const sides: Side[] = ex ? sidesOf(ex) : ['B']
  const cols = `44px repeat(${fields.length}, minmax(0, 1fr)) 40px`

  return (
    <section className="card ex-card">
      <div className="ex-head">
        <h3>{exerciseName(ex, block.levelId)}</h3>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="menu">
          <IconMore />
        </button>
      </div>

      {ex && kindOf(ex) === 'note' && (
        <div className="block-body">
          <textarea
            rows={3}
            defaultValue={block.text ?? ''}
            placeholder={t('session.notePlaceholderBlock')}
            onChange={(e) => setBlockText(session.id, block.id, e.target.value)}
          />
        </div>
      )}

      {ex && kindOf(ex) === 'checklist' && <ChecklistBody session={session} block={block} ex={ex} />}

      {ex && kindOf(ex) === 'sets' && (
        <div className="set-grid-head" style={{ gridTemplateColumns: cols }}>
          <span />
          {fields.map((f) => (
            <span key={f}>{fieldLabel(ex, f)}</span>
          ))}
          <span />
        </div>
      )}

      {ex &&
        kindOf(ex) === 'sets' &&
        block.sets.map((set, i) => (
          <div key={set.id} className={`set ${ex.unilateral ? 'uni' : ''} ${setFilled(set) ? 'filled' : ''}`}>
            {sides.map((side, si) => {
              const v: Vals = set.sides[side] ?? {}
              const sug = suggestionFor(block, i, side, last, source)
              const rowId = `${set.id}-${side}`
              return (
                <SwipeRow
                  key={side}
                  id={rowId}
                  openId={openRow}
                  setOpenId={setOpenRow}
                  canApply={hasValue(sug)}
                  onApply={() => sug && applyVals(session.id, block.id, set.id, side, pick(sug, fields))}
                  onDelete={() => deleteSet(session.id, block.id, set.id)}
                >
                  <div className="set-row" style={{ gridTemplateColumns: cols }}>
                    <div className="set-label">
                      {si === 0 ? <span className={`set-no ${hasValue(v) ? 'done' : ''}`}>{i + 1}</span> : <span className="set-no ghost" />}
                      {side !== 'B' && <span className="side-tag">{side}</span>}
                      {prs.has(rowId) && (
                        <span className="pr-badge" title={t('session.pr')} aria-label={t('session.pr')}>
                          🏆
                        </span>
                      )}
                    </div>
                    {fields.map((f) => (
                      <NumInput
                        key={f}
                        value={v[f]}
                        decimal={f === 'weight'}
                        placeholder={sug && sug[f] != null ? fmtNum(sug[f]) : '–'}
                        ariaLabel={`${i + 1} ${side} ${f}`}
                        onChange={(n) => setValue(session.id, block.id, set.id, side, f, n)}
                      />
                    ))}
                    {si === 0 ? (
                      <button className={`icon-btn note-btn ${set.note ? 'has' : ''}`} onClick={() => onNote(set.id, set.note ?? '')} aria-label={t('col.note')}>
                        <IconNote size={18} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </SwipeRow>
              )
            })}
            {set.note && <div className="set-note muted small">{set.note}</div>}
          </div>
        ))}

      <div className="ex-foot">
        {kindOf(ex) === 'sets' && (
          <button className="link" onClick={() => addSet(session.id, block.id, ex)}>
            + {t('session.addSet')}
          </button>
        )}
        <span className="grow" />
        <button className="icon-btn" onClick={() => onOverlay('history')} aria-label={t('history.title')}>
          <IconHistory size={20} />
        </button>
        {kindOf(ex) === 'sets' && (
          <button className="icon-btn" onClick={() => onOverlay('stats')} aria-label={t('ministats.title')}>
            <IconChart size={20} />
          </button>
        )}
      </div>

      <Menu
        open={menu}
        onClose={() => setMenu(false)}
        title={exerciseName(ex, block.levelId)}
        items={[
          { label: t('session.swapExercise'), icon: <IconSwap />, onClick: onSwap },
          ...(canLinkNext ? [{ label: t('superset.linkNext'), icon: <IconLink />, onClick: onLinkNext }] : []),
          ...(inSuperset ? [{ label: t('superset.unlink'), icon: <IconUnlink />, onClick: onUnlink }] : []),
          {
            label: t('session.removeExercise'),
            icon: <IconTrash />,
            danger: true,
            onClick: () => {
              const name = exerciseName(ex, block.levelId)
              const msg = blockFilled(block) ? t('session.removeExerciseConfirmFilled', { name }) : t('session.removeExerciseConfirm', { name })
              if (confirm(msg)) void removeBlock(session.id, block.id)
            },
          },
        ]}
      />
    </section>
  )
}

function ChecklistBody({ session, block, ex }: { session: Session; block: Block; ex: Exercise }) {
  const [adding, setAdding] = useState<string | null>(null)
  const checked = block.checked ?? []
  // options of the exercise, plus anything ticked earlier that was removed from the list since
  const options = [...(ex.options ?? []), ...checked.filter((c) => !(ex.options ?? []).includes(c))]
  return (
    <div className="block-body">
      <div className="chips">
        {options.map((o) => (
          <button key={o} className={`chip ${checked.includes(o) ? 'on' : ''}`} onClick={() => toggleChecked(session.id, block.id, o)}>
            {o}
          </button>
        ))}
        {adding === null ? (
          <button className="chip add-chip" onClick={() => setAdding('')} aria-label={t('session.addOption')}>
            <IconPlus size={16} />
          </button>
        ) : (
          <form
            className="add-option"
            onSubmit={async (e) => {
              e.preventDefault()
              await addOption(session.id, block.id, ex, adding)
              setAdding(null)
            }}
          >
            <input
              autoFocus
              value={adding}
              placeholder={t('session.addOptionPlaceholder')}
              onChange={(e) => setAdding(e.target.value)}
              onBlur={() => !adding.trim() && setAdding(null)}
            />
            <button className="btn primary small" type="submit">
              OK
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function pick(v: Vals, fields: string[]): Vals {
  const out: Vals = {}
  for (const f of fields) {
    const k = f as keyof Vals
    if (v[k] !== undefined && v[k] !== null) out[k] = v[k]
  }
  return out
}

const hhmm = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
/** timestamp on the same day as `day` at "HH:MM" */
const atTime = (day: number, v: string) => {
  const [h, m] = v.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** Start (left) and end (right) time of the session, shown above the session note. */
function SessionTimes({ session }: { session: Session }) {
  const [start, setStart] = useState(hhmm(session.startedAt))
  const [end, setEnd] = useState(session.endedAt ? hhmm(session.endedAt) : '')
  useEffect(() => setStart(hhmm(session.startedAt)), [session.startedAt])
  useEffect(() => setEnd(session.endedAt ? hhmm(session.endedAt) : ''), [session.endedAt])

  return (
    <div className="session-times">
      <label>
        <span className="muted small">{t('session.start')}</span>
        <input
          type="time"
          value={start}
          onChange={(e) => {
            const v = e.target.value
            setStart(v)
            if (!v) return
            void updateSession(session.id, (x) => {
              x.startedAt = atTime(x.startedAt, v)
              if (x.endedAt && x.endedAt < x.startedAt) x.endedAt = x.startedAt
            })
          }}
        />
      </label>
      <label>
        <span className="muted small">{t('session.end')}</span>
        <input
          type="time"
          value={end}
          placeholder="–"
          onChange={(e) => {
            const v = e.target.value
            setEnd(v)
            if (!v) return
            void updateSession(session.id, (x) => {
              let e2 = atTime(x.startedAt, v)
              if (e2 < x.startedAt) e2 += 86400000 // ends after midnight
              x.endedAt = e2
            })
          }}
        />
      </label>
    </div>
  )
}

function EditSessionSheet({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const [name, setName] = useState(session.name)
  const [start, setStart] = useState(toLocalInput(session.startedAt))
  const [end, setEnd] = useState(session.endedAt ? toLocalInput(session.endedAt) : '')
  useEffect(() => {
    if (open) {
      setName(session.name)
      setStart(toLocalInput(session.startedAt))
      setEnd(session.endedAt ? toLocalInput(session.endedAt) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} title={t('session.editTime')}>
      <div className="form">
        <label>
          <span>{t('session.name')}</span>
          <input value={name} placeholder={t('start.free')} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>{t('session.start')}</span>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          <span>{t('session.end')}</span>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button
          className="btn primary block"
          onClick={async () => {
            const s = new Date(start).getTime()
            const e = end ? new Date(end).getTime() : null
            await updateSession(session.id, (x) => {
              x.name = name.trim()
              if (!Number.isNaN(s)) x.startedAt = s
              x.endedAt = e && !Number.isNaN(e) ? Math.max(e, x.startedAt) : x.endedAt
            })
            onClose()
          }}
        >
          {t('common.save')}
        </button>
      </div>
    </Sheet>
  )
}

