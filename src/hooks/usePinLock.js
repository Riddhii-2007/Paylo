import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { verifyPin, isLegacyPin, createPinRecord } from '../lib/pinAuth'

export function usePinLock() {
  const pinSetting = useLiveQuery(() => db.settings.get('pin'))
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    const pinValue = pinSetting?.value
    // A PIN is considered "set" if it's a hashed record object or a legacy plain string
    const hasPinSet = pinValue && (typeof pinValue === 'object' || isLegacyPin(pinValue))

    if (hasPinSet) {
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

  /**
   * Async: verifies the entered PIN against the stored hash (or legacy plain value).
   * On a successful legacy-PIN match, automatically migrates to a hashed record.
   *
   * @param {string} enteredPin
   * @returns {Promise<boolean>}
   */
  const unlock = async (enteredPin) => {
    const pinValue = pinSetting?.value
    if (!pinValue) return false

    let correct = false

    if (isLegacyPin(pinValue)) {
      // Legacy plain-text comparison (migrate to hash on success)
      correct = enteredPin === pinValue
      if (correct) {
        const record = await createPinRecord(enteredPin)
        await db.settings.put({ key: 'pin', value: record })
      }
    } else {
      // Hashed verification
      correct = await verifyPin(enteredPin, pinValue)
    }

    if (correct) {
      setIsLocked(false)
      return true
    }
    return false
  }

  const hasPin = !!(pinSetting?.value)
  return { isLocked, unlock, hasPin }
}
