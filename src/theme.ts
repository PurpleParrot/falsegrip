// Color themes. Petrol & Orange is the default; the others override the CSS tokens
// via <html data-theme="...">. The choice is stored in settings and mirrored to
// localStorage so it applies before the database has loaded (no flash on start).

export type ThemeId = 'petrol' | 'black-blue' | 'white-blue'

export const THEMES: { id: ThemeId; bg: string; surface: string; accent: string; dark: boolean }[] = [
  { id: 'petrol', bg: '#0b1519', surface: '#1a2d36', accent: '#f28c62', dark: true },
  { id: 'black-blue', bg: '#0c0f14', surface: '#1f242d', accent: '#4f5ef0', dark: true },
  { id: 'white-blue', bg: '#ffffff', surface: '#eef0f3', accent: '#4a5df9', dark: false },
]

const KEY = 'falsegrip.theme'

export function isTheme(x: unknown): x is ThemeId {
  return THEMES.some((t) => t.id === x)
}

export function storedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY)
    if (isTheme(v)) return v
  } catch {
    /* ignore */
  }
  return 'petrol'
}

export function applyTheme(id: ThemeId) {
  const th = THEMES.find((t) => t.id === id) ?? THEMES[0]
  const root = document.documentElement
  if (th.id === 'petrol') delete root.dataset.theme
  else root.dataset.theme = th.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.bg)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', th.dark ? 'dark' : 'light')
  try {
    localStorage.setItem(KEY, th.id)
  } catch {
    /* ignore */
  }
}
