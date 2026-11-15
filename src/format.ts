import { LOCALE, t } from './i18n'
import type { Exercise, FieldKey, Vals } from './model'

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return n.toLocaleString(LOCALE, { maximumFractionDigits: digits })
}

export function parseNum(s: string): number | null {
  const clean = s.replace(',', '.').trim()
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return t('common.min', { n: min })
  return t('common.h', { h: Math.floor(min / 60), m: min % 60 })
}

export function fmtClock(totalSeconds: number, tenths = false): string {
  const neg = totalSeconds < 0
  const s = Math.abs(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const pad = (x: number) => String(x).padStart(2, '0')
  let out = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
  if (tenths) out += `,${Math.floor((s * 10) % 10)}`
  return (neg ? '-' : '') + out
}

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateShort = (ts: number) => new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
export const fmtMonth = (ts: number) => new Date(ts).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
export const fmtWeekday = (ts: number) => new Date(ts).toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '')
export const fmtMonthShort = (ts: number) => new Date(ts).toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '')

/** For <input type="datetime-local"> */
export function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function exerciseName(ex: Exercise | undefined, levelId?: string | null): string {
  if (!ex) return t('session.unknownExercise')
  if (levelId) {
    const lvl = ex.levels.find((l) => l.id === levelId)
    if (lvl) return `${lvl.name} ${ex.name}`
  }
  return ex.name
}

export function fmtVals(ex: Exercise, v: Vals | undefined | null): string {
  if (!v) return ''
  const parts: string[] = []
  const f = ex.fields
  if (f.weight && v.weight) parts.push(`${isBodyweight(ex) ? '+' : ''}${fmtNum(v.weight)} kg`)
  if (f.reps && v.reps != null) parts.push(`${fmtNum(v.reps)}${f.weight && v.weight ? '' : ' Reps'}`)
  if (f.time && v.time != null) parts.push(`${fmtNum(v.time)} s`)
  if (f.weight && v.weight && f.reps && v.reps != null) return `${parts[0]} × ${parts.slice(1).join(' · ')}`
  return parts.join(' · ')
}

/** Bodyweight exercise = weight means added weight ("+kg"). */
export function isBodyweight(ex: Exercise): boolean {
  return !['barbell', 'dumbbell', 'machine'].includes(ex.equipment)
}

export function fieldLabel(ex: Exercise, f: FieldKey): string {
  if (f === 'weight') return isBodyweight(ex) ? t('col.weight') : t('col.weightGym')
  return f === 'reps' ? t('col.reps') : t('col.time')
}
