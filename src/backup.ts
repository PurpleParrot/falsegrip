import { db, exportBackup, getSettings, saveSettings } from './db'
import { now } from './model'
import { downloadFile } from './stats'

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Export all data as a JSON file and remember when. */
export async function downloadBackup() {
  const b = await exportBackup()
  downloadFile(`falsegrip-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json')
  await saveSettings({ lastBackupAt: now() })
}

/**
 * Monthly reminder: true on the first app start of a month, if there is something to lose
 * and no backup was made this month yet. Marks the month as reminded.
 */
export async function shouldRemindBackup(): Promise<boolean> {
  const s = await getSettings()
  const month = monthKey()
  if (s.backupPromptMonth === month) return false
  if (s.lastBackupAt && monthKey(new Date(s.lastBackupAt)) === month) return false
  const hasData = (await db.sessions.filter((x) => !x.deletedAt).count()) > 0
  if (!hasData) return false
  await saveSettings({ backupPromptMonth: month })
  return true
}
