import { db, ensureSeeded, type Backup } from './db'
import { now, type Block, type Exercise, type Level, type Session, type Settings, type Template } from './model'

export interface ImportResult {
  added: number
  updated: number
  skipped: number
}

const norm = (s: string) => s.trim().toLowerCase()
const alive = <T extends { deletedAt?: number | null }>(x: T) => !x.deletedAt

/** Replace everything on this device with the backup. */
export async function overwriteWithBackup(b: Backup): Promise<ImportResult> {
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.settings], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear()])
    await db.exercises.bulkPut(b.exercises ?? [])
    await db.templates.bulkPut(b.templates ?? [])
    await db.sessions.bulkPut(b.sessions ?? [])
    const cur = await db.settings.get('settings')
    const bs = (b.settings ?? []).find((x) => x.id === 'settings')
    // keep this device's look; take everything else from the backup
    if (bs) await db.settings.put({ ...bs, theme: cur?.theme ?? bs.theme, username: bs.username || b.user || cur?.username })
  })
  await ensureSeeded() // runs migrations if the backup is from an older version
  return {
    added: (b.exercises?.length ?? 0) + (b.templates?.length ?? 0) + (b.sessions?.length ?? 0),
    updated: 0,
    skipped: 0,
  }
}

/**
 * Combine a backup with the data on this device without creating duplicates.
 * - Exercises: same id, or same name → one exercise (levels matched by name).
 * - Sessions: same id, or same name + start time (±2 min) → already there.
 * - Templates: same id, or same name with identical content → already there.
 * Records that exist on both sides keep the newer version.
 */
export async function mergeBackup(b: Backup): Promise<ImportResult> {
  const r: ImportResult = { added: 0, updated: 0, skipped: 0 }
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.settings], async () => {
    // ---- exercises ----
    const exMap = new Map<string, string>() // backup exercise id -> local id
    const lvMap = new Map<string, string>() // backup level id -> local level id
    const local = await db.exercises.toArray()
    const byId = new Map(local.map((e) => [e.id, e]))
    const byName = new Map<string, Exercise>()
    for (const e of local.filter(alive)) if (!byName.has(norm(e.name))) byName.set(norm(e.name), e)

    for (const be of b.exercises ?? []) {
      const same = byId.get(be.id)
      if (same) {
        exMap.set(be.id, be.id)
        if ((be.updatedAt ?? 0) > (same.updatedAt ?? 0)) {
          await db.exercises.put(be)
          r.updated++
        } else r.skipped++
        continue
      }
      const twin = alive(be) ? byName.get(norm(be.name)) : undefined
      if (twin) {
        exMap.set(be.id, twin.id)
        // match levels by name, add the ones this device doesn't know
        const levels: Level[] = [...twin.levels]
        let changed = false
        for (const bl of be.levels ?? []) {
          const tl = levels.find((l) => norm(l.name) === norm(bl.name))
          if (tl) lvMap.set(bl.id, tl.id)
          else {
            levels.push(bl)
            lvMap.set(bl.id, bl.id)
            changed = true
          }
        }
        if (changed) {
          twin.levels = levels
          await db.exercises.put({ ...twin, levels, updatedAt: now() })
          r.updated++
        } else r.skipped++
        continue
      }
      exMap.set(be.id, be.id)
      await db.exercises.put(be)
      byId.set(be.id, be)
      if (alive(be)) byName.set(norm(be.name), be)
      r.added++
    }

    const mapEx = (id: string) => exMap.get(id) ?? id
    const mapLv = (id?: string | null) => (id ? (lvMap.get(id) ?? id) : id)
    const remapBlock = (bl: Block): Block => ({ ...bl, exerciseId: mapEx(bl.exerciseId), levelId: mapLv(bl.levelId) })

    // ---- sessions ----
    const sessions = await db.sessions.toArray()
    const sById = new Map(sessions.map((x) => [x.id, x]))
    const liveSessions = sessions.filter(alive)
    for (const raw of b.sessions ?? []) {
      const bs: Session = { ...raw, blocks: (raw.blocks ?? []).map(remapBlock) }
      const same = sById.get(bs.id)
      if (same) {
        if ((bs.updatedAt ?? 0) > (same.updatedAt ?? 0)) {
          await db.sessions.put(bs)
          r.updated++
        } else r.skipped++
        continue
      }
      const dup =
        alive(bs) &&
        liveSessions.some((x) => norm(x.name) === norm(bs.name) && Math.abs(x.startedAt - bs.startedAt) < 2 * 60_000)
      if (dup || !alive(bs)) {
        r.skipped++
        continue
      }
      await db.sessions.put(bs)
      r.added++
    }

    // ---- templates ----
    const templates = await db.templates.toArray()
    const tById = new Map(templates.map((x) => [x.id, x]))
    const sig = (t: Template) =>
      norm(t.name) + '|' + t.items.map((i) => `${i.exerciseId}:${i.levelId ?? ''}:${i.sets}`).join(',')
    const liveSigs = new Set(templates.filter(alive).map(sig))
    for (const raw of b.templates ?? []) {
      const bt: Template = {
        ...raw,
        items: (raw.items ?? []).map((i) => ({ ...i, exerciseId: mapEx(i.exerciseId), levelId: mapLv(i.levelId) })),
      }
      const same = tById.get(bt.id)
      if (same) {
        if ((bt.updatedAt ?? 0) > (same.updatedAt ?? 0)) {
          await db.templates.put(bt)
          r.updated++
        } else r.skipped++
        continue
      }
      if (!alive(bt) || liveSigs.has(sig(bt))) {
        r.skipped++
        continue
      }
      await db.templates.put(bt)
      liveSigs.add(sig(bt))
      r.added++
    }

    // ---- settings: keep this device's, only fill gaps ----
    const cur = await db.settings.get('settings')
    const bs = (b.settings ?? []).find((x) => x.id === 'settings')
    if (cur) {
      const patch: Partial<Settings> = {}
      if (cur.bodyweight == null && bs?.bodyweight != null) patch.bodyweight = bs.bodyweight
      if (!cur.username && (bs?.username || b.user)) patch.username = bs?.username || b.user
      if (bs?.lastBackupAt && (!cur.lastBackupAt || bs.lastBackupAt > cur.lastBackupAt)) patch.lastBackupAt = bs.lastBackupAt
      if (Object.keys(patch).length) await db.settings.put({ ...cur, ...patch, updatedAt: now() })
    }
  })
  return r
}
