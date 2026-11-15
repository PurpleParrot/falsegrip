import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../router'
import { IconClose } from './Icons'

/** Bottom sheet. Closes on backdrop tap and on the Android back gesture. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  full?: boolean
}) {
  useOverlay(open, onClose)
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else {
      const id = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(id)
    }
  }, [open])
  if (!mounted) return null
  return createPortal(
    <div className={`sheet-root ${open ? 'open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet ${full ? 'sheet-full' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="close">
              <IconClose />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

/** Action menu ("..."), rendered as a compact bottom sheet: big touch targets. */
export function Menu({ open, onClose, items, title }: { open: boolean; onClose: () => void; items: MenuItem[]; title?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="menu">
        {items.map((it) => (
          <button
            key={it.label}
            className={`menu-item ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              onClose()
              // let the sheet's history entry pop before the action runs
              setTimeout(it.onClick, 30)
            }}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
