import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'

const COLORS = ['var(--accent)', 'var(--accent-2)', '#f5c542', 'var(--text)']
const PIECES = 14

interface Piece {
  dx: number
  dy: number
  rot: number
  delay: number
  color: string
  round: boolean
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => {
    const angle = (i / PIECES) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const dist = 22 + Math.random() * 18
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 6, // a bit more upwards
      rot: (Math.random() - 0.5) * 540,
      delay: Math.random() * 60,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    }
  })
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Trophy on a set number. With `celebrate` (a record that was just entered) it pops
 * and throws a short burst of confetti. The confetti is drawn in a fixed layer so the
 * swipe row's overflow doesn't clip it.
 */
export function PrBadge({ celebrate }: { celebrate: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [burst, setBurst] = useState<{ x: number; y: number; pieces: Piece[] } | null>(null)
  const [pop] = useState(celebrate)

  useLayoutEffect(() => {
    if (!celebrate || reducedMotion() || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, pieces: makePieces() })
    // only on mount: a record that is already shown doesn't celebrate again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!burst) return
    const id = setTimeout(() => setBurst(null), 1100)
    return () => clearTimeout(id)
  }, [burst])

  return (
    <>
      <span ref={ref} className={`pr-badge ${pop ? 'celebrate' : ''}`} title={t('session.pr')} aria-label={t('session.pr')}>
        🏆
      </span>
      {burst &&
        createPortal(
          <div className="confetti" style={{ left: burst.x, top: burst.y }} aria-hidden>
            <i className="confetti-ring" />
            {burst.pieces.map((p, i) => (
              <i
                key={i}
                className={`confetti-piece ${p.round ? 'round' : ''}`}
                style={
                  {
                    background: p.color,
                    animationDelay: `${p.delay}ms`,
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--rot': `${p.rot}deg`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
