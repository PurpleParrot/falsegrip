import { useEffect, useRef, useState } from 'react'
import { IconBack } from '../components/Icons'
import { NumInput } from '../components/NumInput'
import { downloadBackup } from '../backup'
import { importBackup, saveSettings } from '../db'
import { fmtDate } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import { goBack } from '../router'

export function Settings() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => goBack('/')} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1 className="grow">{t('settings.title')}</h1>
      </header>
      <div className="form pad-x">
        <div className="field">
          <span>{t('settings.suggestions')}</span>
          <div className="segmented">
            <button className={s.suggestionSource === 'last' ? 'on' : ''} onClick={() => saveSettings({ suggestionSource: 'last' })}>
              {t('settings.suggestions.last')}
            </button>
            <button className={s.suggestionSource === 'targets' ? 'on' : ''} onClick={() => saveSettings({ suggestionSource: 'targets' })}>
              {t('settings.suggestions.targets')}
            </button>
          </div>
        </div>

        <label>
          <span>{t('settings.bodyweight')}</span>
          <NumInput className="text" value={s.bodyweight} decimal placeholder="–" onChange={(n) => saveSettings({ bodyweight: n })} />
          <small className="muted">{t('settings.bodyweightHint')}</small>
        </label>

        <div className="field row-between">
          <span>{t('settings.unit')}</span>
          <strong>kg</strong>
        </div>

        <div className="field">
          <span>{t('settings.backup')}</span>
          <p className="muted small">{t('settings.backupHint')}</p>
          <button
            className="btn primary block"
            onClick={() => void downloadBackup()}
          >
            {t('settings.export')}
          </button>
          <p className="muted small">{s.lastBackupAt ? t('settings.lastBackup', { date: fmtDate(s.lastBackupAt) }) : t('settings.noBackup')}</p>
          <button className="btn block" onClick={() => fileRef.current?.click()}>
            {t('settings.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const n = await importBackup(JSON.parse(await f.text()))
                setMsg(t('settings.imported', { n }))
              } catch {
                setMsg(t('settings.importError'))
              }
            }}
          />
          {msg && <p className="accent small">{msg}</p>}
        </div>

        <div className="field">
          <span>{t('settings.storage')}</span>
          <p className="muted small">{persisted ? t('settings.persisted') : t('settings.notPersisted')}</p>
        </div>

        <div className="card notice">
          <strong>{t('settings.dataWarningTitle')}</strong>
          <p className="small">{t('settings.dataWarning')}</p>
        </div>

        <p className="muted small center">
          Falsegrip · {t('settings.version')} {__APP_VERSION__}
        </p>
      </div>
    </div>
  )
}
