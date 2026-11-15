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
}

export const STRETCH_OPTIONS = [
  'Hamstrings', 'Hip Flexors', 'Quads', 'Glutes', 'Adductors', 'Calves', 'Lower Back',
  'Chest', 'Shoulders', 'Lats', 'Biceps', 'Forearms', 'Wrists', 'Neck',
  'Pancake', 'Pike', 'Front Split', 'Middle Split', 'Bridge', 'German Hang', 'Shoulder Dislocates',
]

const SEED: Seed[] = [
  { name: 'Warm-up', kind: 'note', muscles: ['fullbody'], eq: 'other' },
  { name: 'Pull-up', fields: ['weight', 'reps'], muscles: ['back', 'arms'], eq: 'bar' },
  { name: 'Muscle-up', fields: ['weight', 'reps'], muscles: ['back', 'chest', 'arms'], eq: 'bar' },
  { name: 'Dip', fields: ['weight', 'reps'], muscles: ['chest', 'arms'], eq: 'bar' },
  { name: 'Ring Dip', fields: ['weight', 'reps'], muscles: ['chest', 'arms'], eq: 'rings' },
  { name: 'Push-up', fields: ['weight', 'reps'], muscles: ['chest'], eq: 'floor' },
  { name: 'Pike Push-up', fields: ['reps'], muscles: ['shoulders'], eq: 'floor' },
  { name: 'Body Row', fields: ['reps'], muscles: ['back'], eq: 'rings' },
  { name: 'Hanging Leg Raise', fields: ['reps'], muscles: ['core'], eq: 'bar' },
  { name: 'L-Sit', fields: ['time'], muscles: ['core'], eq: 'floor', levels: ['Tuck', 'One Leg', 'Full'] },
  { name: 'Front Lever', fields: ['time'], muscles: ['back', 'core'], eq: 'bar', levels: ['Tuck', 'Advanced Tuck', 'One Leg', 'Straddle', 'Full'] },
  { name: 'Human Flag', fields: ['time'], unilateral: true, muscles: ['core', 'shoulders'], eq: 'bar', levels: ['Tuck', 'Straddle', 'Full'] },
  { name: 'Handstand Hold', fields: ['time'], muscles: ['shoulders'], eq: 'floor', levels: ['Wall', 'Freestanding'] },
  { name: 'Deadlift', fields: ['weight', 'reps'], muscles: ['legs', 'back'], eq: 'barbell' },
  { name: 'Squat', fields: ['weight', 'reps'], muscles: ['legs'], eq: 'barbell' },
  { name: 'Lunge', fields: ['weight', 'reps'], unilateral: true, muscles: ['legs'], eq: 'dumbbell' },
  { name: 'Dumbbell Shoulder Press', fields: ['weight', 'reps'], muscles: ['shoulders'], eq: 'dumbbell' },
  { name: 'Stretching', kind: 'checklist', muscles: ['fullbody'], eq: 'floor', options: STRETCH_OPTIONS },
]

const SEED_VERSION = 2

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
  await db.transaction('rw', db.settings, db.exercises, async () => {
    const s = await getSettings()
    if (!s.seeded) {
      await db.exercises.bulkPut(SEED.map(fromSeed))
    } else if ((s.seedVersion ?? 1) < 2) {
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
    } else return
    await db.settings.put({ ...s, seeded: true, seedVersion: SEED_VERSION, updatedAt: now() })
  })
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
