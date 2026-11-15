import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { alive, db, DEFAULT_SETTINGS } from './db'
import type { Exercise, Session, Settings, Template } from './model'

export function useExercises() {
  const all = useLiveQuery(() => db.exercises.toArray(), [])
  return useMemo(() => {
    const map = new Map<string, Exercise>()
    for (const e of all ?? []) map.set(e.id, e)
    const list = (all ?? []).filter(alive).sort((a, b) => a.name.localeCompare(b.name))
    return { loaded: !!all, list, map }
  }, [all])
}

export function useSessions(): Session[] | undefined {
  const all = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [])
  return useMemo(() => all?.filter(alive), [all])
}

export function useTemplates(): Template[] | undefined {
  const all = useLiveQuery(() => db.templates.toArray(), [])
  return useMemo(() => all?.filter(alive).sort((a, b) => a.name.localeCompare(b.name)), [all])
}

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS
}
