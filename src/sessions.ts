import { db, getSettings, softDelete } from './db'
import {
  blockFilled,
  kindOf,
  exKey,
  hasValue,
  linkWithNext,
  normalizeSupersets,
  unlink,
  now,
  setFilled,
  sidesOf,
  uid,
  type Block,
  type Exercise,
  type FieldKey,
  type Session,
  type Side,
  type Template,
  type Vals,
  type WorkSet,
} from './model'

// ---------- Last values ("letzte Werte", spec 4.1) ----------

/** key -> per set index -> per side -> most recent filled values */
export type LastValues = Map<string, Partial<Record<Side, Vals>>[]>

export function buildLastValues(sessions: Session[], before: number, excludeId?: string): LastValues {
  const map: LastValues = new Map()
  const sorted = sessions
    .filter((s) => !s.deletedAt && s.id !== excludeId && s.startedAt < before)
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const s of sorted) {
    for (const b of s.blocks) {
      const key = exKey(b.exerciseId, b.levelId)
      let arr = map.get(key)
      if (!arr) map.set(key, (arr = []))
      b.sets.forEach((set, i) => {
        const slot = (arr![i] ??= {})
        for (const [side, v] of Object.entries(set.sides) as [Side, Vals][]) {
          if (!slot[side] && hasValue(v)) slot[side] = v
        }
      })
    }
  }
  return map
}

export function suggestionFor(
  block: Block,
  index: number,
  side: Side,
  last: LastValues,
  source: 'last' | 'targets',
): Vals | undefined {
  if (source === 'targets' && block.targets && hasValue(block.targets)) return block.targets
  return last.get(exKey(block.exerciseId, block.levelId))?.[index]?.[side]
}

// ---------- Personal records ----------

/** key -> all earlier filled values (only the ones not beaten by another, see `dominates`) */
export type History = Map<string, Vals[]>

const FIELDS: FieldKey[] = ['weight', 'reps', 'time']
const num = (x?: number | null) => x ?? 0

/** a is at least as good as b in every field */
function dominates(a: Vals, b: Vals, fields: FieldKey[]): boolean {
  return fields.every((f) => num(a[f]) >= num(b[f]))
}

function addToFront(front: Vals[], v: Vals, fields: FieldKey[]): Vals[] {
  if (front.some((x) => dominates(x, v, fields))) return front
  return [...front.filter((x) => !dominates(v, x, fields)), v]
}

export function buildHistory(sessions: Session[], exercises: Map<string, Exercise>, before: number, excludeId?: string): History {
  const map: History = new Map()
  for (const s of sessions) {
    if (s.deletedAt || s.id === excludeId || s.startedAt >= before) continue
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId)
      if (!ex || kindOf(ex) !== 'sets') continue
      const fields = FIELDS.filter((f) => ex.fields[f])
      const key = exKey(b.exerciseId, b.levelId)
      let front = map.get(key) ?? []
      for (const set of b.sets) for (const v of Object.values(set.sides)) if (hasValue(v)) front = addToFront(front, v!, fields)
      map.set(key, front)
    }
  }
  return map
}

export interface PrMark {
  /** the set's values, e.g. "0|12|0": a changed value may celebrate again */
  sig: string
  /** another set in this session has exactly the same values (no celebration) */
  tie: boolean
}

const sameVals = (a: Vals, b: Vals, fields: FieldKey[]) => fields.every((f) => num(a[f]) === num(b[f]))

/**
 * Records of this session. A set gets a mark if
 * - nothing done before (history) was at least as good in every recorded field,
 * - no other set of this session is better (a later, better set takes the mark away),
 * - and, among sets with exactly the same values, it is the first.
 * Left and right are compared separately. A weight without reps/time is no record yet.
 * Exercises (or levels) without history get no marks. Keys are `${setId}-${side}`.
 */
export function personalRecords(session: Session, exercises: Map<string, Exercise>, history: History): Map<string, PrMark> {
  const groups = new Map<string, { fields: FieldKey[]; past: Vals[]; rows: { key: string; v: Vals }[] }>()
  for (const b of session.blocks) {
    const ex = exercises.get(b.exerciseId)
    if (!ex || kindOf(ex) !== 'sets') continue
    const key = exKey(b.exerciseId, b.levelId)
    const past = history.get(key)
    if (!past?.length) continue
    const fields = FIELDS.filter((f) => ex.fields[f])
    for (const set of b.sets)
      for (const [side, v] of Object.entries(set.sides) as [Side, Vals][]) {
        if (!hasValue(v) || (num(v.reps) <= 0 && num(v.time) <= 0)) continue
        const gk = `${key}#${side}`
        let g = groups.get(gk)
        if (!g) groups.set(gk, (g = { fields, past, rows: [] }))
        g.rows.push({ key: `${set.id}-${side}`, v })
      }
  }
  const out = new Map<string, PrMark>()
  for (const { fields, past, rows } of groups.values())
    rows.forEach(({ key, v }, i) => {
      if (past.some((x) => dominates(x, v, fields))) return
      const others = rows.filter((_, j) => j !== i)
      if (others.some((o) => dominates(o.v, v, fields) && !sameVals(o.v, v, fields))) return
      if (rows.slice(0, i).some((o) => sameVals(o.v, v, fields))) return
      out.set(key, { sig: fields.map((f) => num(v[f])).join('|'), tie: others.some((o) => sameVals(o.v, v, fields)) })
    })
  return out
}

