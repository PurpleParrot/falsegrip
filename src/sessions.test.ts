import { describe, expect, it } from 'vitest'
import { buildHistory, buildLastValues, personalRecords } from './sessions'
import { block, ex, session, set } from './test/fixtures'

const DAY = 86400000

describe('buildLastValues', () => {
  it('takes the most recent filled value per set index', () => {
    const pull = ex()
    const old = session(DAY, [block(pull.id, [set({ reps: 5 }), set({ reps: 4 })])])
    const recent = session(2 * DAY, [block(pull.id, [set({ reps: 8 }), set({})])])
    const last = buildLastValues([old, recent], 3 * DAY)
    expect(last.get(pull.id)?.[0]?.B?.reps).toBe(8)
    expect(last.get(pull.id)?.[1]?.B?.reps).toBe(4) // empty set in the recent session is skipped
  })
})

describe('personalRecords', () => {
  const pull = ex()
  const map = new Map([[pull.id, pull]])
  const past = session(DAY, [block(pull.id, [set({ weight: 0, reps: 10 }), set({ weight: 10, reps: 5 })])])
  const prsOf = (vals: Parameters<typeof set>[0][]) => {
    const cur = session(2 * DAY, [block(pull.id, vals.map((v) => set(v)))])
    const prs = personalRecords(cur, map, buildHistory([past, cur], map, cur.startedAt, cur.id))
    return cur.blocks[0].sets.map((st) => prs.has(`${st.id}-B`))
  }

  it('marks more reps at a weight and more weight', () => {
    expect(prsOf([{ weight: 0, reps: 11 }, { weight: 15, reps: 1 }])).toEqual([true, true])
  })

  it('does not mark sets that were matched or beaten before', () => {
    expect(prsOf([{ weight: 0, reps: 10 }, { weight: 5, reps: 5 }])).toEqual([false, false])
  })

  it('marks a repeated record only once in a session', () => {
    expect(prsOf([{ weight: 0, reps: 12 }, { weight: 0, reps: 12 }])).toEqual([true, false])
  })

  it('ignores a weight without reps yet', () => {
    expect(prsOf([{ weight: 20 }])).toEqual([false])
  })

  it('gives no marks to a first-ever exercise', () => {
    const fresh = ex({ name: 'Muscle-up' })
    const m = new Map([[fresh.id, fresh]])
    const cur = session(2 * DAY, [block(fresh.id, [set({ reps: 3 })])])
    expect(personalRecords(cur, m, buildHistory([cur], m, cur.startedAt, cur.id)).size).toBe(0)
  })
})
