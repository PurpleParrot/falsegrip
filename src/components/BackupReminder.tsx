import { useEffect, useState } from 'react'
import { downloadBackup, shouldAskUsername, shouldRemindBackup } from '../backup'
import { saveSettings } from '../db'
import { fmtDate } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import { Sheet } from './Sheet'

/**
 * Start-up prompts, at most one per app start:
 * 1. monthly backup reminder (data lives only in the browser)
 * 2. username (first start, then every ~2 months while none is set)
 */
export function BackupReminder() {
  const [open, setOpen] = useState(false)
  const [askName, setAskName] = useState(false)
  const [name, setName] = useState('')
  const { lastBackupAt } = useSettings()

  useEffect(() => {
    // small delay: let the seed/migration run first
    const id = setTimeout(async () => {
      try {
        // backup has priority; the name prompt waits for a start without a due backup
        if (await shouldRemindBackup()) setOpen(true)
        else if (await shouldAskUsername()) setAskName(true)
      } catch {
        /* ignore */
      }
    }, 800)
    return () => clearTimeout(id)
  }, [])

  const saveName = async () => {
    const v = name.trim()
    if (v) await saveSettings({ username: v })
    setAskName(false)
  }

  return (
    <>
    <Sheet open={askName} onClose={() => setAskName(false)} title={t('usernamePrompt.title')}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void saveName()
        }}
      >
        <p>{t('usernamePrompt.text')}</p>
        <input
          className="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.usernamePlaceholder')}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button type="submit" className="btn primary block" disabled={!name.trim()}>
          {t('usernamePrompt.save')}
        </button>
        <button type="button" className="btn block" onClick={() => setAskName(false)}>
          {t('backupReminder.later')}
        </button>
      </form>
    </Sheet>
    <Sheet open={open} onClose={() => setOpen(false)} title={t('backupReminder.title')}>
      <div className="form">
        <p>{t('backupReminder.text')}</p>
        <p className="muted small">
          {lastBackupAt ? t('settings.lastBackup', { date: fmtDate(lastBackupAt) }) : t('settings.noBackup')}
        </p>
        <button
          className="btn primary block"
          onClick={async () => {
            await downloadBackup()
            setOpen(false)
          }}
        >
          {t('backupReminder.now')}
        </button>
        <button className="btn block" onClick={() => setOpen(false)}>
          {t('backupReminder.later')}
        </button>
      </div>
    </Sheet>
    </>
  )
}
