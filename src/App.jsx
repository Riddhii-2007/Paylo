import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { usePinLock } from './hooks/usePinLock'
import { PageTransition } from './components/layout/PageTransition'
import { BottomNav } from './components/layout/BottomNav'
import { Setup } from './screens/Setup'
import { seedDevData } from './lib/seed'
import { Home } from './screens/Home'
import { Cycles } from './screens/Cycles'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { PinLockScreen } from './components/PinLockScreen'

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
  const { isLocked, unlock } = usePinLock()

  if (loading) {
    return <div className="min-h-screen bg-cream dark:bg-navy" />
  }

  if (import.meta.env.DEV && import.meta.env.VITE_SEED === 'true') {
    seedDevData()
  }

  if (!settings.setupComplete) {
    return (
      <div className="mx-auto w-full max-w-[480px] h-[100vh] h-[100dvh] overflow-y-auto overflow-x-hidden relative border-x border-navy/5 dark:border-gold/10 flex flex-col bg-cream dark:bg-navy text-navy dark:text-cream transition-colors duration-300">
        <Setup onComplete={() => setActiveTab('home')} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[480px] h-[100vh] h-[100dvh] overflow-hidden relative border-x border-navy/5 dark:border-gold/10 flex flex-col bg-cream dark:bg-navy text-navy dark:text-cream transition-colors duration-300">
      {isLocked && <PinLockScreen onUnlock={unlock} />}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <Home key="home" />}
          {activeTab === 'cycles' && <Cycles key="cycles" />}
          {activeTab === 'history' && <History key="history" />}
          {activeTab === 'settings' && <Settings key="settings" />}
        </AnimatePresence>
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
