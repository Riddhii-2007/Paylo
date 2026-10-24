import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/dm-sans'
import './index.css'
import App from './App.jsx'
import { requestPersistentStorage } from './lib/backup'

// Request persistent storage so the browser won't evict IndexedDB data.
// Gracefully handles unsupported browsers or denied requests.
requestPersistentStorage().catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
