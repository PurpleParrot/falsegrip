import { beforeEach, describe, expect, it } from 'vitest'
import { db, exportBackup, parseBackup, type Backup } from './db'
import { getSnapshot, mergeBackup, overwriteWithBackup, restoreSnapshot } from './importBackup'
import { uid } from './model'
import { block, ex, session, set } from './test/fixtures'

const DAY = 86400000

function backup(partial: Partial<Backup>): Backup {
  return { app: 'falsegrip', version: 1, exportedAt: 0, exercises: [], templates: [], sessions: [], settings: [], ...partial }
}

beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.settings.clear(), db.snapshots.clear()])
})

describe('parseBackup', () => {
  it('accepts an exported backup', async () => {
    await db.exercises.put(ex())
    expect(parseBackup(JSON.stringify(await exportBackup())).app).toBe('falsegrip')
  })

  it('rejects other files and broken content', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow()
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup('{"app":"falsegrip"}')).toThrow() // no data at all
    expect(() => parseBackup('{"app":"falsegrip","sessions":[{"id":"x"}]}')).toThrow() // no startedAt / blocks
  })
})

describe('mergeBackup', () => {
  it('matches exercises and levels by name and remaps ids in sessions', async () => {
    const localLevel = { id: uid(), name: 'Tuck', intensity: 50 }
    const local = ex({ name: 'Front Lever', levels: [localLevel] })
    await db.exercises.put(local)

    const theirLevel = { id: uid(), name: 'tuck', intensity: 50 }
    const theirs = ex({ name: 'front lever', levels: [theirLevel, { id: uid(), name: 'Full', intensity: 100 }] })
    const s = session(DAY, [block(theirs.id, [set({ reps: 3 })], { levelId: theirLevel.id })])

    const r = await mergeBackup(backup({ exercises: [theirs], sessions: [s] }))
    expect(r.added).toBe(1) // the session
    expect(await db.exercises.count()).toBe(1)
    expect((await db.exercises.get(local.id))!.levels.map((l) => l.name)).toEqual(['Tuck', 'Full'])
    const stored = (await db.sessions.toArray())[0]
    expect(stored.blocks[0].exerciseId).toBe(local.id)
    expect(stored.blocks[0].levelId).toBe(localLevel.id)
  })

  it('skips sessions with the same name and start time (±2 min)', async () => {
    const pull = ex()
    await db.exercises.put(pull)
    await db.sessions.put(session(DAY, [block(pull.id, [set({ reps: 5 })])]))
    const twin = session(DAY + 60_000, [block(pull.id, [set({ reps: 5 })])])
    const r = await mergeBackup(backup({ exercises: [pull], sessions: [twin] }))
    expect(r.added).toBe(0)
    expect(await db.sessions.count()).toBe(1)
  })

  it('keeps the newer version of the same record', async () => {
    const pull = ex()
    const s = session(DAY, [block(pull.id, [set({ reps: 5 })])])
    await db.sessions.put(s)
    await mergeBackup(backup({ sessions: [{ ...s, name: 'Newer', updatedAt: s.updatedAt + 1 }] }))
    expect((await db.sessions.get(s.id))!.name).toBe('Newer')
  })
})

describe('overwrite and restore', () => {
  it('keeps a snapshot of the replaced data and can swap it back', async () => {
    const mine = session(DAY, [], { name: 'Mine' })
    await db.sessions.put(mine)

    await overwriteWithBackup(backup({ sessions: [session(2 * DAY, [], { name: 'Theirs' })] }))
    expect((await db.sessions.toArray()).map((x) => x.name)).toEqual(['Theirs'])
    expect((await getSnapshot())?.backup.sessions.map((x) => x.name)).toEqual(['Mine'])

    await restoreSnapshot()
    expect((await db.sessions.toArray()).map((x) => x.name)).toEqual(['Mine'])
    // the replaced data is the new snapshot, so the restore can be undone too
    expect((await getSnapshot())?.backup.sessions.map((x) => x.name)).toEqual(['Theirs'])
  })
})
