// Data model. Every stored record carries a stable id plus
// createdAt / updatedAt / deletedAt so a later online sync (phase 3)
// can merge records without restructuring.

export type FieldKey = 'weight' | 'reps' | 'time'
/** display order: reps always last (right) */
export const FIELD_ORDER: FieldKey[] = ['weight', 'time', 'reps']

export type Equipment = 'bar' | 'rings' | 'floor' | 'barbell' | 'dumbbell' | 'machine' | 'other'
export const EQUIPMENT: Equipment[] = ['bar', 'rings', 'floor', 'barbell', 'dumbbell', 'machine', 'other']

export type MuscleGroup = 'back' | 'chest' | 'shoulders' | 'arms' | 'core' | 'legs' | 'fullbody'
export const MUSCLE_GROUPS: MuscleGroup[] = ['back', 'chest', 'shoulders', 'arms', 'core', 'legs', 'fullbody']

export interface Meta {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface Level {
  id: string
  name: string
  /** 0–100, highest level = 100 */
  intensity: number
}

/** sets = normal sets with fields; note = free text (Warm-up); checklist = pick from options (Stretching) */
export type ExerciseKind = 'sets' | 'note' | 'checklist'
export const EXERCISE_KINDS: ExerciseKind[] = ['sets', 'note', 'checklist']

export interface Exercise extends Meta {
  name: string
  kind?: ExerciseKind
  /** options for kind = checklist */
  options?: string[]
  muscleGroups: MuscleGroup[]
  equipment: Equipment
  fields: Record<FieldKey, boolean>
  unilateral: boolean
  levels: Level[]
  /** true once the user edited intensities by hand; otherwise they are auto-distributed */
  intensityCustom?: boolean
  /** share of body weight moved, 0–100 %. Used for volume. undefined = default by equipment */
  bwPct?: number
}

export interface Vals {
  weight?: number | null
  reps?: number | null
  time?: number | null
}

export type Side = 'B' | 'L' | 'R'

export interface WorkSet {
  id: string
  /** B = bilateral; L/R = unilateral sides */
  sides: Partial<Record<Side, Vals>>
  note?: string
  /** silently stored body weight at the time the set was filled */
  bodyweight?: number | null
  updatedAt: number
}

export interface Block {
  id: string
  exerciseId: string
  levelId?: string | null
  sets: WorkSet[]
  /** kind = note */
  text?: string
  /** kind = checklist */
  checked?: string[]
  /** target values copied from the template (used when suggestion source = targets) */
  targets?: Vals | null
  /** consecutive blocks with the same id form a superset */
  supersetId?: string | null
}

export interface Session extends Meta {
  name: string
  /** username at the time the session was created */
  user?: string
  templateId?: string | null
  startedAt: number
  endedAt?: number | null
  note?: string
  blocks: Block[]
}

export interface TemplateItem {
  id: string
  exerciseId: string
  levelId?: string | null
  sets: number
  targets?: Vals | null
  /** consecutive items with the same id form a superset */
  supersetId?: string | null
}

export interface Template extends Meta {
  name: string
  items: TemplateItem[]
}

export interface Settings {
  id: 'settings'
  suggestionSource: 'last' | 'targets'
  bodyweight?: number | null
  seeded?: boolean
  seedVersion?: number
  /** last time a backup file was exported */
  lastBackupAt?: number | null
  /** 'YYYY-MM' of the last monthly backup reminder */
  backupPromptMonth?: string
  /** user name / identifier, written into sessions and backups */
  username?: string
  /** color theme, default 'petrol' */
  theme?: import('./theme').ThemeId
  updatedAt: number
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* insecure context (e.g. LAN IP over http) */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function now() {
  return Date.now()
}

export function sidesOf(ex: Pick<Exercise, 'unilateral'>): Side[] {
  return ex.unilateral ? ['L', 'R'] : ['B']
}

export function fieldsOf(ex: Pick<Exercise, 'fields'>): FieldKey[] {
  return FIELD_ORDER.filter((f) => ex.fields[f])
}

export function hasValue(v?: Vals | null): boolean {
  if (!v) return false
  return [v.weight, v.reps, v.time].some((x) => x !== null && x !== undefined && !Number.isNaN(x))
}

export function setFilled(s: WorkSet): boolean {
  return Object.values(s.sides).some(hasValue)
}

export const kindOf = (ex?: Pick<Exercise, 'kind'>): ExerciseKind => ex?.kind ?? 'sets'

export function blockFilled(b: Block): boolean {
  return b.sets.some(setFilled) || !!b.text?.trim() || (b.checked?.length ?? 0) > 0
}

export function evenIntensities(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(((i + 1) / n) * 100))
}

export function exKey(exerciseId: string, levelId?: string | null) {
  return levelId ? `${exerciseId}|${levelId}` : exerciseId
}

/** body-weight share in % (default: 100 for bodyweight equipment, 0 for barbell/dumbbell/machine) */
export function bwPctOf(ex: Exercise): number {
  if (typeof ex.bwPct === 'number') return ex.bwPct
  return ['barbell', 'dumbbell', 'machine'].includes(ex.equipment) ? 0 : 100
}

// ---------- Supersets ----------

/** Clear superset ids that no longer join at least two neighbouring entries. */
export function normalizeSupersets<T extends { supersetId?: string | null }>(list: T[]): T[] {
  return list.map((x, i) => {
    if (!x.supersetId) return x
    const linked = list[i - 1]?.supersetId === x.supersetId || list[i + 1]?.supersetId === x.supersetId
    return linked ? x : { ...x, supersetId: null }
  })
}

/** Join entry i with entry i+1 (merging existing groups). */
export function linkWithNext<T extends { supersetId?: string | null }>(list: T[], i: number): T[] {
  const a = list[i]
  const b = list[i + 1]
  if (!a || !b) return list
  const id = a.supersetId ?? b.supersetId ?? uid()
  const old = b.supersetId && b.supersetId !== id ? b.supersetId : null
  return list.map((x, j) => (j === i || j === i + 1 || (old && x.supersetId === old) ? { ...x, supersetId: id } : x))
}

/** Take entry i out of its superset. */
export function unlink<T extends { supersetId?: string | null }>(list: T[], i: number): T[] {
  const id = list[i]?.supersetId
  if (!id) return list
  // split the group at i: entries after i get a fresh id so they stay together
  const fresh = uid()
  let after = false
  const out = list.map((x, j) => {
    if (j === i) {
      after = true
      return { ...x, supersetId: null }
    }
    if (after && x.supersetId === id) return { ...x, supersetId: fresh }
    return x
  })
  return normalizeSupersets(out)
}

/** Split a superset between entry i and i+1. */
export function splitAfter<T extends { supersetId?: string | null }>(list: T[], i: number): T[] {
  const id = list[i]?.supersetId
  if (!id || list[i + 1]?.supersetId !== id) return list
  const fresh = uid()
  let run = true
  const out = list.map((x, j) => {
    if (j <= i) return x
    if (run && x.supersetId === id) return { ...x, supersetId: fresh }
    run = false
    return x
  })
  return normalizeSupersets(out)
}

/** Group consecutive entries: superset runs (2+) become one group, others stay single. */
export function groupSupersets<T extends { supersetId?: string | null }>(list: T[]): { id: string | null; items: T[] }[] {
  const out: { id: string | null; items: T[] }[] = []
  for (const x of list) {
    const lastG = out[out.length - 1]
    if (x.supersetId && lastG && lastG.id === x.supersetId) lastG.items.push(x)
    else out.push({ id: x.supersetId ?? null, items: [x] })
  }
  return out.map((g) => (g.items.length < 2 ? { ...g, id: null } : g))
}
