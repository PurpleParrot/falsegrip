import { newExercise } from '../db'
import { uid, type Block, type Exercise, type Session, type Vals, type WorkSet } from '../model'

export function ex(partial: Partial<Exercise> = {}): Exercise {
  return newExercise({ name: 'Pull-up', equipment: 'bar', fields: { weight: true, reps: true, time: false }, ...partial })
}

export function set(vals: Vals, bodyweight: number | null = null): WorkSet {
  return { id: uid(), sides: { B: vals }, bodyweight, updatedAt: 0 }
}

export function block(exerciseId: string, sets: WorkSet[], extra: Partial<Block> = {}): Block {
  return { id: uid(), exerciseId, sets, ...extra }
}

export function session(startedAt: number, blocks: Block[], extra: Partial<Session> = {}): Session {
  return { id: uid(), createdAt: startedAt, updatedAt: startedAt, deletedAt: null, name: 'Push', startedAt, endedAt: startedAt + 3600000, blocks, ...extra }
}
