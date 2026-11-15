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

export interface Exercise extends Meta {
  name: string
  muscleGroups: MuscleGroup[]
  equipment: Equipment
  fields: Record<FieldKey, boolean>
  unilateral: boolean
  levels: Level[]
  /** true once the user edited intensities by hand; otherwise they are auto-distributed */
  intensityCustom?: boolean
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

export function evenIntensities(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(((i + 1) / n) * 100))
}

export function exKey(exerciseId: string, levelId?: string | null) {
  return levelId ? `${exerciseId}|${levelId}` : exerciseId
}
