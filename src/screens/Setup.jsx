import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { PageTransition } from '../components/layout/PageTransition'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Chip } from '../components/ui/Chip'
import { CURRENCY_PRESETS } from '../lib/constants'
import { i18n } from '../lib/i18n'
import { db, initializeSettings } from '../lib/db'
import { updateSettings } from '../hooks/useSettings'
import { useTheme } from '../hooks/useTheme'
import { getTodayStr } from '../lib/format'
import { toMinorUnits } from '../lib/format'

const SUPPORTED_CURRENCIES = (() => {
  try {
    const codes = Intl.supportedValuesOf('currency')
    const names = new Intl.DisplayNames(['en'], { type: 'currency' })
    return codes.map(c => ({ code: c, name: names.of(c) }))
  } catch (e) {
    return []
  }
})()

export function Setup({ onComplete }) {
  const [step, setStep] = useState(1)
  const [theme, setTheme] = useTheme()
  
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('₹')
  const [customCurrency, setCustomCurrency] = useState('')
  const [cycleDay, setCycleDay] = useState(22)
  
  // First cycle states
  const [income, setIncome] = useState('')
  const [startDate, setStartDate] = useState(getTodayStr())

  const handleNext = async () => {
    if (step === 1) {
      if (!isStep1Valid()) return
      setStep(2)
    } else if (step === 2) {
      const inc = toMinorUnits(income, customCurrency || currency)
      if (inc <= 0) return
      
      // Save settings
      await initializeSettings()
      await updateSettings({
        name,
        currency: customCurrency || currency,
        cycleDay: cycleDay === 'last' ? 'last' : parseInt(cycleDay),
        theme,
        setupComplete: true
      })
      
      // Save first cycle
      await db.cycles.add({
        startDate,
        income: inc,
        extras: []
      })
      
      onComplete()
    }
  }

  const isStep1Valid = () => {
    if (cycleDay === 'last') return true
    const day = parseInt(cycleDay)
    return !isNaN(day) && day >= 1 && day <= 31
  }

  const isStep2Valid = () => {
    return toMinorUnits(income, customCurrency || currency) > 0 && startDate
  }

  return (
    <PageTransition className="min-h-screen flex flex-col pt-12 pb-8 px-6 max-w-md mx-auto">
      <header className="mb-10">
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-2">{i18n.setup.title}</h1>
        <p className="text-navy/70 dark:text-silver-muted text-sm">Let's set up your tracker.</p>
      </header>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <Input 
                label={i18n.setup.nameLabel} 
                placeholder={i18n.setup.namePlaceholder} 
                value={name}
                onChange={e => setName(e.target.value)}
              />

              <div className="flex flex-col gap-3">
                <label className="text-sm text-navy/70 dark:text-silver-muted">{i18n.setup.currencyLabel}</label>
                <div className="flex flex-wrap gap-2">
                  {CURRENCY_PRESETS.map(preset => (
                    <Chip 
                      key={preset} 
                      label={preset} 
                      selected={currency === preset && !customCurrency}
                      onClick={() => { setCurrency(preset); setCustomCurrency('') }} 
                    />
                  ))}
                  <div className="w-full mt-2">
                    <Input 
                      placeholder="More currencies or custom..." 
                      list="currency-list"
                      value={customCurrency}
                      onChange={e => { setCustomCurrency(e.target.value); setCurrency('') }}
                    />
                    <datalist id="currency-list">
                      {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-navy/70 dark:text-silver-muted mb-1 block">
                  {i18n.setup.cycleDayLabel}
                </label>
                <select
                  value={cycleDay}
                  onChange={e => setCycleDay(e.target.value)}
                  className="w-full bg-cream-surface dark:bg-navy-surface border border-navy/20 dark:border-gold/30 rounded-xl px-4 py-3 font-sans text-lg text-navy dark:text-cream focus:outline-none focus:border-gold"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                  <option value="last">Last day of the month</option>
                </select>
                <span className="text-xs text-navy/50 dark:text-silver-muted/70">{i18n.setup.cycleDayHelp}</span>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm text-navy/70 dark:text-silver-muted">{i18n.setup.themeLabel}</label>
                <div className="flex gap-2">
                  <Chip label="System" selected={theme === 'system'} onClick={() => setTheme('system')} />
                  <Chip label="Light" selected={theme === 'light'} onClick={() => setTheme('light')} />
                  <Chip label="Dark" selected={theme === 'dark'} onClick={() => setTheme('dark')} />
                </div>
                <p className="text-xs text-navy/50 dark:text-silver-muted mt-1">System follows your phone's setting.</p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <div>
                <h2 className="font-serif text-2xl text-navy dark:text-cream mb-2">Your first cycle</h2>
                <p className="text-sm text-navy/70 dark:text-silver-muted">When did your current money arrive, and how much was it?</p>
              </div>

              <Input 
                label="Start Date" 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />

              <Input 
                label="Total Amount Received" 
                type="number"
                placeholder="0"
                value={income}
                onChange={e => setIncome(e.target.value)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-4 flex justify-between items-center">
        {step === 2 ? (
          <Button variant="ghost" onClick={() => setStep(1)} className="px-4">Back</Button>
        ) : <div />}
        <Button 
          variant="primary" 
          onClick={handleNext}
          disabled={step === 1 ? !isStep1Valid() : !isStep2Valid()}
          className="ml-auto w-32"
        >
          {step === 1 ? 'Next' : i18n.setup.finish}
        </Button>
      </div>
    </PageTransition>
  )
}
