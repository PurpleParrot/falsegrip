import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconCheck, IconTrash } from './Icons'

const OPEN_X = -76
const TRIGGER = 64

/**
 * Swipe right: onApply (take suggestion values).
 * Swipe left: reveals a red delete button; tapping it calls onDelete.
 * Tapping anywhere else closes it again.
 */
export function SwipeRow({
  children,
  onApply,
  onDelete,
  canApply,
  id,
  openId,
  setOpenId,
}: {
  children: ReactNode
  onApply: () => void
  onDelete: () => void
  canApply: boolean
  id: string
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const open = openId === id
  const [dx, setDxState] = useState(0)
  const dxRef = useRef(0)
  const setDx = (x: number) => {
    dxRef.current = x
    setDxState(x)
  }
  const [dragging, setDragging] = useState(false)
  const [flash, setFlash] = useState(false)
  const g = useRef<{ x: number; y: number; base: number; locked: 'h' | 'v' | null; pid: number } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dragging) setDx(open ? OPEN_X : 0)
  }, [open, dragging])

  return (
    <div className="swipe" ref={rowRef} data-row-id={id}>
      <div className={`swipe-bg-left ${dx > 8 ? 'show' : ''} ${canApply ? '' : 'disabled'}`}>
        <IconCheck size={20} />
      </div>
      <button
        className={`swipe-delete ${dx < -8 ? 'show' : ''}`}
        onClick={() => {
          setOpenId(null)
          onDelete()
        }}
        aria-label="delete"
      >
        <IconTrash size={20} />
      </button>
      <div
        className={`swipe-content ${dragging ? '' : 'animate'} ${flash ? 'flash' : ''}`}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          if (openId && !open) setOpenId(null)
          g.current = { x: e.clientX, y: e.clientY, base: open ? OPEN_X : 0, locked: null, pid: e.pointerId }
        }}
        onPointerMove={(e) => {
          const s = g.current
          if (!s || s.pid !== e.pointerId) return
          const mx = e.clientX - s.x
          const my = e.clientY - s.y
          if (!s.locked) {
            if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
              s.locked = 'h'
              setDragging(true)
              try {
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              } catch {
                /* ignore */
              }
              ;(document.activeElement as HTMLElement | null)?.blur?.()
            } else if (Math.abs(my) > 10) s.locked = 'v'
          }
          if (s.locked === 'h') {
            let x = s.base + mx
            x = Math.max(-120, Math.min(110, x))
            setDx(x)
          }
        }}
        onPointerUp={(e) => {
          const s = g.current
          if (s && s.pid !== e.pointerId) return
          g.current = null
          if (!s || s.locked !== 'h') return
          setDragging(false)
          const x = dxRef.current
          if (x > TRIGGER && canApply) {
            onApply()
            setFlash(true)
            setTimeout(() => setFlash(false), 350)
            setOpenId(null)
            setDx(0)
          } else if (x < OPEN_X / 2) {
            setOpenId(id)
            setDx(OPEN_X)
          } else {
            if (open) setOpenId(null)
            setDx(0)
          }
        }}
        onPointerCancel={() => {
          g.current = null
          setDragging(false)
          setDx(open ? OPEN_X : 0)
        }}
        onClickCapture={(e) => {
          // a tap on an open row just closes it
          if (open) {
            e.preventDefault()
            e.stopPropagation()
            setOpenId(null)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
