import { useEffect, useState } from 'react'
import { IconBack, IconClose, IconExpand, IconPause, IconPlay, IconReset } from '../components/Icons'
import { fmtClock } from '../format'
import { t } from '../i18n'
import { goBack, useOverlay } from '../router'
import { displaySeconds, setSound, timer, useSound, useTimer } from '../timer'

const PRESETS = [30, 60, 90, 120, 180]

export function Timer() {
  const s = useTimer()
  const sound = useSound()
  const [full, setFull] = useState(false)
  useOverlay(full, () => setFull(false))
  const secs = displaySeconds(s)
  const over = s.mode === 'countdown' && secs <= 0 && (s.running || s.acc > 0)
  const shown = s.mode === 'countdown' ? Math.ceil(secs) : Math.floor(secs * 10) / 10

  // keep the screen awake while the timer screen is open
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      void lock?.release()
    }
  }, [])

  const clock = (
    <div className={`clock ${over ? 'over' : ''} ${full ? 'clock-full' : ''}`}>
      {fmtClock(s.mode === 'countdown' ? Math.abs(shown) : shown, s.mode === 'stopwatch')}
    </div>
  )

  const controls = (
    <div className="timer-controls">
      <button className="round ghost" onClick={() => timer.reset()} aria-label={t('timer.reset')}>
        <IconReset />
      </button>
      {s.running ? (
        <button className="round primary" onClick={() => timer.pause()} aria-label={t('timer.pause')}>
          <IconPause size={30} />
        </button>
      ) : (
        <button className="round primary" onClick={() => timer.start()} aria-label={t('timer.start')}>
          <IconPlay size={30} />
        </button>
      )}
      <button className="round ghost" onClick={() => setFull((x) => !x)} aria-label={t('timer.fullscreen')}>
        {full ? <IconClose /> : <IconExpand />}
      </button>
    </div>
  )

  if (full)
    return (
      <div className="timer-full" onClick={() => (s.running ? timer.pause() : timer.start())}>
        {clock}
        <div onClick={(e) => e.stopPropagation()}>{controls}</div>
      </div>
    )

  return (
    <div className="screen timer-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => goBack('/')} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1 className="grow">{t('timer.title')}</h1>
      </header>
      <div className="pad-x">
        <div className="segmented">
          <button className={s.mode === 'stopwatch' ? 'on' : ''} onClick={() => timer.setMode('stopwatch')}>
            {t('timer.stopwatch')}
          </button>
          <button className={s.mode === 'countdown' ? 'on' : ''} onClick={() => timer.setMode('countdown')}>
            {t('timer.countdown')}
          </button>
        </div>
        {clock}
        {s.mode === 'countdown' && (
          <>
            <div className="chips center-chips">
              <button className="chip" onClick={() => timer.setTotal(s.total - 15)}>
                −15
              </button>
              <button className="chip" onClick={() => timer.setTotal(s.total + 15)}>
                +15
              </button>
            </div>
            <div className="chips center-chips">
              {PRESETS.map((p) => (
                <button key={p} className={`chip ${s.total === p ? 'on' : ''}`} onClick={() => timer.countdown(p)}>
                  {fmtClock(p)}
                </button>
              ))}
            </div>
            <div className="chips center-chips">
              <button className={`chip ${sound ? 'on' : ''}`} onClick={() => setSound(!sound)}>
                {sound ? t('timer.soundOn') : t('timer.soundOff')}
              </button>
            </div>
          </>
        )}
        {controls}
      </div>
    </div>
  )
}
