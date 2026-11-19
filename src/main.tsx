import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureSeeded } from './db'
import { bootRouter, navigate } from './router'
import { findRunningSession } from './sessions'
import { applyTheme, storedTheme } from './theme'
import './styles.css'

applyTheme(storedTheme())
bootRouter()
void ensureSeeded()
// reopen a running training (e.g. after the app was closed or reloaded by an update)
void findRunningSession()
  .then((s) => {
    if (s && location.hash === '#/') navigate(`/session/${s.id}`)
  })
  .catch(() => {})
// ask the browser not to evict our data (important on iPhone)
void navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
