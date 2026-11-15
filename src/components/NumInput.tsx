import { useEffect, useRef, useState } from 'react'
import { fmtNum, parseNum } from '../format'

/** Numeric text input that keeps the raw string while typing ("12," etc.) and saves on every change. */
export function NumInput({
  value,
  placeholder,
  onChange,
  decimal,
  className,
  ariaLabel,
}: {
  value: number | null | undefined
  placeholder?: string
  onChange: (v: number | null) => void
  decimal?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(fmtNum(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmtNum(value))
  }, [value])
  return (
    <input
      className={className ?? 'num'}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      autoComplete="off"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true
        e.currentTarget.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(fmtNum(value))
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, '')
        setText(raw)
        const n = parseNum(raw)
        if (raw === '' || n !== null) onChange(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // jump to next numeric input
          const all = Array.from(document.querySelectorAll<HTMLInputElement>('input.num'))
          const i = all.indexOf(e.currentTarget)
          if (i >= 0 && all[i + 1]) all[i + 1].focus()
          else e.currentTarget.blur()
        }
      }}
    />
  )
}
