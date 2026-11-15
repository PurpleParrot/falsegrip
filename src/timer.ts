import { useEffect, useState, useSyncExternalStore } from 'react'

// Global timer state: keeps running while you navigate, survives reloads.

export interface TimerState {
  mode: 'stopwatch' | 'countdown'
  running: boolean
  /** timestamp when the current run started */
  startedAt: number
  /** ms accumulated before the current run */
  acc: number
  /** countdown length in seconds */
  total: number
  alerted: boolean
}

const KEY = 'falsegrip.timer'
let state: TimerState = load()
const listeners = new Set<() => void>()

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { mode: 'countdown', running: false, startedAt: 0, acc: 0, total: 90, alerted: false }
}

function set(patch: Partial<TimerState>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function elapsedMs(s: TimerState = state): number {
  return s.acc + (s.running ? Date.now() - s.startedAt : 0)
}

/** seconds to display: stopwatch counts up, countdown counts down (may go negative) */
export function displaySeconds(s: TimerState = state): number {
  const e = elapsedMs(s) / 1000
  return s.mode === 'stopwatch' ? e : s.total - e
}

export const timer = {
  start() {
    if (!state.running) set({ running: true, startedAt: Date.now() })
    unlockAudio()
  },
  pause() {
    if (state.running) set({ running: false, acc: elapsedMs() })
  },
  reset() {
    set({ running: false, acc: 0, startedAt: 0, alerted: false })
  },
  setMode(mode: TimerState['mode']) {
    set({ mode, running: false, acc: 0, alerted: false })
  },
  setTotal(total: number) {
    set({ total: Math.max(5, Math.round(total)), alerted: false })
  },
  /** quick-start a countdown */
  countdown(total: number) {
    set({ mode: 'countdown', total, running: true, startedAt: Date.now(), acc: 0, alerted: false })
    unlockAudio()
  },
}

export function useTimer() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  const [, force] = useState(0)
  useEffect(() => {
    if (!s.running) return
    const id = setInterval(() => force((x) => x + 1), 100)
    return () => clearInterval(id)
  }, [s.running])
  return s
}

// ---------- Countdown alarm ----------

let ctx: AudioContext | null = null
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio */
  }
}

function beep() {
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, t0 + i * 0.3)
    g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.3 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.2)
    o.connect(g).connect(ctx.destination)
    o.start(t0 + i * 0.3)
    o.stop(t0 + i * 0.3 + 0.22)
  }
}

setInterval(() => {
  if (state.mode === 'countdown' && state.running && !state.alerted && displaySeconds() <= 0) {
    set({ alerted: true })
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300])
    } catch {
      /* ignore */
    }
    beep()
  }
}, 250)
