import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureSeeded } from './db'
import { bootRouter } from './router'
import './styles.css'

bootRouter()
void ensureSeeded()
// ask the browser not to evict our data (important on iPhone)
void navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
