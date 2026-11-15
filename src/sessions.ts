import { db, getSettings, softDelete } from './db'
import {
  blockFilled,
  kindOf,
  exKey,
  hasValue,
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
  const session: Session = {
    id: uid(),
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
    s.blocks = s.blocks.filter((b) => b.id !== blockId)
  })
}

export async function moveBlock(sessionId: string, blockId: string, dir: -1 | 1) {
  await updateSession(sessionId, (s) => {
    const i = s.blocks.findIndex((b) => b.id === blockId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= s.blocks.length) return
    ;[s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]]
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

/** Creates a template from a session: same exercises/levels, set count = sets used. */
export async function saveAsTemplate(session: Session, name: string): Promise<string> {
  const t = now()
  const tpl: Template = {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    name: name.trim() || session.name || 'Template',
    items: session.blocks.map((b) => ({
      id: uid(),
      exerciseId: b.exerciseId,
      levelId: b.levelId ?? null,
      sets: Math.max(1, b.sets.filter(setFilled).length || b.sets.length),
      targets: null,
    })),
  }
  await db.templates.put(tpl)
  return tpl.id
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
