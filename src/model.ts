// Data model. Every stored record carries a stable id plus
// createdAt / updatedAt / deletedAt so a later online sync (phase 3)
// can merge records without restructuring.

export type FieldKey = 'weight' | 'reps' | 'time'
export const FIELD_ORDER: FieldKey[] = ['weight', 'reps', 'time']

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
}

export interface Session extends Meta {
  name: string
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
