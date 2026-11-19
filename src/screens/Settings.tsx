import { useEffect, useRef, useState } from 'react'
import { IconBack } from '../components/Icons'
import { NumInput } from '../components/NumInput'
import { downloadBackup } from '../backup'
import { Sheet } from '../components/Sheet'
import { parseBackup, saveSettings, type Backup } from '../db'
import { mergeBackup, overwriteWithBackup, type ImportResult } from '../importBackup'
import { fmtDate } from '../format'
import { useSettings } from '../hooks'
import { t } from '../i18n'
import { goBack } from '../router'
import { applyTheme, storedTheme, THEMES } from '../theme'

export function Settings() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<Backup | null>(null)
  const [busy, setBusy] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
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
          <span>{t('settings.theme')}</span>
          <div className="theme-picker">
            {THEMES.map((th) => {
              const on = (s.theme ?? storedTheme()) === th.id
              return (
                <button
                  key={th.id}
                  className={`theme-opt ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    applyTheme(th.id)
                    void saveSettings({ theme: th.id })
                  }}
                >
                  <span className="theme-swatch" style={{ background: th.bg }}>
                    <i style={{ background: th.surface }} />
                    <b style={{ background: th.accent }} />
                  </span>
                  <span>{t(`theme.${th.id}`)}</span>
                </button>
              )
            })}
          </div>
        </div>

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

        <label>
          <span>{t('settings.username')}</span>
          <input
            className="text"
            defaultValue={s.username ?? ''}
            key={s.username ?? ''}
            placeholder={t('settings.usernamePlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v !== (s.username ?? '')) void saveSettings({ username: v || undefined })
            }}
          />
          <small className="muted">{t('settings.usernameHint')}</small>
        </label>

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
              setMsg('')
              try {
                setPending(parseBackup(await f.text()))
              } catch {
                setMsg(t('settings.importError'))
              }
            }}
          />
          {msg && <p className="accent small">{msg}</p>}
        </div>

        <Sheet open={!!pending} onClose={() => !busy && setPending(null)} title={t('import.title')}>
          {pending && (
            <div className="form">
              <p className="muted small">
                {t('import.info', {
                  date: fmtDate(pending.exportedAt),
                  n: (pending.sessions ?? []).filter((x) => !x.deletedAt).length,
                })}
                {pending.user ? ' ' + t('import.from', { user: pending.user }) : ''}
              </p>
              {pending.user && s.username && pending.user.trim().toLowerCase() !== s.username.trim().toLowerCase() && (
                <p className="warn small">{t('import.otherUser', { user: pending.user, me: s.username })}</p>
              )}
              <p>{t('import.question')}</p>
              <button
                className="btn primary block"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const r: ImportResult = await mergeBackup(pending)
                    setMsg(t('import.merged', { added: r.added, updated: r.updated, skipped: r.skipped }))
                  } catch {
                    setMsg(t('settings.importError'))
                  }
                  setBusy(false)
                  setPending(null)
                }}
              >
                {t('import.merge')}
              </button>
              <p className="muted small">{t('import.mergeHint')}</p>
              <button
                className="btn danger-outline block"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(t('import.overwriteConfirm'))) return
                  setBusy(true)
                  try {
                    const r = await overwriteWithBackup(pending)
                    setMsg(t('import.overwritten', { n: r.added }))
                  } catch {
                    setMsg(t('settings.importError'))
                  }
                  setBusy(false)
                  setPending(null)
                }}
              >
                {t('import.overwrite')}
              </button>
              <p className="muted small">{t('import.overwriteHint')}</p>
              <button className="btn ghost block" disabled={busy} onClick={() => setPending(null)}>
                {t('common.cancel')}
              </button>
            </div>
          )}
        </Sheet>

        <div className="field">
          <span>{t('settings.storage')}</span>
          <p className="muted small">{persisted ? t('settings.persisted') : t('settings.notPersisted')}</p>
        </div>

        <div className="card notice">
          <strong>{t('settings.dataWarningTitle')}</strong>
          <p className="small">{t('settings.dataWarning')}</p>
        </div>

        <button
          className="btn block"
          onClick={async () => {
            const url = location.origin + import.meta.env.BASE_URL
            try {
              await navigator.clipboard.writeText(url)
            } catch {
              // fallback for insecure contexts / old browsers
              const ta = document.createElement('textarea')
              ta.value = url
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              ta.remove()
            }
            setShareMsg(t('settings.shareCopied'))
            setTimeout(() => setShareMsg(''), 2500)
          }}
        >
          {t('settings.share')}
        </button>
        {shareMsg && <p className="accent small center">{shareMsg}</p>}

        <p className="muted small center">
          Falsegrip · {t('settings.version')} {__APP_VERSION__}
        </p>
      </div>
    </div>
  )
}
