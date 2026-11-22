import { describe, expect, it } from 'vitest'
import { bucketPoints, bucketStart, effectiveBucket, regression, trendPct } from './stats'

const DAY = 86400000
const pts = (...ys: number[]) => ys.map((y, i) => ({ t: i * DAY, y, sessionId: String(i) }))

describe('trendPct with few trainings', () => {
  it('compares last with first for 2–5 points', () => {
    expect(trendPct(pts(10, 8, 12))).toBeCloseTo(20)
    expect(trendPct(pts(20, 25, 15))).toBeCloseTo(-25)
    expect(trendPct(pts(5, 5))).toBe(0)
  })
  it('compares the mean of the last third with the first third', () => {
    // 6 points → thirds of 2: (10+12)/2 = 11 → (14+16)/2 = 15
    expect(trendPct(pts(10, 12, 99, 1, 14, 16))).toBeCloseTo((4 / 11) * 100)
  })
  it('returns null for fewer than two points or a zero start', () => {
    expect(trendPct(pts(10))).toBeNull()
    expect(trendPct([])).toBeNull()
    expect(trendPct(pts(0, 10))).toBeNull()
  })
})

describe('trendPct with a regression line from 10 trainings', () => {
  it('uses the fitted line, so a single outlier at the end barely matters', () => {
    // steady 10 → 19, last one a bad day
    const ys = [10, 11, 12, 13, 14, 15, 16, 17, 18, 5]
    const p = trendPct(pts(...ys))!
    expect(p).toBeGreaterThan(0)
    expect(trendPct(pts(10, 11, 12, 13, 14, 15, 16, 17, 18, 19))).toBeCloseTo(90)
  })
  it('regression finds the exact line', () => {
    const r = regression(pts(2, 4, 6, 8))!
    expect(r.b * DAY).toBeCloseTo(2)
    expect(r.a).toBeCloseTo(2)
  })
})

describe('bucketPoints', () => {
  it('averages per week starting Monday', () => {
    const mon = new Date(2026, 10, 2, 18).getTime() // Mon 2 Nov 2026
    const p = (d: number, y: number) => ({ t: mon + d * DAY, y, sessionId: String(d) })
    const b = bucketPoints([p(0, 10), p(2, 20), p(6, 30), p(7, 5)], 'week')
    expect(b.map((x) => [x.y, x.count])).toEqual([[20, 3], [5, 1]])
    expect(b[0].from).toBe(bucketStart(mon, 'week'))
    expect(new Date(b[1].from!).getDate()).toBe(9)
  })
  it('averages per calendar month', () => {
    const p = (m: number, d: number, y: number) => ({ t: new Date(2026, m, d, 18).getTime(), y, sessionId: `${m}${d}` })
    const b = bucketPoints([p(9, 1, 10), p(9, 31, 14), p(10, 1, 3)], 'month')
    expect(b.map((x) => x.y)).toEqual([12, 3])
    expect(new Date(b[1].from!).getMonth()).toBe(10)
  })
})

describe('effectiveBucket', () => {
  const mon = new Date(2026, 0, 5, 18).getTime() // Mon 5 Jan 2026
  const at = (...days: number[]) => days.map((d) => ({ t: mon + d * DAY, y: 1, sessionId: String(d) }))
  it('shows every training while there is less than 3 weeks of data', () => {
    expect(effectiveBucket(at(0, 2, 4, 9), 'week')).toBeUndefined()
    expect(effectiveBucket(at(0, 2, 4, 9), 'month')).toBeUndefined()
  })
  it('aggregates by week from 3 weeks on, also in the year view while months are few', () => {
    expect(effectiveBucket(at(0, 7, 14), 'week')).toBe('week')
    expect(effectiveBucket(at(0, 7, 14, 30), 'month')).toBe('week')
  })
  it('aggregates by month from 3 months on, but only when the range allows it', () => {
    expect(effectiveBucket(at(0, 40, 70), 'month')).toBe('month')
    expect(effectiveBucket(at(0, 40, 70), 'week')).toBe('week')
  })
})
