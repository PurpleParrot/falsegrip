import type { TKey } from './i18n'
import { bwPctOf, hasValue, type Exercise, type MuscleGroup, type Session, type Side, type Vals } from './model'

export type MetricId =
  | 'maxReps'
  | 'totalReps'
  | 'avgReps'
  | 'maxWeight'
  | 'volume'
  | 'timeVolume'
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
  timeVolume: { id: 'timeVolume', label: 'm.timeVolume', unit: 'kg·s' },
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
  const f = ex.fields
  // volume = load × reps (or × seconds for holds); load = body weight × share + added weight
  const vol: MetricId | null = f.reps ? 'volume' : f.time ? 'timeVolume' : null
  const ids: MetricId[] = []
  if (ex.levels.length && levelId === null) ids.push('bestIntensity', 'totalIntensity')
  else {
    if (f.weight && f.reps) ids.push('maxWeight', 'e1rm', 'repsAtWeight', 'maxReps')
    else if (f.weight) ids.push('maxWeight')
    if (f.reps && !f.weight) ids.push('maxReps', 'totalReps', 'avgReps')
    if (f.time) ids.push('maxTime', 'totalTime')
  }
  if (vol) ids.splice(ids[0] === 'maxWeight' ? 1 : ids.length, 0, vol)
  return ids.map((i) => DEFS[i])
}

interface Entry {
  v: Vals
  intensity: number
  /** body weight for this set (stored with the set, else current setting) */
  bw: number
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
    case 'timeVolume': {
      const share = bwPctOf(ex) / 100
      const amount = m === 'volume' ? r : tm
      return Math.round(sum(entries.map((e) => (e.bw * share + w(e.v)) * amount(e.v))))
    }
    case 'e1rm': {
      // Epley on the total load: body weight × share + added weight (gym exercises: share 0)
      const share = bwPctOf(ex) / 100
      return maxOf(
        entries.filter((e) => r(e.v) > 0).map((e) => Math.round((e.bw * share + w(e.v)) * (1 + (r(e.v) - 1) / 30) * 10) / 10),
      )
    }
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
  /** weekly/monthly mean: start of the week/month and number of trainings in it */
  from?: number
  count?: number
}
export interface Series {
  side: Side
  points: Point[]
  /** set in comparison mode */
  key?: string
  label?: string
  color?: string
}

export interface SeriesOpts {
  atWeight?: number | null
  /** fallback body weight (settings) for sets stored without one */
  bodyweight?: number | null
  /** comparison mode: merge L and R into one line */
  combineSides?: boolean
}

export function buildSeries(
  sessions: Session[],
  ex: Exercise,
  levelId: string | null | undefined,
  metric: MetricId,
  from: number,
  opts: SeriesOpts = {},
): Series[] {
  const { atWeight, bodyweight, combineSides } = opts
  const sides: Side[] = ex.unilateral && !combineSides ? ['L', 'R'] : ['B']
  const sidesOfSet: Side[] = ex.unilateral ? (combineSides ? ['L', 'R'] : []) : ['B']
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
        for (const set of b.sets)
          for (const sd of side === 'B' && sidesOfSet.length ? sidesOfSet : [side]) {
            const v = set.sides[sd]
            if (hasValue(v)) entries.push({ v: v!, intensity: intensityOf(b.levelId), bw: set.bodyweight ?? bodyweight ?? 0 })
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

// ---------- Trend ----------

/** Least-squares line y = a + b·t through the points (t in ms). */
export function regression(points: Point[]): { a: number; b: number } | null {
  const n = points.length
  if (n < 2) return null
  const mt = points.reduce((s, p) => s + p.t, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.t - mt) * (p.y - my)
    den += (p.t - mt) ** 2
  }
  if (den === 0) return null
  const b = num / den
  return { a: my - b * mt, b }
}

/** Trainings from which on the trend uses a regression line instead of averages. */
export const REGRESSION_MIN = 10

/**
 * Change over the range in %, from the individual trainings (not the weekly/monthly means):
 * ≥ 10 points → regression line, value at the last vs. the first training;
 * fewer → mean of the last third vs. mean of the first third (2 points: last vs. first).
 * null if not computable (< 2 points, start ≤ 0).
 */
export function trendPct(points: Point[]): number | null {
  const n = points.length
  if (n < 2) return null
  let start: number
  let end: number
  const reg = n >= REGRESSION_MIN ? regression(points) : null
  if (reg) {
    start = reg.a + reg.b * points[0].t
    end = reg.a + reg.b * points[n - 1].t
  } else {
    const k = Math.max(1, Math.floor(n / 3))
    const mean = (ps: Point[]) => ps.reduce((s, p) => s + p.y, 0) / ps.length
    start = mean(points.slice(0, k))
    end = mean(points.slice(n - k))
  }
  if (!(start > 0)) return null
  return ((end - start) / start) * 100
}

// ---------- Weekly / monthly means for the chart ----------

export type Bucket = 'week' | 'month'

/** 1 M / 3 M → one point per week, 1 J / Alles → one per month. */
export const bucketFor = (range: '1m' | '3m' | '1y' | 'all'): Bucket => (range === '1m' || range === '3m' ? 'week' : 'month')

/** Start of the week (Monday 0:00) or month containing t, local time. */
export function bucketStart(t: number, bucket: Bucket): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  if (bucket === 'month') d.setDate(1)
  else d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Mean value per week / month; the point sits at the mean time of its trainings, `from` = bucket start. */
export function bucketPoints(points: Point[], bucket: Bucket): Point[] {
  const groups = new Map<number, Point[]>()
  for (const p of points) {
    const k = bucketStart(p.t, bucket)
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, g]) => ({
      t: g.reduce((s, p) => s + p.t, 0) / g.length,
      y: Math.round((g.reduce((s, p) => s + p.y, 0) / g.length) * 10) / 10,
      sessionId: g[g.length - 1].sessionId,
      from,
      count: g.length,
    }))
}

