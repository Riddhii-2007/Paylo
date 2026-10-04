import { useState, useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { PageTransition } from './components/layout/PageTransition'
import { BottomNav } from './components/layout/BottomNav'
import { BottomSheet } from './components/layout/BottomSheet'
import { Button } from './components/ui/Button'
import { Input } from './components/ui/Input'
import { Chip } from './components/ui/Chip'
import { StatBox } from './components/ui/StatBox'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { PlusIcon } from './components/icons'

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

function ComponentsPreview() {
  const [theme, setTheme] = useTheme()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  return (
    <PageTransition className="pb-24 pt-8 px-6 max-w-md mx-auto flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-2">UI Components</h1>
        <p className="text-navy/70 dark:text-silver-muted text-sm">Theme: {theme}</p>
        <div className="flex gap-2 mt-4">
          <Button variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')} className="flex-1 py-2 text-sm">Light</Button>
          <Button variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')} className="flex-1 py-2 text-sm">Dark</Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl text-navy dark:text-cream border-b border-navy/10 dark:border-gold/20 pb-2">Buttons</h2>
        <Button variant="primary">Primary Action</Button>
        <Button variant="secondary">Secondary Action</Button>
        <Button variant="danger">Danger Action</Button>
        <Button variant="ghost">Ghost Action</Button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl text-navy dark:text-cream border-b border-navy/10 dark:border-gold/20 pb-2">Inputs & Chips</h2>
        <Input label="Amount" type="number" placeholder="0" defaultValue="1250" />
        <Input label="Note" placeholder="What was this for?" error="This field is required" />
        <div className="flex flex-wrap gap-2 mt-2">
          <Chip label="Food" emoji="🍲" selected />
          <Chip label="Transport" emoji="🚌" />
          <Chip label="Shopping" emoji="🛍️" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl text-navy dark:text-cream border-b border-navy/10 dark:border-gold/20 pb-2">Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Spent Today" value="₹ 340" />
          <StatBox label="Days Left" value="18" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl text-navy dark:text-cream border-b border-navy/10 dark:border-gold/20 pb-2">Overlays</h2>
        <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>Open Bottom Sheet</Button>
        <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>Open Confirm Dialog</Button>
      </section>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsSheetOpen(true)}
        className="fixed bottom-20 right-6 w-14 h-14 bg-cream dark:bg-navy border border-gold-dark dark:border-gold rounded-full flex items-center justify-center text-gold-dark dark:text-gold shadow-lg z-30"
      >
        <PlusIcon className="w-8 h-8" />
      </button>

      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6 text-center">Add Expense</h3>
        <Input type="number" placeholder="0" className="mb-6 text-center text-4xl" />
        <Button className="w-full" onClick={() => setIsSheetOpen(false)}>Save Expense</Button>
      </BottomSheet>

      <ConfirmDialog 
        isOpen={isDialogOpen} 
        title="Delete expense?" 
        description="This action cannot be undone. Are you sure you want to delete this ₹ 1,250 expense?"
        danger={true}
        confirmText="Delete"
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={() => setIsDialogOpen(false)}
      />
    </PageTransition>
  )
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
  // Initialize theme
  useTheme()

  return (
    <div className="min-h-screen flex flex-col bg-cream dark:bg-navy transition-colors duration-300">
      <main className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <ComponentsPreview key="home" />}
          {activeTab === 'history' && <PlaceholderPage key="history" title="History Page" />}
          {activeTab === 'settings' && <PlaceholderPage key="settings" title="Settings Page" />}
        </AnimatePresence>
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
