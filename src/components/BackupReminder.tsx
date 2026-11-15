import { useEffect, useState } from 'react'
import { downloadBackup, shouldRemindBackup } from '../backup'
import { fmtDate } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import { Sheet } from './Sheet'

/** Shown once per month on app start: data lives only in the browser, so export a backup. */
export function BackupReminder() {
  const [open, setOpen] = useState(false)
  const { lastBackupAt } = useSettings()

  useEffect(() => {
    // small delay: let the seed/migration run first
    const id = setTimeout(() => {
      shouldRemindBackup()
        .then(setOpen)
        .catch(() => {})
    }, 800)
    return () => clearTimeout(id)
  }, [])

  return (
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
  )
}