// ---------- Training frequency ----------

const DAY = 86_400_000

export interface Frequency {
  perWeek: number
  perMonth: number
  /** start of the window: 365 days ago, or the first matching training if that is later */
  since: number
  /** true when the window is shorter than 365 days (first training less than a year ago) */
  partial: boolean
}

/**
 * Average trainings per week / month over the last 365 days. If the first training is more recent,
 * the window starts there (at least 7 days), so a new user isn't averaged over empty months.
 * `ex` given: only trainings with recorded sets of that exercise (and level, if a string).
 */
export function trainingFrequency(
  sessions: Session[],
  now = Date.now(),
  ex?: Exercise,
  levelId?: string | null,
): Frequency | null {
  const from = now - 365 * DAY
  // a training counts once something was recorded (sets, or text / checked options); empty ones don't
  const recorded = (b: Session['blocks'][number]) =>
    b.sets.some((st) => Object.values(st.sides).some(hasValue)) || !!b.text?.trim() || !!b.checked?.length
  const relevant = sessions.filter(
    (s) =>
      !s.deletedAt &&
      s.startedAt <= now &&
      s.blocks.some((b) => recorded(b) && (!ex || (b.exerciseId === ex.id && (!levelId || b.levelId === levelId)))),
  )
  const n = relevant.filter((s) => s.startedAt >= from).length
  if (!n) return null
  const since = Math.max(from, Math.min(...relevant.map((s) => s.startedAt)))
  const days = Math.max(7, (now - since) / DAY)
  return {
    perWeek: n / (days / 7),
    perMonth: n / (days / (365 / 12)),
    since,
    partial: since > from,
  }
}

// ---------- Totals across all exercises ----------

export interface SessionTotal {
  t: number
  sessionId: string
  /** kg × reps over all exercises that record reps */
  total: number
  /** same, per muscle group: the first (primary) group counts fully, further groups half */
  groups: Partial<Record<MuscleGroup, number>>
}

export function sessionTotals(sessions: Session[], exercises: Map<string, Exercise>, from: number, bodyweight?: number | null): SessionTotal[] {
  const out: SessionTotal[] = []
  const sorted = sessions.filter((s) => !s.deletedAt && s.startedAt >= from).sort((a, b) => a.startedAt - b.startedAt)
  for (const s of sorted) {
    let total = 0
    const groups: Partial<Record<MuscleGroup, number>> = {}
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId)
      if (!ex || (ex.kind ?? 'sets') !== 'sets' || !ex.fields.reps) continue
      const share = bwPctOf(ex) / 100
      let vol = 0
      for (const set of b.sets) {
        const bw = set.bodyweight ?? bodyweight ?? 0
        for (const v of Object.values(set.sides)) if (hasValue(v) && v!.reps) vol += (bw * share + (v!.weight ?? 0)) * v!.reps
      }
      if (!vol) continue
      total += vol
      ex.muscleGroups.forEach((g, i) => (groups[g] = (groups[g] ?? 0) + (i === 0 ? vol : vol / 2)))
    }
    if (total > 0) out.push({ t: s.startedAt, sessionId: s.id, total: Math.round(total), groups })
  }
  return out
}

// ---------- CSV export (spec 6.5) ----------

export function buildCsv(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  templates: Map<string, string>,
  username = '',
): string {
  const head = [
    'user', 'date', 'start_time', 'session_id', 'session_name', 'template', 'exercise', 'progression_level',
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
    const user = username || s.user || ''
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId)
      const lvl = ex?.levels.find((l) => l.id === b.levelId)
      const extra = b.text?.trim() || (b.checked?.length ? b.checked.join('; ') : '')
      if (extra) {
        rows.push(
          [user, date, time, s.id, s.name, s.templateId ? templates.get(s.templateId) ?? '' : '', ex?.name ?? '', '', '', '', '', '', '', '', '', extra]
            .map(esc)
            .join(','),
        )
      }
      b.sets.forEach((set, i) => {
        for (const [side, v] of Object.entries(set.sides) as [Side, Vals][]) {
          if (!hasValue(v)) continue
          rows.push(
            [
              user, date, time, s.id, s.name, s.templateId ? templates.get(s.templateId) ?? '' : '', ex?.name ?? '',
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

/** filename-safe version of the username, '' if none */
export function fileUser(name?: string): string {
  const slug = (name ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? slug + '-' : ''
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
