import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { db } from '../lib/db'
import {
  processAttempt,
  initialRateLimitState,
  isLockedOut,
  MAX_ATTEMPTS,
  LOCKOUT_SECONDS
} from '../lib/pinAuth'

export function PinLockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Rate-limit state — driven by processAttempt (pure function from pinAuth)
  const [rlState, setRlState] = useState(initialRateLimitState)
  const [remaining, setRemaining] = useState(0)
  const intervalRef = useRef(null)

  // Countdown ticker while locked out
  useEffect(() => {
    if (rlState.lockedUntil) {
      const tick = () => {
        const left = Math.ceil((rlState.lockedUntil - Date.now()) / 1000)
        if (left <= 0) {
          setRlState(s => ({ ...s, lockedUntil: null, attempts: 0 }))
          setRemaining(0)
          clearInterval(intervalRef.current)
        } else {
          setRemaining(left)
        }
      }
      tick()
      intervalRef.current = setInterval(tick, 500)
      return () => clearInterval(intervalRef.current)
    }
  }, [rlState.lockedUntil])

  // "Forgot PIN" screen state
  const [showForgot, setShowForgot] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isErasing, setIsErasing] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLockedOut(rlState) || isSubmitting || pin.length !== 4) return

    setIsSubmitting(true)
    try {
      const succeeded = await onUnlock(pin)
      const { newState, result } = processAttempt(rlState, succeeded)
      setRlState(newState)

      if (result.status === 'unlocked') return

      // Wrong or newly locked
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 500)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEraseAll = async () => {
    if (confirmText !== 'erase my data') return
    setIsErasing(true)
    try {
      await Promise.all([db.settings.clear(), db.cycles.clear(), db.expenses.clear()])
      localStorage.removeItem('theme')
      localStorage.removeItem('last-backup')
      // Full reload: all React state resets, DB is empty → Setup screen appears,
      // PinLockScreen is never rendered because setupComplete is falsy.
      window.location.reload()
    } catch {
      setIsErasing(false)
    }
  }

  if (showForgot) {
    return (
      <AnimatePresence>
        <motion.div
          className="absolute inset-0 bg-cream dark:bg-navy z-[100] flex flex-col p-6 pt-16 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            onClick={() => { setShowForgot(false); setConfirmText('') }}
            className="text-sm text-navy/60 dark:text-silver-muted mb-8 text-left hover:underline"
          >
            ← Back
          </button>

          <h2 className="font-serif text-3xl text-navy dark:text-gold mb-3">Forgot PIN?</h2>

          <div className="bg-terracotta/10 border border-terracotta/30 rounded-xl p-4 mb-6 text-sm text-terracotta">
            <p className="font-medium mb-1">⚠️ There is no password recovery.</p>
            <p className="text-terracotta/80">
              The PIN only hides the screen — it does not encrypt your data. Erasing will
              permanently delete all expenses, cycles, and settings from this device.
            </p>
          </div>

          <p className="text-sm text-navy/70 dark:text-silver-muted mb-6">
            Before erasing, ask someone with device access to go to{' '}
            <span className="font-mono text-xs bg-navy/5 dark:bg-white/5 px-1 rounded">
              Settings → Export Backup
            </span>{' '}
            to save your data first. Once erased there is no undo.
          </p>

          <label className="text-sm font-medium text-navy/80 dark:text-cream mb-2 block">
            Type <span className="font-mono text-terracotta">erase my data</span> to confirm
          </label>
          <Input
            placeholder="erase my data"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
          />

          <div className="mt-6">
            <Button
              variant="danger"
              className="w-full"
              disabled={confirmText !== 'erase my data' || isErasing}
              onClick={handleEraseAll}
            >
              {isErasing ? 'Erasing…' : 'Erase All Data on This Device'}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  const locked = isLockedOut(rlState)

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 bg-cream dark:bg-navy z-[100] flex flex-col items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <h2 className="font-serif text-3xl text-navy dark:text-gold mb-2">Enter PIN</h2>
        <p className="text-xs text-navy/50 dark:text-silver-muted mb-8 text-center">
          PIN hides the screen only — it is not encryption.
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-[240px] flex flex-col gap-6">
          <motion.div
            animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="text-center tracking-widest text-2xl py-4"
              maxLength={4}
              autoFocus
              disabled={locked || isSubmitting}
            />
          </motion.div>

          {locked ? (
            <div className="text-center">
              <p className="text-sm text-terracotta font-medium">Too many wrong attempts.</p>
              <p className="text-sm text-navy/60 dark:text-silver-muted">Try again in {remaining}s</p>
            </div>
          ) : (
            <>
              {rlState.attempts > 0 && (
                <p className="text-xs text-terracotta text-center -mt-2">
                  Wrong PIN ({rlState.attempts}/{MAX_ATTEMPTS} attempts)
                </p>
              )}
              <Button type="submit" disabled={pin.length !== 4 || isSubmitting}>
                {isSubmitting ? '…' : 'Unlock'}
              </Button>
            </>
          )}
        </form>

        <button
          onClick={() => setShowForgot(true)}
          className="mt-10 text-xs text-navy/40 dark:text-silver-muted hover:underline"
        >
          Forgot PIN?
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