// ---------- Mutations ----------

const emptySet = (ex?: Pick<Exercise, 'unilateral'>): WorkSet => ({
  id: uid(),
  sides: Object.fromEntries(sidesOf(ex ?? { unilateral: false }).map((s) => [s, {}])),
  updatedAt: now(),
})

export async function updateSession(id: string, fn: (s: Session) => void) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    fn(s)
    s.updatedAt = now()
    await db.sessions.put(s)
  })
}

function findBlock(s: Session, blockId: string) {
  return s.blocks.find((b) => b.id === blockId)
}

export async function startSession(template: Template | null, exercises: Map<string, Exercise>): Promise<string> {
  const t = now()
  // fresh superset ids per session
  const groupIds = new Map<string, string>()
  const newGroup = (g?: string | null) => {
    if (!g) return null
    if (!groupIds.has(g)) groupIds.set(g, uid())
    return groupIds.get(g)!
  }
  const user = (await getSettings()).username || undefined
  const session: Session = {
    id: uid(),
    user,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    name: template?.name ?? '',
    templateId: template?.id ?? null,
    startedAt: t,
    endedAt: null,
    note: '',
    blocks: (template?.items ?? [])
      .filter((it) => exercises.get(it.exerciseId) && !exercises.get(it.exerciseId)!.deletedAt)
      .map((it) => ({
        id: uid(),
        exerciseId: it.exerciseId,
        levelId: it.levelId ?? null,
        targets: it.targets ?? null,
        supersetId: newGroup(it.supersetId),
        sets:
          kindOf(exercises.get(it.exerciseId)) === 'sets'
            ? Array.from({ length: Math.max(1, it.sets) }, () => emptySet(exercises.get(it.exerciseId)))
            : [],
      })),
  }
  await db.sessions.put(session)
  return session.id
}

export async function addBlock(sessionId: string, ex: Exercise, levelId: string | null, setCount: number) {
  await updateSession(sessionId, (s) => {
    s.blocks.push({
      id: uid(),
      exerciseId: ex.id,
      levelId,
      targets: null,
      sets: kindOf(ex) === 'sets' ? Array.from({ length: Math.max(1, setCount) }, () => emptySet(ex)) : [],
    })
  })
}

export async function swapBlock(sessionId: string, blockId: string, ex: Exercise, levelId: string | null) {
  await updateSession(sessionId, (s) => {
    const b = findBlock(s, blockId)
    if (!b) return
    b.exerciseId = ex.id
    b.levelId = levelId
    b.targets = null
    if (kindOf(ex) !== 'sets') {
      b.sets = []
      return
    }
    if (!b.sets.length) b.sets = Array.from({ length: 3 }, () => emptySet(ex))
    // keep entered values, but adapt sides to the new exercise
    const sides = sidesOf(ex)
    b.sets = b.sets.map((set) => {
      const anyVal = Object.values(set.sides).find(hasValue) ?? {}
      return { ...set, sides: Object.fromEntries(sides.map((sd) => [sd, set.sides[sd] ?? { ...anyVal }])), updatedAt: now() }
    })
  })
}

export async function removeBlock(sessionId: string, blockId: string) {
  await updateSession(sessionId, (s) => {
    s.blocks = normalizeSupersets(s.blocks.filter((b) => b.id !== blockId))
  })
}

export async function moveBlock(sessionId: string, blockId: string, dir: -1 | 1) {
  await updateSession(sessionId, (s) => {
    const i = s.blocks.findIndex((b) => b.id === blockId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= s.blocks.length) return
    ;[s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]]
    s.blocks = normalizeSupersets(s.blocks)
  })
}

export async function linkBlockWithNext(sessionId: string, blockId: string) {
  await updateSession(sessionId, (s) => {
    s.blocks = linkWithNext(s.blocks, s.blocks.findIndex((b) => b.id === blockId))
  })
}

export async function unlinkBlock(sessionId: string, blockId: string) {
  await updateSession(sessionId, (s) => {
    s.blocks = unlink(s.blocks, s.blocks.findIndex((b) => b.id === blockId))
  })
}

export async function addSet(sessionId: string, blockId: string, ex: Exercise | undefined) {
  await updateSession(sessionId, (s) => {
    findBlock(s, blockId)?.sets.push(emptySet(ex))
  })
}

