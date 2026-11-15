import Dexie, { type Table } from 'dexie'
import {
  evenIntensities,
  now,
  uid,
  type Equipment,
  type Exercise,
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

type Seed = [name: string, fields: FieldKey[], unilateral: boolean, muscles: MuscleGroup[], eq: Equipment, levels?: string[]]

const SEED: Seed[] = [
  ['Pull-up', ['weight', 'reps'], false, ['back', 'arms'], 'bar'],
  ['Chin-up', ['weight', 'reps'], false, ['back', 'arms'], 'bar'],
  ['Dip', ['weight', 'reps'], false, ['chest', 'arms'], 'bar'],
  ['Ring Dip', ['weight', 'reps'], false, ['chest', 'arms'], 'rings'],
  ['Push-up', ['weight', 'reps'], false, ['chest'], 'floor'],
  ['Pike Push-up', ['reps'], false, ['shoulders'], 'floor'],
  ['Ring Row', ['reps'], false, ['back'], 'rings'],
  ['Hanging Leg Raise', ['reps'], false, ['core'], 'bar'],
  ['L-Sit', ['time'], false, ['core'], 'floor', ['Tuck', 'One Leg', 'Full']],
  ['Front Lever', ['time'], false, ['back', 'core'], 'bar', ['Tuck', 'Advanced Tuck', 'One Leg', 'Straddle', 'Full']],
  ['Handstand Hold', ['time'], false, ['shoulders'], 'floor', ['Wall', 'Freestanding']],
  ['Deadlift', ['weight', 'reps'], false, ['legs', 'back'], 'barbell'],
  ['Squat', ['weight', 'reps'], false, ['legs'], 'barbell'],
  ['Lunge', ['weight', 'reps'], true, ['legs'], 'dumbbell'],
  ['Dumbbell Shoulder Press', ['weight', 'reps'], false, ['shoulders'], 'dumbbell'],
]

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
    if (s.seeded) return
    const exercises = SEED.map(([name, fields, unilateral, muscleGroups, equipment, levels]) => {
      const intens = evenIntensities(levels?.length ?? 0)
      return newExercise({
        name,
        unilateral,
        muscleGroups,
        equipment,
        fields: { weight: fields.includes('weight'), reps: fields.includes('reps'), time: fields.includes('time') },
        levels: (levels ?? []).map((n, i) => ({ id: uid(), name: n, intensity: intens[i] })),
      })
    })
    await db.exercises.bulkPut(exercises)
    await db.settings.put({ ...s, seeded: true, updatedAt: now() })
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
