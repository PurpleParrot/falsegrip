import { db, exportBackup, getSettings, saveSettings } from './db'
import { now } from './model'
import { downloadFile, fileUser } from './stats'

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Export all data as a JSON file and remember when. */
export async function downloadBackup() {
  const b = await exportBackup()
  downloadFile(`falsegrip-backup-${fileUser(b.user)}${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json')
  await saveSettings({ lastBackupAt: now() })
}

const USERNAME_PROMPT_EVERY = 60 * 86400000 // about every two months

/** Ask for a username on first start, then every ~2 months while none is set. Marks the prompt. */
export async function shouldAskUsername(): Promise<boolean> {
  const s = await getSettings()
  if (s.username?.trim()) return false
  if (s.usernamePromptAt && Date.now() - s.usernamePromptAt < USERNAME_PROMPT_EVERY) return false
  await saveSettings({ usernamePromptAt: now() })
  return true
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
