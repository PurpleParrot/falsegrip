import { useEffect, useRef, useSyncExternalStore } from 'react'

// Minimal hash router + overlay stack so that the Android back gesture
// closes the topmost sheet/overlay first, then goes back a screen.

export interface Route {
  path: string
  parts: string[]
}

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  return { path, parts: path.split('/').filter(Boolean) }
}

let route = parse(location.hash)
const listeners = new Set<() => void>()
function emit() {
  route = parse(location.hash)
  listeners.forEach((l) => l())
}

interface OverlayEntry {
  close: () => void
}
const stack: OverlayEntry[] = []
let ignorePop = 0
let pending: { path: string; replace: boolean } | { back: string } | null = null

function depth(): number {
  return (history.state && typeof history.state.d === 'number' ? history.state.d : 0) as number
}

function doNav(path: string, replace: boolean) {
  const d = replace ? depth() : depth() + 1
  if (replace) history.replaceState({ d }, '', '#' + path)
  else history.pushState({ d }, '', '#' + path)
  emit()
}

window.addEventListener('popstate', () => {
  if (ignorePop > 0) {
    ignorePop--
    if (pending) {
      const p = pending
      pending = null
      if ('back' in p) goBack(p.back)
      else doNav(p.path, p.replace)
    } else emit()
    return
  }
  const top = stack.pop()
  if (top) {
    top.close()
    return
  }
  emit()
})
window.addEventListener('hashchange', emit)

/** App always starts on tab 1 (spec 5). */
export function bootRouter() {
  history.replaceState({ d: 0 }, '', '#/')
  emit()
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const replace = !!opts.replace
  if (ignorePop > 0) {
    // an overlay is still popping its history entry: navigate once that is done
    pending = { path, replace }
    return
  }
  if (stack.length) {
    const n = stack.length
    const entries = stack.splice(0)
    ignorePop++
    pending = { path, replace }
    history.go(-n)
    entries.forEach((e) => e.close())
  } else doNav(path, replace)
}

export function goBack(fallback = '/') {
  if (ignorePop > 0) {
    pending = { back: fallback }
    return
  }
  if (depth() > 0) history.back()
  else doNav(fallback, true)
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => route,
  )
}

/** Registers an open overlay so the hardware/gesture back button closes it. */
export function useOverlay(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const entry: OverlayEntry = { close: () => closeRef.current() }
    stack.push(entry)
    history.pushState({ ...(history.state ?? {}), ov: true }, '')
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) {
        // closed by the app, not by the back button: drop our history entry
        stack.splice(i, 1)
        ignorePop++
        history.back()
      }
    }
  }, [open])
}
