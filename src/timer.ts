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

const SOUND_KEY = 'falsegrip.timer.sound'
let soundOn = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
})()
const soundListeners = new Set<() => void>()

export function setSound(on: boolean) {
  soundOn = on
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
  soundListeners.forEach((l) => l())
  if (on) {
    unlockAudio()
    endTone()
  }
}

export function useSound() {
  return useSyncExternalStore(
    (l) => {
      soundListeners.add(l)
      return () => soundListeners.delete(l)
    },
    () => soundOn,
  )
}

let ctx: AudioContext | null = null
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio */
  }
}
// Browsers only allow audio after a user gesture. Unlock on any tap, so the
// alarm also works after a reload with a countdown still running.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
}

function tone(freq: number, at: number, dur: number, vol = 0.9) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'triangle'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015)
  g.gain.setValueAtTime(vol, at + dur - 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(ctx.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

/** short tick for the last 3 seconds */
function tick() {
  if (!soundOn || !ctx) return
  tone(880, ctx.currentTime, 0.12, 0.6)
}

/**
 * Simple additive piano model: per note a few slightly stretched overtones
 * (like stiff piano strings), higher ones decaying faster, two detuned
 * "strings" for warmth and a short filtered noise burst for the hammer.
 */
function pianoNote(out: AudioNode, freq: number, at: number, vol: number) {
  if (!ctx) return
  const B = 0.0004 // inharmonicity
  for (let n = 1; n <= 8; n++) {
    const f = freq * n * Math.sqrt(1 + B * n * n)
    if (f > 9000) break
    const amp = (vol / Math.pow(n, 1.1)) * (n === 1 ? 1 : 0.6)
    const decay = 2.6 / (1 + (n - 1) * 0.55) // seconds to fade
    for (const detune of n === 1 ? [-1.5, 1.5] : [0]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      o.detune.value = detune
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(amp, at + 0.004)
      g.gain.exponentialRampToValueAtTime(amp * 0.5, at + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + decay + 0.05)
    }
  }
  // hammer
  const len = Math.floor(ctx.sampleRate * 0.03)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const src = ctx.createBufferSource()
  const lp = ctx.createBiquadFilter()
  const hg = ctx.createGain()
  src.buffer = buf
  lp.type = 'lowpass'
  lp.frequency.value = Math.min(4000, freq * 6)
  hg.gain.value = vol * 0.25
  src.connect(lp).connect(hg).connect(out)
  src.start(at)
}

/** end of rest: a rolled maj7 chord on the piano, all notes fading out together */
function endTone() {
  if (!soundOn || !ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const t0 = ctx.currentTime + 0.03
  const ring = 2.2
  const bus = ctx.createGain()
  const comp = ctx.createDynamicsCompressor()
  bus.gain.setValueAtTime(1, t0)
  bus.gain.setValueAtTime(1, t0 + ring - 0.6)
  bus.gain.exponentialRampToValueAtTime(0.0001, t0 + ring)
  bus.connect(comp).connect(ctx.destination)
  // F3, A4, C5, E5 (F maj7): rolled from the bottom up
  ;[174.6, 440, 523.3, 659.3].forEach((f, i) => pianoNote(bus, f, t0 + i * 0.04, i === 0 ? 0.45 : 0.32))
}

let lastTick = 0
setInterval(() => {
  if (state.mode !== 'countdown' || !state.running || state.alerted) return
  const left = displaySeconds()
  const sec = Math.ceil(left)
  if (left > 0 && sec <= 3 && sec !== lastTick && state.total > 3) {
    lastTick = sec
    tick()
  }
  if (left <= 0) {
    lastTick = 0
    // stop at zero so the header doesn't show a "running" 00:00 forever
    set({ alerted: true, running: false, acc: state.total * 1000 })
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300])
    } catch {
      /* ignore */
    }
    endTone()
  }
}, 100)
