import { describe, expect, it } from 'vitest'
import { bwPctOf, groupSupersets, linkWithNext, normalizeSupersets, splitAfter, unlink } from './model'
import { ex } from './test/fixtures'

type Item = { n: number; supersetId?: string | null }
const list = (...ids: (string | null)[]): Item[] => ids.map((supersetId, n) => ({ n, supersetId }))
const ids = (xs: Item[]) => xs.map((x) => x.supersetId ?? null)

describe('supersets', () => {
  it('linkWithNext joins two singles', () => {
    const out = linkWithNext(list(null, null, null), 0)
    expect(out[0].supersetId).toBeTruthy()
    expect(out[0].supersetId).toBe(out[1].supersetId)
    expect(out[2].supersetId).toBeNull()
  })

  it('linkWithNext merges two groups', () => {
    const out = linkWithNext(list('a', 'a', 'b', 'b'), 1)
    expect(new Set(ids(out))).toEqual(new Set(['a']))
  })

  it('unlink in the middle splits the rest into its own group', () => {
    const out = unlink(list('a', 'a', 'a', 'a'), 1)
    expect(out[0].supersetId).toBeNull() // alone now
    expect(out[1].supersetId).toBeNull()
    expect(out[2].supersetId).toBeTruthy()
    expect(out[2].supersetId).toBe(out[3].supersetId)
    expect(out[2].supersetId).not.toBe('a')
  })

  it('splitAfter cuts a group in two', () => {
    const out = splitAfter(list('a', 'a', 'a', 'a'), 1)
    expect(ids(out).slice(0, 2)).toEqual(['a', 'a'])
    expect(out[2].supersetId).toBe(out[3].supersetId)
    expect(out[2].supersetId).not.toBe('a')
  })

  it('normalizeSupersets clears ids without a neighbour', () => {
    expect(ids(normalizeSupersets(list('a', null, 'a')))).toEqual([null, null, null])
  })

  it('groupSupersets groups runs of 2+', () => {
    const g = groupSupersets(list(null, 'a', 'a', 'b'))
    expect(g.map((x) => x.items.length)).toEqual([1, 2, 1])
    expect(g.map((x) => x.id)).toEqual([null, 'a', null])
  })
})

describe('bwPctOf', () => {
  it('uses the stored share, else the equipment default', () => {
    expect(bwPctOf(ex({ bwPct: 70 }))).toBe(70)
    expect(bwPctOf(ex({ equipment: 'bar' }))).toBe(100)
    expect(bwPctOf(ex({ equipment: 'barbell' }))).toBe(0)
  })
})
