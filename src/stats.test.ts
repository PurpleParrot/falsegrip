import { describe, expect, it } from 'vitest'
import { buildCsv, buildSeries, metricsFor, sessionTotals } from './stats'
import { block, ex, session, set } from './test/fixtures'

const DAY = 86400000

describe('volume', () => {
  it('counts body weight × share + added weight, per set', () => {
    const pushup = ex({ name: 'Push-up', bwPct: 70, equipment: 'floor' })
    const s = session(DAY, [block(pushup.id, [set({ weight: 0, reps: 10 }, 80), set({ weight: 10, reps: 5 }, 80)])])
    const [series] = buildSeries([s], pushup, undefined, 'volume', 0)
    // (80 × 0.7 + 0) × 10 + (80 × 0.7 + 10) × 5 = 560 + 330
    expect(series.points[0].y).toBe(890)
  })

  it('falls back to the settings body weight for old sets', () => {
    const pull = ex()
    const s = session(DAY, [block(pull.id, [set({ reps: 10 })])])
    expect(buildSeries([s], pull, undefined, 'volume', 0, { bodyweight: 75 })[0].points[0].y).toBe(750)
  })

  it('uses seconds for pure holds', () => {
    const lsit = ex({ name: 'L-Sit', fields: { weight: false, reps: false, time: true } })
    expect(metricsFor(lsit, undefined).map((m) => m.id)).toContain('timeVolume')
    const s = session(DAY, [block(lsit.id, [set({ time: 20 }, 70)])])
    expect(buildSeries([s], lsit, undefined, 'timeVolume', 0)[0].points[0].y).toBe(1400)
  })
})

describe('e1rm', () => {
  it('uses the total load for body-weight exercises', () => {
    const pull = ex()
    const s = session(DAY, [block(pull.id, [set({ weight: 20, reps: 1 }, 80)])])
    expect(buildSeries([s], pull, undefined, 'e1rm', 0)[0].points[0].y).toBe(100)
  })

  it('uses only the bar weight for gym exercises', () => {
    const squat = ex({ name: 'Squat', equipment: 'barbell', bwPct: 0 })
    const s = session(DAY, [block(squat.id, [set({ weight: 100, reps: 4 }, 80)])])
    // Epley: 100 × (1 + 3/30)
    expect(buildSeries([s], squat, undefined, 'e1rm', 0)[0].points[0].y).toBe(110)
  })
})

describe('sessionTotals', () => {
  it('counts the primary muscle group fully, others half', () => {
    const dip = ex({ name: 'Dip', muscleGroups: ['chest', 'arms'] })
    const s = session(DAY, [block(dip.id, [set({ reps: 10 }, 80)])])
    const [tot] = sessionTotals([s], new Map([[dip.id, dip]]), 0)
    expect(tot.total).toBe(800)
    expect(tot.groups).toEqual({ chest: 800, arms: 400 })
  })
})

describe('buildCsv', () => {
  it('writes the user first and escapes commas', () => {
    const pull = ex()
    const s = session(DAY, [block(pull.id, [set({ weight: 5, reps: 8 })])], { name: 'Pull, heavy' })
    const [head, row] = buildCsv([s], new Map([[pull.id, pull]]), new Map(), 'anna').split('\n')
    expect(head.startsWith('user,')).toBe(true)
    expect(row.startsWith('anna,')).toBe(true)
    expect(row).toContain('"Pull, heavy"')
  })
})
