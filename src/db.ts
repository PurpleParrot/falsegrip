import Dexie, { type Table } from 'dexie'
import {
  evenIntensities,
  now,
  uid,
  type Equipment,
  type Exercise,
  type ExerciseKind,
  type FieldKey,
  type MuscleGroup,
  type Session,
  type Settings,
  type Template,
} from './model'

class FalsegripDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  sessions!: Table<Session, string>
  settings!: Table<Settings, string>

  constructor() {
    super('falsegrip')
    this.version(1).stores({
      exercises: 'id, name, updatedAt',
      templates: 'id, name, updatedAt',
      sessions: 'id, startedAt, updatedAt',
      settings: 'id',
    })
  }
}

export const db = new FalsegripDB()

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  suggestionSource: 'last',
  bodyweight: null,
  updatedAt: 0,
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: now() })
}

// ---------- Starter library (spec 11.2) ----------

interface Seed {
  name: string
  fields?: FieldKey[]
  unilateral?: boolean
  muscles: MuscleGroup[]
  eq: Equipment
  levels?: string[]
  kind?: ExerciseKind
  options?: string[]
  /** share of body weight moved in % (see BW_PCT sources in README) */
  bw?: number
}

export const STRETCH_OPTIONS = [
  'Good Mornings', 'Hip Flexors', 'Baby Pose', 'Hamstrings', 'Chest', 'Lats', 'Pancake', 'Tailor Pose',
  'Front Split', 'Side Split', 'Bridge', 'German Hang', 'Dead Hang', 'Wrist', 'Shoulders',
]

const SEED: Seed[] = [
  { name: 'Warm-up', kind: 'note', muscles: ['fullbody'], eq: 'other' },
  { name: 'Pull-up', bw: 100, fields: ['weight', 'reps'], muscles: ['back', 'arms'], eq: 'bar' },
  { name: 'Muscle-up', bw: 100, fields: ['weight', 'reps'], muscles: ['back', 'chest', 'arms'], eq: 'bar' },
  { name: 'Dip', bw: 100, fields: ['weight', 'reps'], muscles: ['chest', 'arms'], eq: 'bar' },
  { name: 'Ring Dip', bw: 100, fields: ['weight', 'reps'], muscles: ['chest', 'arms'], eq: 'rings' },
  { name: 'Push-up', bw: 70, fields: ['weight', 'reps'], muscles: ['chest'], eq: 'floor' },
  { name: 'Pike Push-up', bw: 75, fields: ['reps'], muscles: ['shoulders'], eq: 'floor' },
  { name: 'Body Row', bw: 55, fields: ['reps'], muscles: ['back'], eq: 'rings' },
  { name: 'Hanging Leg Raise', bw: 35, fields: ['reps'], muscles: ['core'], eq: 'bar' },
  { name: 'L-Sit', bw: 100, fields: ['time'], muscles: ['core'], eq: 'floor', levels: ['Tuck', 'One Leg', 'Full'] },
  { name: 'Front Lever', bw: 100, fields: ['reps', 'time'], muscles: ['back', 'core'], eq: 'bar', levels: ['Tuck', 'Advanced Tuck', 'One Leg', 'Straddle', 'Full'] },
  { name: 'Human Flag', bw: 100, fields: ['time'], unilateral: true, muscles: ['core', 'shoulders'], eq: 'bar', levels: ['Tuck', 'Straddle', 'Full'] },
  { name: 'Handstand Hold', bw: 100, fields: ['time'], muscles: ['shoulders'], eq: 'floor', levels: ['Wall', 'Freestanding'] },
  { name: 'Deadlift', bw: 0, fields: ['weight', 'reps'], muscles: ['legs', 'back'], eq: 'barbell' },
  { name: 'Squat', bw: 0, fields: ['weight', 'reps'], muscles: ['legs'], eq: 'barbell' },
  { name: 'Lunge', bw: 0, fields: ['weight', 'reps'], unilateral: true, muscles: ['legs'], eq: 'dumbbell' },
  { name: 'Dumbbell Shoulder Press', bw: 0, fields: ['weight', 'reps'], muscles: ['shoulders'], eq: 'dumbbell' },
  { name: 'Bench Press', bw: 0, fields: ['weight', 'reps'], muscles: ['chest', 'arms'], eq: 'barbell' },
  { name: 'Butterfly', bw: 0, fields: ['weight', 'reps'], muscles: ['chest'], eq: 'machine' },
  { name: 'Biceps Curl', bw: 0, fields: ['weight', 'reps'], muscles: ['arms'], eq: 'dumbbell' },
  { name: 'Triceps Extension', bw: 0, fields: ['weight', 'reps'], muscles: ['arms'], eq: 'dumbbell' },
  { name: 'Shoulder Fly', bw: 0, fields: ['weight', 'reps'], muscles: ['shoulders'], eq: 'dumbbell' },
  { name: 'Stretching', kind: 'checklist', muscles: ['fullbody'], eq: 'floor', options: STRETCH_OPTIONS },
]

const SEED_VERSION = 6

function fromSeed(sd: Seed): Exercise {
  const intens = evenIntensities(sd.levels?.length ?? 0)
  const f = sd.fields ?? []
  return newExercise({
    name: sd.name,
    kind: sd.kind ?? 'sets',
    options: sd.options ? [...sd.options] : undefined,
    unilateral: !!sd.unilateral,
    muscleGroups: sd.muscles,
    equipment: sd.eq,
    fields: { weight: f.includes('weight'), reps: f.includes('reps'), time: f.includes('time') },
    levels: (sd.levels ?? []).map((n, i) => ({ id: uid(), name: n, intensity: intens[i] })),
    bwPct: sd.bw,
  })
}

