import { useState, useEffect } from 'react'

function App() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Initial check for system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center">
      <h1 className="font-serif text-4xl text-navy dark:text-gold mb-4">
        Expense Tracker
      </h1>
      <p className="text-navy/70 dark:text-silver mb-8 text-center max-w-md">
        Calm, premium, quiet. 
        Like a well-made paper ledger or a luxury banking card.
      </p>
      
      <button 
        onClick={toggleTheme}
        className="px-6 py-3 border border-gold-dark dark:border-gold rounded-xl text-navy dark:text-gold hover:bg-cream-surface dark:hover:bg-navy-surface transition-colors"
      >
        Toggle {isDark ? 'Light' : 'Dark'} Mode
      </button>
    </div>
  )
}

export default App