export async function deleteSet(sessionId: string, blockId: string, setId: string) {
  await updateSession(sessionId, (s) => {
    const b = findBlock(s, blockId)
    if (b) b.sets = b.sets.filter((x) => x.id !== setId)
  })
}

export async function setValue(
  sessionId: string,
  blockId: string,
  setId: string,
  side: Side,
  field: FieldKey,
  value: number | null,
) {
  const { bodyweight } = await getSettings()
  await updateSession(sessionId, (s) => {
    const set = findBlock(s, blockId)?.sets.find((x) => x.id === setId)
    if (!set) return
    const v = (set.sides[side] ??= {})
    v[field] = value
    set.bodyweight = bodyweight ?? null
    set.updatedAt = now()
  })
}

export async function applyVals(sessionId: string, blockId: string, setId: string, side: Side, vals: Vals) {
  const { bodyweight } = await getSettings()
  await updateSession(sessionId, (s) => {
    const set = findBlock(s, blockId)?.sets.find((x) => x.id === setId)
    if (!set) return
    set.sides[side] = { ...set.sides[side], ...vals }
    set.bodyweight = bodyweight ?? null
    set.updatedAt = now()
  })
}

export async function setNote(sessionId: string, blockId: string, setId: string, note: string) {
  await updateSession(sessionId, (s) => {
    const set = findBlock(s, blockId)?.sets.find((x) => x.id === setId)
    if (set) {
      set.note = note
      set.updatedAt = now()
    }
  })
}

export function sessionIsEmpty(s: Session): boolean {
  return !s.blocks.some(blockFilled)
}

export async function setBlockText(sessionId: string, blockId: string, text: string) {
  await updateSession(sessionId, (s) => {
    const b = findBlock(s, blockId)
    if (b) b.text = text
  })
}

export async function toggleChecked(sessionId: string, blockId: string, option: string) {
  await updateSession(sessionId, (s) => {
    const b = findBlock(s, blockId)
    if (!b) return
    const cur = b.checked ?? []
    b.checked = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option]
  })
}

/** Adds a new option to a checklist exercise (e.g. a custom stretch) and ticks it in the block. */
export async function addOption(sessionId: string, blockId: string, ex: Exercise, option: string) {
  const name = option.trim()
  if (!name) return
  if (!(ex.options ?? []).includes(name)) {
    await db.exercises.update(ex.id, { options: [...(ex.options ?? []), name], updatedAt: now() })
  }
  await updateSession(sessionId, (s) => {
    const b = findBlock(s, blockId)
    if (b && !(b.checked ?? []).includes(name)) b.checked = [...(b.checked ?? []), name]
  })
}

/** Save the session's exercises as a template. With `overwrite`, that template's exercises are replaced. */
export async function saveAsTemplate(session: Session, name: string, overwrite?: Template): Promise<string> {
  const t = now()
  const groupIds = new Map<string, string>()
  const items = normalizeSupersets(session.blocks).map((b) => {
    if (b.supersetId && !groupIds.has(b.supersetId)) groupIds.set(b.supersetId, uid())
    return {
      id: uid(),
      exerciseId: b.exerciseId,
      levelId: b.levelId ?? null,
      sets: Math.max(1, b.sets.filter(setFilled).length || b.sets.length),
      targets: null,
      supersetId: b.supersetId ? groupIds.get(b.supersetId)! : null,
    }
  })
  const tpl: Template = overwrite
    ? { ...overwrite, name: name.trim() || overwrite.name, items, updatedAt: t }
    : { id: uid(), createdAt: t, updatedAt: t, deletedAt: null, name: name.trim() || session.name || 'Template', items }
  await db.templates.put(tpl)
  return tpl.id
}

/** Live template with this name (case-insensitive), if any. */
export async function findTemplateByName(name: string): Promise<Template | undefined> {
  const n = name.trim().toLowerCase()
  return (await db.templates.toArray()).find((x) => !x.deletedAt && x.name.trim().toLowerCase() === n)
}

/** Returns true if the session was discarded because it was empty. */
export async function finishSession(id: string): Promise<boolean> {
  const s = await db.sessions.get(id)
  if (!s) return false
  if (sessionIsEmpty(s)) {
    await softDelete('sessions', id)
    return true
  }
  if (!s.endedAt) await updateSession(id, (x) => (x.endedAt = now()))
  return false
}

export async function deleteSession(id: string) {
  await softDelete('sessions', id)
}

const RESUME_WINDOW = 12 * 3600000

/** A session that is still running and was started within the last 12 hours (to reopen on app start). */
export async function findRunningSession(): Promise<Session | undefined> {
  return db.sessions
    .where('startedAt')
    .above(now() - RESUME_WINDOW)
    .filter((x) => !x.deletedAt && !x.endedAt)
    .last()
}
