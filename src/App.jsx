import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { PageTransition } from './components/layout/PageTransition'
import { BottomNav } from './components/layout/BottomNav'
import { Setup } from './screens/Setup'

// A simple hash router hook
function useHashRouter() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || 'home')

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash.slice(1) || 'home')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (newHash) => {
    window.location.hash = newHash
  }

  return [hash, navigate]
}

function PlaceholderPage({ title }) {
  return (
    <PageTransition className="flex-1 flex items-center justify-center min-h-screen">
      <h2 className="font-serif text-2xl text-navy/50 dark:text-silver-muted">{title}</h2>
    </PageTransition>
  )
}

function App() {
  const [activeTab, setActiveTab] = useHashRouter()
  useTheme()
  const { loading, settings } = useSettings()

  if (loading) {
    return <div className="min-h-screen bg-cream dark:bg-navy" />
  }

  if (!settings.setupComplete) {
    return (
      <div className="min-h-screen bg-cream dark:bg-navy text-navy dark:text-cream">
        <Setup onComplete={() => setActiveTab('home')} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream dark:bg-navy text-navy dark:text-cream transition-colors duration-300">
      <main className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <PlaceholderPage key="home" title="Home Screen (M5)" />}
          {activeTab === 'history' && <PlaceholderPage key="history" title="History (M8)" />}
          {activeTab === 'settings' && <PlaceholderPage key="settings" title="Settings (M7)" />}
        </AnimatePresence>
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
