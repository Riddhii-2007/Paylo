import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { PageTransition } from '../components/layout/PageTransition'
import { db } from '../lib/db'
import { DEFAULT_CATEGORIES, saveCategory, renameCategory, deleteCategoryAndReassign } from '../lib/categories'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/layout/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useLiveQuery } from 'dexie-react-hooks'

export function Settings() {
  const settingsArr = useLiveQuery(() => db.settings.toArray())
  const expenses = useLiveQuery(() => db.expenses.toArray())
  
  const [categories, setCategories] = useState([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null for new, { id } for edit
  
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('✨')
  
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [reassignTo, setReassignTo] = useState('other')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  
  useEffect(() => {
    if (settingsArr) {
      const catSetting = settingsArr.find(s => s.key === 'categories')
      setCategories(catSetting?.value || DEFAULT_CATEGORIES)
    }
  }, [settingsArr])

  const handleOpenAdd = () => {
    setEditTarget(null)
    setEditName('')
    setEditEmoji('✨')
    setIsEditOpen(true)
  }

  const handleOpenEdit = (cat) => {
    if (cat.id === 'other') return
    setEditTarget(cat)
    setEditName(cat.name)
    setEditEmoji(cat.emoji)
    setIsEditOpen(true)
  }

  const handleSaveCategory = async () => {
    try {
      if (editTarget) {
        // Renaming
        const newCats = renameCategory(editTarget.id, editName, editEmoji, categories)
        await db.settings.put({ key: 'categories', value: newCats })
        setIsEditOpen(false)
      } else {
        // Adding new
        const result = saveCategory(editName, editEmoji, categories)
        if (result.updatedCategories !== categories) {
          await db.settings.put({ key: 'categories', value: result.updatedCategories })
        }
        setIsEditOpen(false)
      }
    } catch (e) {
      alert(e.message)
    }
  }

  const handleDeleteRequest = (cat) => {
    if (cat.id === 'other') return
    setDeleteTarget(cat)
    setReassignTo('other')
    setIsDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    
    // Check if expenses exist
    const hasExpenses = expenses?.some(e => e.categoryId === id)
    
    let finalExpenses = expenses || []
    let finalCategories = categories
    
    if (hasExpenses) {
      const result = deleteCategoryAndReassign(id, reassignTo, categories, expenses)
      finalCategories = result.updatedCategories
      const modifiedExpenses = result.updatedExpenses.filter((e, i) => e !== expenses[i])
      
      if (modifiedExpenses.length > 0) {
        await db.expenses.bulkPut(modifiedExpenses)
      }
    } else {
      finalCategories = categories.filter(c => c.id !== id)
    }
    
    await db.settings.put({ key: 'categories', value: finalCategories })
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const handleConfirmReset = async () => {
    // Clear all tables
    await Promise.all([
      db.settings.clear(),
      db.cycles.clear(),
      db.expenses.clear()
    ])
    // The App component will automatically detect no settings and show Setup
  }

  if (!settingsArr) return null

  return (
    <PageTransition className="pb-24 p-6">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-2">Settings</h1>
      </header>

      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-navy dark:text-cream">Categories</h2>
          <button 
            onClick={handleOpenAdd}
            className="text-sm font-medium text-navy/60 dark:text-gold/80 hover:text-navy dark:hover:text-gold transition-colors"
          >
            + Add New
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          {categories.map(cat => (
            <div 
              key={cat.id} 
              className="flex justify-between items-center bg-cream-surface dark:bg-navy-surface p-4 rounded-xl border border-navy/5 dark:border-gold/5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.emoji}</span>
                <span className="font-medium text-navy dark:text-cream">{cat.name}</span>
              </div>
              
              {cat.id !== 'other' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenEdit(cat)}
                    className="text-sm text-navy/60 dark:text-silver-muted hover:text-navy dark:hover:text-cream"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteRequest(cat)}
                    className="text-sm text-terracotta dark:text-terracotta hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 pt-8 border-t border-terracotta/20 dark:border-terracotta/10">
        <h2 className="font-serif text-xl text-terracotta mb-4">Danger Zone</h2>
        <div className="bg-terracotta/5 dark:bg-terracotta/10 rounded-xl p-4 border border-terracotta/20 dark:border-terracotta/20">
          <p className="text-sm text-navy/70 dark:text-silver-muted mb-4">
            Resetting all data will permanently delete everything on this device.
          </p>
          <Button variant="danger" className="w-full" onClick={() => setIsResetOpen(true)}>
            Reset all data
          </Button>
        </div>
      </section>

      <BottomSheet isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">
          {editTarget ? 'Edit Category' : 'New Category'}
        </h3>
        
        <div className="flex flex-col gap-6">
          <div className="flex gap-2">
            <div className="w-20">
              <Input 
                label="Emoji" 
                value={editEmoji}
                onChange={e => setEditEmoji(e.target.value)}
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <Input 
                label="Name" 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={24}
              />
            </div>
          </div>
          
          <Button onClick={handleSaveCategory}>Save Category</Button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-4">Remove Category</h3>
        
        {deleteTarget && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-navy/70 dark:text-silver-muted">
              Removing "{deleteTarget.name}". Any existing expenses in this category will be moved.
            </p>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm text-navy/70 dark:text-silver-muted">Move expenses to...</label>
              <select
                value={reassignTo}
                onChange={e => setReassignTo(e.target.value)}
                className="w-full bg-cream-surface dark:bg-navy-surface border border-navy/20 dark:border-gold/30 rounded-xl px-4 py-3 font-sans text-lg text-navy dark:text-cream focus:outline-none focus:border-gold"
              >
                {categories.filter(c => c.id !== deleteTarget.id).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
            
            <Button onClick={handleConfirmDelete}>Remove & Move Expenses</Button>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={isResetOpen}
        title="Reset all data?"
        description="All your expenses, cycles, categories, and settings will be permanently deleted from this device. Consider exporting a backup first."
        confirmText="Yes, delete everything"
        cancelText="Cancel"
        danger={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetOpen(false)}
      />
    </PageTransition>
  )
}
