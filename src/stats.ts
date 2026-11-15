import type { TKey } from './i18n'
import { hasValue, type Exercise, type Session, type Side, type Vals } from './model'

export type MetricId =
  | 'maxReps'
  | 'totalReps'
  | 'avgReps'
  | 'maxWeight'
  | 'volume'
  | 'e1rm'
  | 'repsAtWeight'
  | 'maxTime'
  | 'totalTime'
  | 'bestIntensity'
  | 'totalIntensity'

export interface MetricDef {
  id: MetricId
  label: TKey
  unit: string
}

const DEFS: Record<MetricId, MetricDef> = {
  maxReps: { id: 'maxReps', label: 'm.maxReps', unit: 'Reps' },
  totalReps: { id: 'totalReps', label: 'm.totalReps', unit: 'Reps' },
  avgReps: { id: 'avgReps', label: 'm.avgReps', unit: 'Reps' },
  maxWeight: { id: 'maxWeight', label: 'm.maxWeight', unit: 'kg' },
  volume: { id: 'volume', label: 'm.volume', unit: 'kg' },
  e1rm: { id: 'e1rm', label: 'm.e1rm', unit: 'kg' },
  repsAtWeight: { id: 'repsAtWeight', label: 'm.repsAtWeight', unit: 'Reps' },
  maxTime: { id: 'maxTime', label: 'm.maxTime', unit: 's' },
  totalTime: { id: 'totalTime', label: 'm.totalTime', unit: 's' },
  bestIntensity: { id: 'bestIntensity', label: 'm.bestIntensity', unit: '' },
  totalIntensity: { id: 'totalIntensity', label: 'm.totalIntensity', unit: '' },
}

/** levelId: undefined = exercise without levels; null = all levels ("ganze Übung"); string = one level */
export function metricsFor(ex: Exercise, levelId: string | null | undefined): MetricDef[] {
  if ((ex.kind ?? 'sets') !== 'sets') return []
  if (ex.levels.length && levelId === null) return [DEFS.bestIntensity, DEFS.totalIntensity]
  const f = ex.fields
  const ids: MetricId[] = []
  if (f.weight && f.reps) ids.push('maxWeight', 'volume', 'e1rm', 'repsAtWeight', 'maxReps')
  else if (f.weight) ids.push('maxWeight')
  if (f.reps && !f.weight) ids.push('maxReps', 'totalReps', 'avgReps')
  if (f.time) ids.push('maxTime', 'totalTime')
  return ids.map((i) => DEFS[i])
}

interface Entry {
  v: Vals
  intensity: number
}

const w = (v: Vals) => v.weight ?? 0
const r = (v: Vals) => v.reps ?? 0
const tm = (v: Vals) => v.time ?? 0
const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : null)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function compute(ex: Exercise, m: MetricId, entries: Entry[], atWeight?: number | null): number | null {
  if (!entries.length) return null
  const vs = entries.map((e) => e.v)
  switch (m) {
    case 'maxReps':
      return maxOf(vs.map(r))
    case 'totalReps':
      return sum(vs.map(r))
    case 'avgReps':
      return Math.round((sum(vs.map(r)) / vs.length) * 10) / 10
    case 'maxWeight':
      return maxOf(vs.map(w))
    case 'volume':
      return sum(vs.map((v) => w(v) * r(v)))
    case 'e1rm':
      return maxOf(vs.filter((v) => r(v) > 0).map((v) => Math.round(w(v) * (1 + (r(v) - 1) / 30) * 10) / 10))
    case 'repsAtWeight': {
      const xs = vs.filter((v) => w(v) === (atWeight ?? 0)).map(r)
      return xs.length ? Math.max(...xs) : null
    }
    case 'maxTime':
      return maxOf(vs.map(tm))
    case 'totalTime':
      return sum(vs.map(tm))
    case 'bestIntensity':
    case 'totalIntensity': {
      const primary = (v: Vals) => (ex.fields.time ? tm(v) : r(v))
      const xs = entries.map((e) => Math.round(primary(e.v) * e.intensity) / 100)
      return m === 'bestIntensity' ? maxOf(xs) : Math.round(sum(xs) * 10) / 10
    }
  }
}

