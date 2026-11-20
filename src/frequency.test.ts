import { describe, expect, it } from 'vitest'
import { trainingFrequency } from './stats'
import { block, ex, session, set } from './test/fixtures'

const DAY = 86400000
const NOW = 1000 * DAY

describe('trainingFrequency', () => {
  const pull = ex()
  const dip = ex({ name: 'Dip' })
  const s = (daysAgo: number, e = pull) => session(NOW - daysAgo * DAY, [block(e.id, [set({ reps: 5 })])])

  it('averages over 365 days when training started earlier', () => {
    const sessions = [s(400), ...Array.from({ length: 104 }, (_, i) => s(i * 3.5 + 1))]
    const f = trainingFrequency(sessions, NOW)!
    expect(f.perWeek).toBeCloseTo(104 / (365 / 7), 5)
    expect(f.perMonth).toBeCloseTo(104 / 12, 5)
    expect(f.partial).toBe(false)
  })

  it('starts the window at the first training if that is more recent', () => {
    const f = trainingFrequency([s(28), s(21), s(14), s(7)], NOW)!
    expect(f.perWeek).toBeCloseTo(1, 5)
    expect(f.partial).toBe(true)
  })

  it('uses at least a week, ignores deleted trainings and returns null without data', () => {
    expect(trainingFrequency([s(1), s(0)], NOW)!.perWeek).toBeCloseTo(2, 5)
    expect(trainingFrequency([{ ...s(3), deletedAt: NOW }], NOW)).toBeNull()
    expect(trainingFrequency([], NOW)).toBeNull()
  })

  it('counts only trainings with that exercise when one is given', () => {
    const f = trainingFrequency([s(28), s(14, dip), s(7, dip), s(0)], NOW, dip)!
    expect(f.perWeek).toBeCloseTo(2 / 2, 5)
  })
})

describe('trainingFrequency: empty trainings', () => {
  it('ignores trainings without recorded values', () => {
    const pull = ex()
    const empty = session(NOW - DAY, [block(pull.id, [set({})])])
    expect(trainingFrequency([empty, session(NOW - 2 * DAY, [])], NOW)).toBeNull()
  })
})