export function newExercise(partial: Partial<Exercise> = {}): Exercise {
  const t = now()
  return {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    name: '',
    muscleGroups: [],
    equipment: 'other',
    fields: { weight: false, reps: true, time: false },
    unilateral: false,
    levels: [],
    ...partial,
  }
}

export async function ensureSeeded() {
  await db.transaction('rw', db.settings, db.exercises, db.sessions, async () => {
    const s = await getSettings()
    if (!s.seeded) {
      await db.exercises.bulkPut(SEED.map(fromSeed))
    } else if ((s.seedVersion ?? 1) < SEED_VERSION) {
      await migrate(s.seedVersion ?? 1)
    } else return
    await db.settings.put({ ...s, seeded: true, seedVersion: SEED_VERSION, updatedAt: now() })
  })
}

async function migrate(from: number) {
  if (from < 2) {
    // v2: Chin-up removed, Ring Row -> Body Row, new: Muscle-up, Human Flag, Warm-up, Stretching
    const all = await db.exercises.toArray()
    const byName = (n: string) => all.find((e) => e.name === n && !e.deletedAt)
    const t = now()
    const chin = byName('Chin-up')
    if (chin) await db.exercises.update(chin.id, { deletedAt: t, updatedAt: t })
    const row = byName('Ring Row')
    if (row && !byName('Body Row')) await db.exercises.update(row.id, { name: 'Body Row', updatedAt: t })
    for (const n of ['Muscle-up', 'Human Flag', 'Warm-up', 'Stretching']) {
      if (!byName(n)) await db.exercises.put(fromSeed(SEED.find((x) => x.name === n)!))
    }
  }
  if (from < 3) {
    // v3: new stretching list, body-weight share for volume
    const all = (await db.exercises.toArray()).filter((e) => !e.deletedAt)
    const t = now()
    for (const ex of all) {
      const sd = SEED.find((x) => x.name === ex.name)
      if (!sd) continue
      if (ex.name === 'Stretching') await db.exercises.update(ex.id, { options: [...STRETCH_OPTIONS], updatedAt: t })
      else if (sd.bw !== undefined && ex.bwPct === undefined) await db.exercises.update(ex.id, { bwPct: sd.bw, updatedAt: t })
    }
  }
  if (from < 4) {
    // v4: "Taylors Pose" -> "Tailor Pose" (exercise options and past sessions)
    const fix = (xs?: string[]) => xs?.map((x) => (x === 'Taylors Pose' ? 'Tailor Pose' : x))
    const t = now()
    for (const ex of await db.exercises.toArray())
      if (ex.options?.includes('Taylors Pose')) await db.exercises.update(ex.id, { options: fix(ex.options), updatedAt: t })
    for (const se of await db.sessions.toArray())
      if (se.blocks.some((b) => b.checked?.includes('Taylors Pose')))
        await db.sessions.update(se.id, { blocks: se.blocks.map((b) => ({ ...b, checked: fix(b.checked) })), updatedAt: t })
  }
  if (from < 5) {
    // v5: gym exercises
    const names = new Set((await db.exercises.toArray()).filter((e) => !e.deletedAt).map((e) => e.name.toLowerCase()))
    for (const n of ['Bench Press', 'Butterfly', 'Biceps Curl', 'Triceps Extension', 'Shoulder Fly'])
      if (!names.has(n.toLowerCase())) await db.exercises.put(fromSeed(SEED.find((x) => x.name === n)!))
  }
  if (from < 6) {
    // v6: Front Lever (all variants) tracks reps + time
    const t = now()
    for (const ex of await db.exercises.toArray())
      if (!ex.deletedAt && /front lever/i.test(ex.name))
        await db.exercises.update(ex.id, { fields: { ...ex.fields, reps: true, time: true }, updatedAt: t })
  }
}

// ---------- Soft delete helpers (keep tombstones for future sync) ----------

export async function softDelete(table: 'exercises' | 'templates' | 'sessions', id: string) {
  const t = now()
  await db.table(table).update(id, { deletedAt: t, updatedAt: t })
}

export const alive = <T extends { deletedAt?: number | null }>(x: T) => !x.deletedAt

// ---------- Backup ----------

export interface Backup {
  app: 'falsegrip'
  version: 1
  exportedAt: number
  exercises: Exercise[]
  templates: Template[]
  sessions: Session[]
  settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'falsegrip',
    version: 1,
    exportedAt: now(),
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    sessions: await db.sessions.toArray(),
    settings: await db.settings.toArray(),
  }
}

/** Merge a backup: per record, the newer updatedAt wins. Nothing is lost. */
export async function importBackup(b: Backup): Promise<number> {
  if (b?.app !== 'falsegrip') throw new Error('invalid')
  let count = 0
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.settings], async () => {
    for (const name of ['exercises', 'templates', 'sessions', 'settings'] as const) {
      const table = db.table(name)
      for (const rec of (b[name] ?? []) as { id: string; updatedAt: number }[]) {
        const cur = (await table.get(rec.id)) as { updatedAt: number } | undefined
        if (!cur || (rec.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
          await table.put(rec)
          count++
        }
      }
    }
  })
  return count
}
