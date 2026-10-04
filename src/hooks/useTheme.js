import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'system'
  })

  useEffect(() => {
    const applyTheme = (currentTheme) => {
      const root = document.documentElement
      let isDark = false

      if (currentTheme === 'dark') {
        isDark = true
      } else if (currentTheme === 'light') {
        isDark = false
      } else {
        // System
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }

      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (newTheme) => {
    localStorage.setItem('theme', newTheme)
    setThemeState(newTheme)
  }

  return [theme, setTheme]
}