export interface Point {
  t: number
  y: number
  sessionId: string
}
export interface Series {
  side: Side
  points: Point[]
}

export function buildSeries(
  sessions: Session[],
  ex: Exercise,
  levelId: string | null | undefined,
  metric: MetricId,
  from: number,
  atWeight?: number | null,
): Series[] {
  const sides: Side[] = ex.unilateral ? ['L', 'R'] : ['B']
  const intensityOf = (lid?: string | null) => ex.levels.find((l) => l.id === lid)?.intensity ?? 100
  const out: Series[] = sides.map((side) => ({ side, points: [] }))
  const sorted = sessions.filter((s) => !s.deletedAt && s.startedAt >= from).sort((a, b) => a.startedAt - b.startedAt)
  for (const s of sorted) {
    const blocks = s.blocks.filter(
      (b) => b.exerciseId === ex.id && (levelId === null || levelId === undefined || b.levelId === levelId),
    )
    if (!blocks.length) continue
    sides.forEach((side, i) => {
      const entries: Entry[] = []
      for (const b of blocks)
        for (const set of b.sets) {
          const v = set.sides[side]
          if (hasValue(v)) entries.push({ v: v!, intensity: intensityOf(b.levelId) })
        }
      const y = compute(ex, metric, entries, atWeight)
      if (y !== null) out[i].points.push({ t: s.startedAt, y, sessionId: s.id })
    })
  }
  return out
}

export function weightsUsed(sessions: Session[], ex: Exercise, levelId: string | null | undefined): number[] {
  const set = new Set<number>()
  for (const s of sessions) {
    if (s.deletedAt) continue
    for (const b of s.blocks) {
      if (b.exerciseId !== ex.id || (levelId && b.levelId !== levelId)) continue
      for (const st of b.sets) for (const v of Object.values(st.sides)) if (hasValue(v)) set.add(v!.weight ?? 0)
    }
  }
  return [...set].sort((a, b) => a - b)
}

export function rangeStart(range: '1m' | '3m' | '1y' | 'all'): number {
  const d = new Date()
  if (range === '1m') d.setMonth(d.getMonth() - 1)
  else if (range === '3m') d.setMonth(d.getMonth() - 3)
  else if (range === '1y') d.setFullYear(d.getFullYear() - 1)
  else return 0
  return d.getTime()
}

// ---------- CSV export (spec 6.5) ----------

export function buildCsv(sessions: Session[], exercises: Map<string, Exercise>, templates: Map<string, string>): string {
  const head = [
    'date', 'start_time', 'session_id', 'session_name', 'template', 'exercise', 'progression_level',
    'intensity_pct', 'side', 'set_no', 'weight_kg', 'reps', 'time_s', 'bodyweight_kg', 'note',
  ]
  const esc = (x: unknown) => {
    const s = x === null || x === undefined ? '' : String(x)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const rows: string[] = [head.join(',')]
  const sorted = sessions.filter((s) => !s.deletedAt).sort((a, b) => a.startedAt - b.startedAt)
  for (const s of sorted) {
    const d = new Date(s.startedAt)
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId)
      const lvl = ex?.levels.find((l) => l.id === b.levelId)
      const extra = b.text?.trim() || (b.checked?.length ? b.checked.join('; ') : '')
      if (extra) {
        rows.push(
          [date, time, s.id, s.name, s.templateId ? templates.get(s.templateId) ?? '' : '', ex?.name ?? '', '', '', '', '', '', '', '', '', extra]
            .map(esc)
            .join(','),
        )
      }
      b.sets.forEach((set, i) => {
        for (const [side, v] of Object.entries(set.sides) as [Side, Vals][]) {
          if (!hasValue(v)) continue
          rows.push(
            [
              date, time, s.id, s.name, s.templateId ? templates.get(s.templateId) ?? '' : '', ex?.name ?? '',
              lvl?.name ?? '', lvl?.intensity ?? '', side === 'B' ? '' : side, i + 1, v.weight ?? '', v.reps ?? '',
              v.time ?? '', set.bodyweight ?? '', set.note ?? '',
            ].map(esc).join(','),
          )
        }
      })
    }
  }
  return rows.join('\n')
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
