import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BottomSheet } from './layout/BottomSheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { db } from '../lib/db'
import { toMinorUnits, toMajorUnits, getTodayStr, formatMoney } from '../lib/format'
import { DEFAULT_CATEGORIES, saveCategory } from '../lib/categories'

export function AddExpenseSheet({ isOpen, onClose, currency, initialExpense = null }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [selectedCat, setSelectedCat] = useState('food')
  
  const [customName, setCustomName] = useState('')
  const [customEmoji, setCustomEmoji] = useState('✨')

  const [savedCategories, setSavedCategories] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const [pendingSaveData, setPendingSaveData] = useState(null)

  useEffect(() => {
    if (isOpen) {
      db.settings.get('categories').then(res => {
        if (res && res.value) {
          setSavedCategories(res.value)
        } else {
          setSavedCategories(DEFAULT_CATEGORIES)
        }
      })
      // Reset or populate form
      if (initialExpense) {
        setAmount(toMajorUnits(initialExpense.amount, currency).toString())
        setNote(initialExpense.note || '')
        setDate(initialExpense.date)
        setSelectedCat(initialExpense.categoryId)
        setCustomName('')
        setCustomEmoji('✨')
      } else {
        setAmount('')
        setNote('')
        setDate(getTodayStr())
        setSelectedCat('food')
        setCustomName('')
        setCustomEmoji('✨')
      }
    }
  }, [isOpen])

  const categories = savedCategories.length > 0 ? savedCategories : DEFAULT_CATEGORIES
  const showCustom = selectedCat === 'other' || selectedCat === 'new'

  const handleSave = async (forceSave = false) => {
    const minor = toMinorUnits(amount, currency)
    if (minor <= 0) return

    let finalCatId = selectedCat

    if (showCustom && customName.trim()) {
      try {
        const result = saveCategory(customName, customEmoji, categories)
        finalCatId = result.categoryId
        if (result.updatedCategories !== categories) {
          await db.settings.put({ key: 'categories', value: result.updatedCategories })
        }
      } catch (e) {
        return
      }
    } else if (selectedCat === 'new') {
      finalCatId = 'other'
    }

    const payload = { minor, finalCatId, note: note.trim(), date }

    if (!forceSave) {
      const allCycles = await db.cycles.toArray()
      const allExpenses = await db.expenses.toArray()
      const { sortCycles, findCycleForDate, getExpensesForCycle } = await import('../lib/cycle')
      const sorted = sortCycles(allCycles)
      const currentCycle = findCycleForDate(date, sorted)

      if (currentCycle) {
        const cycleSettings = await db.settings.get('cycleDay')
        const cycleDay = cycleSettings ? cycleSettings.value : 22
        const expenses = getExpensesForCycle(currentCycle, allExpenses, sorted, cycleDay)
        
        let spent = expenses.reduce((sum, e) => sum + e.amount, 0)
        if (initialExpense && initialExpense.date >= currentCycle.startDate) {
           spent -= initialExpense.amount
        }
        
        const base = currentCycle.income || 0
        const extras = (currentCycle.extras || []).reduce((sum, e) => sum + e.amount, 0)
        const received = base + extras
        const remaining = Math.max(0, received - spent)
        
        if (minor > remaining) {
          const { computeSavings } = await import('../lib/savings')
          const cycleDaySettings = await db.settings.get('cycleDay')
          const openingSavingsSettings = await db.settings.get('openingSavings')
          const cycleDay = cycleDaySettings ? cycleDaySettings.value : 22
          const openingSavings = openingSavingsSettings ? openingSavingsSettings.value : 0
          
          const savingsObj = computeSavings(allCycles, allExpenses, openingSavings, cycleDay, getTodayStr())
          const availableSavings = savingsObj.totalSaved
          const deficit = minor - remaining
          
          let title, description, confirmText, isBlocker
          
          if (availableSavings === 0) {
            title = "Insufficient Funds"
            description = "You have no remaining balance and no savings available for this expense."
            confirmText = "Okay"
            isBlocker = true
          } else {
            title = "Use Savings?"
            description = "Your balance is insufficient. This expense will require using your savings."
            confirmText = "Use savings"
            isBlocker = false
          }

          setPendingSaveData(payload)
          setConfirmState({ title, description, confirmText, isBlocker })
          return
        }
      }
    }

    await executeSave(payload)
  }

  const executeSave = async (data) => {
    if (initialExpense) {
      await db.expenses.update(initialExpense.id, {
        amount: data.minor,
        categoryId: data.finalCatId,
        note: data.note,
        date: data.date
      })
    } else {
      await db.expenses.add({
        amount: data.minor,
        categoryId: data.finalCatId,
        note: data.note,
        date: data.date,
        createdAt: Date.now()
      })
    }
    setConfirmState(null)
    setPendingSaveData(null)
    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">{initialExpense ? 'Edit expense' : 'Add expense'}</h3>
      
      <div className="flex flex-col gap-6">
        <Input 
          label="Amount" 
          type="number"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="text-2xl"
          autoFocus
        />

        <div className="flex flex-col gap-3">
          <label className="text-sm text-navy/70 dark:text-silver-muted">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => c.id !== 'other').map(c => (
              <Chip 
                key={c.id} 
                label={`${c.emoji} ${c.name}`} 
                selected={selectedCat === c.id}
                onClick={() => setSelectedCat(c.id)} 
              />
            ))}
            <Chip 
              label="✨ Other" 
              selected={selectedCat === 'other'}
              onClick={() => setSelectedCat('other')} 
            />
            <Chip 
              label="+ New" 
              selected={selectedCat === 'new'}
              onClick={() => setSelectedCat('new')} 
            />
          </div>
        </div>

        <AnimatePresence>
          {showCustom && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-2 overflow-hidden"
            >
              <div className="w-20">
                <Input 
                  label="Emoji" 
                  value={customEmoji}
                  onChange={e => setCustomEmoji(e.target.value)}
                  maxLength={2}
                />
              </div>
              <div className="flex-1">
                <Input 
                  label="Category Name" 
                  placeholder={selectedCat === 'other' ? 'Other' : 'New category'}
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  maxLength={24}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Input 
          label="Note (Optional)" 
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={100}
        />

        <Input 
          label="Date" 
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        
        
        <Button onClick={() => handleSave(false)} className="mt-2" disabled={!amount || toMinorUnits(amount, currency) <= 0}>
          Save Expense
        </Button>
      </div>
      
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ""}
        description={confirmState?.description || ""}
        confirmText={confirmState?.confirmText || ""}
        cancelText="Cancel"
        onConfirm={() => {
          if (confirmState?.isBlocker) {
            setConfirmState(null)
            setPendingSaveData(null)
          } else {
            executeSave(pendingSaveData)
          }
        }}
        onCancel={() => {
          setConfirmState(null)
          setPendingSaveData(null)
        }}
      />
    </BottomSheet>
  )
}
