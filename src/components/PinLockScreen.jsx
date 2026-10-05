import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

export function PinLockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!onUnlock(pin)) {
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 500)
    }
  }

  return (
    <AnimatePresence>
      <motion.div 
        className="absolute inset-0 bg-cream dark:bg-navy z-[100] flex flex-col items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <h2 className="font-serif text-3xl text-navy dark:text-gold mb-8">Enter PIN</h2>
        <form onSubmit={handleSubmit} className="w-full max-w-[240px] flex flex-col gap-6">
          <motion.div animate={error ? { x: [-10, 10, -10, 10, 0] } : {}} transition={{ duration: 0.4 }}>
            <Input 
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center tracking-widest text-2xl py-4"
              maxLength={4}
              autoFocus
            />
          </motion.div>
          <Button type="submit">Unlock</Button>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}
