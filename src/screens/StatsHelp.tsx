import { useEffect } from 'react'
import { IconBack } from '../components/Icons'
import { t, type TKey } from '../i18n'
import { goBack } from '../router'

const SECTIONS = ['load', 'volume', 'e1rm', 'metrics', 'smooth', 'trend', 'freq', 'totals'] as const

/**
 * Tiny markup for the help texts in i18n: blank line = new paragraph,
 * "• " = list item, "» " = formula box.
 */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => l.startsWith('• ')))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          )
        if (lines.every((l) => l.startsWith('» ')))
          return (
            <div key={i} className="formula">
              {lines.map((l, j) => (
                <div key={j}>{l.slice(2)}</div>
              ))}
            </div>
          )
        return <p key={i}>{block}</p>
      })}
    </>
  )
}

/** "Wie sich die Statistiken berechnen": explanation of every number on the stats tab. */
export function StatsHelp() {
  // start at the top, not at the scroll position of the stats tab
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => goBack('/stats')} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1 className="grow">{t('help.title')}</h1>
      </header>
      <div className="pad-x help-page">
        <p className="muted">{t('help.intro')}</p>
        {SECTIONS.map((s) => (
          <section key={s} className="card help-section">
            <h2>{t(`help.${s}.t` as TKey)}</h2>
            <Rich text={t(`help.${s}.b` as TKey)} />
          </section>
        ))}
      </div>
    </div>
  )
}
