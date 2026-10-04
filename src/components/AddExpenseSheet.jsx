import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BottomSheet } from './layout/BottomSheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { db } from '../lib/db'
import { toMinorUnits, getTodayStr } from '../lib/format'
import { DEFAULT_CATEGORIES, saveCategory } from '../lib/categories'

export function AddExpenseSheet({ isOpen, onClose, currency }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(getTodayStr())
  const [selectedCat, setSelectedCat] = useState('food')
  
  const [customName, setCustomName] = useState('')
  const [customEmoji, setCustomEmoji] = useState('✨')

  const [savedCategories, setSavedCategories] = useState([])

  useEffect(() => {
    if (isOpen) {
      db.settings.get('categories').then(res => {
        if (res && res.value) {
          setSavedCategories(res.value)
        } else {
          setSavedCategories(DEFAULT_CATEGORIES)
        }
      })
      // Reset form
      setAmount('')
      setNote('')
      setDate(getTodayStr())
      setSelectedCat('food')
      setCustomName('')
      setCustomEmoji('✨')
    }
  }, [isOpen])

  const categories = savedCategories.length > 0 ? savedCategories : DEFAULT_CATEGORIES
  const showCustom = selectedCat === 'other' || selectedCat === 'new'

  const handleSave = async () => {
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
        // e.g., name too long or empty
        return
      }
    } else if (selectedCat === 'new') {
      // Picked new but didn't type anything, fallback to other
      finalCatId = 'other'
    }

    await db.expenses.add({
      amount: minor,
      categoryId: finalCatId,
      note: note.trim(),
      date,
      createdAt: Date.now()
    })

    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Add expense</h3>
      
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
        
        <Button onClick={handleSave} className="mt-2" disabled={!amount || toMinorUnits(amount, currency) <= 0}>
          Save Expense
        </Button>
      </div>
    </BottomSheet>
  )
}
