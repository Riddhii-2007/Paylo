import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export function usePinLock() {
  const pinSetting = useLiveQuery(() => db.settings.get('pin'))
  const [isLocked, setIsLocked] = useState(false)
  
  useEffect(() => {
    // If a PIN is set, lock the app on mount or when returning to foreground
    if (pinSetting && pinSetting.value) {
      setIsLocked(true)
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          setIsLocked(true)
        }
      }
      
      document.addEventListener('visibilitychange', handleVisibilityChange)
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pinSetting])

  const unlock = (enteredPin) => {
    if (pinSetting && pinSetting.value === enteredPin) {
      setIsLocked(false)
      return true
    }
    return false
  }

  // To set a new pin, call db.settings.put({ key: 'pin', value: newPin })
  return { isLocked, unlock, hasPin: !!(pinSetting && pinSetting.value) }
}
