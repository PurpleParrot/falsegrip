import { describe, expect, it } from 'vitest'
import { trendPct } from './stats'

const pts = (...ys: number[]) => ys.map((y, i) => ({ t: i, y, sessionId: String(i) }))

describe('trendPct', () => {
  it('compares the last point with the first', () => {
    expect(trendPct(pts(10, 8, 12))).toBeCloseTo(20)
    expect(trendPct(pts(20, 25, 15))).toBeCloseTo(-25)
    expect(trendPct(pts(5, 5))).toBe(0)
  })
  it('returns null for fewer than two points or a zero start', () => {
    expect(trendPct(pts(10))).toBeNull()
    expect(trendPct([])).toBeNull()
    expect(trendPct(pts(0, 10))).toBeNull()
  })
})
