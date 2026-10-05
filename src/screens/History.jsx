import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'motion/react'
import { db } from '../lib/db'
import { getExpensesForCycle, sortCycles, getCycleEndDate } from '../lib/cycle'
import { formatMoney, parseLocalDate, getTodayStr, formatDate } from '../lib/format'
import { DEFAULT_CATEGORIES, resolveCategory } from '../lib/categories'
import { PageTransition } from '../components/layout/PageTransition'
import { Input } from '../components/ui/Input'
import { Chip } from '../components/ui/Chip'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { AddExpenseSheet } from '../components/AddExpenseSheet'
import { EditIcon, TrashIcon } from '../components/icons'

import { groupExpensesByDate, filterExpenses } from '../lib/history'

export function History() {
  const allCycles = useLiveQuery(() => db.cycles.toArray())
  const allExpenses = useLiveQuery(() => db.expenses.toArray())
  const settings = useLiveQuery(() => db.settings.toArray())

  const [selectedCycleId, setSelectedCycleId] = useState('current') // 'current', cycle.id, or 'unassigned'
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCat, setFilterCat] = useState('all') // 'all' or categoryId

  const [editExpense, setEditExpense] = useState(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const today = getTodayStr()

  const config = useMemo(() => {
    if (!settings) return {}
    return settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }, [settings])
  const { currency = '₹', cycleDay = 22, categories = DEFAULT_CATEGORIES } = config

  const sortedCycles = useMemo(() => allCycles ? sortCycles(allCycles) : [], [allCycles])
  
  // Find current cycle
  const currentCycle = useMemo(() => {
    if (sortedCycles.length === 0) return null
    return sortedCycles.find(c => c.startDate <= today) || sortedCycles[0]
  }, [sortedCycles, today])

  // Resolve active cycle to display
  const activeCycle = useMemo(() => {
    if (selectedCycleId === 'current') return currentCycle
    if (selectedCycleId === 'unassigned') return 'unassigned'
    return sortedCycles.find(c => c.id === selectedCycleId) || currentCycle
  }, [selectedCycleId, currentCycle, sortedCycles])

  // Get expenses for active cycle
  const displayedExpenses = useMemo(() => {
    if (!allExpenses) return []
    
    let base = []
    if (activeCycle === 'unassigned') {
      // Find all expenses that don't belong to any cycle
      base = allExpenses.filter(e => {
        const cycle = sortedCycles.find((c, i) => {
          const endDate = getCycleEndDate(i, sortedCycles, cycleDay, today)
          return e.date >= c.startDate && e.date <= endDate
        })
        return !cycle
      })
    } else if (activeCycle) {
      base = getExpensesForCycle(activeCycle, allExpenses, sortedCycles, cycleDay)
    }

    // Apply Search and Filter
    return filterExpenses(base, filterCat, searchQuery, categories)
  }, [allExpenses, activeCycle, sortedCycles, cycleDay, searchQuery, filterCat, categories, today])

  const grouped = useMemo(() => groupExpensesByDate(displayedExpenses, today), [displayedExpenses, today])

  const handleEdit = (expense) => {
    setEditExpense(expense)
    setIsEditOpen(true)
  }

  const handleDelete = (expense) => {
    setDeleteTarget(expense)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (deleteTarget) {
      await db.expenses.delete(deleteTarget.id)
    }
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  if (!allCycles || !allExpenses || !settings) return null

  // Build cycle options
  const cycleOptions = sortedCycles.map((c, i) => {
    const end = getCycleEndDate(i, sortedCycles, cycleDay, today)
    return { id: c.id, label: `${formatDate(c.startDate)} - ${formatDate(end)}` }
  })
  
  const hasUnassigned = allExpenses.some(e => {
    const cycle = sortedCycles.find((c, i) => {
      const endDate = getCycleEndDate(i, sortedCycles, cycleDay, today)
      return e.date >= c.startDate && e.date <= endDate
    })
    return !cycle
  })

  // List of unique categories actually used in these expenses for filter chips
  const usedCatIds = new Set(displayedExpenses.map(e => e.categoryId))
  // We want to show all categories in filter, or only used ones? 
  // "Category filter chips (All plus each category)"
  // We'll show All + all available categories.
  
  return (
    <PageTransition className="pb-[calc(7rem+env(safe-area-inset-bottom))] p-6 flex flex-col min-h-full">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-4">History</h1>
        
        {sortedCycles.length > 0 && (
          <select 
            value={selectedCycleId}
            onChange={e => setSelectedCycleId(e.target.value)}
            className="w-full bg-cream-surface dark:bg-navy-surface border border-navy/10 dark:border-gold/20 rounded-xl px-4 py-3 font-sans text-navy dark:text-cream focus:outline-none focus:border-gold mb-4"
          >
            <option value="current">Current Cycle</option>
            {cycleOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
            {hasUnassigned && <option value="unassigned">Unassigned Expenses</option>}
          </select>
        )}

        <Input 
          type="search"
          placeholder="Search note or amount..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        
        <div className="flex gap-2 overflow-x-auto custom-scrollbar mt-4 pb-2 -mx-2 px-2">
          <Chip 
            label="All" 
            selected={filterCat === 'all'} 
            onClick={() => setFilterCat('all')} 
          />
          {categories.map(c => (
            <Chip 
              key={c.id} 
              label={`${c.emoji} ${c.name}`} 
              selected={filterCat === c.id}
              onClick={() => setFilterCat(c.id)}
            />
          ))}
          <Chip 
            label="✨ Other" 
            selected={filterCat === 'other'} 
            onClick={() => setFilterCat('other')} 
          />
        </div>
      </header>

      <div className="flex-1">
        {grouped.length === 0 ? (
          <div className="bg-cream-surface dark:bg-navy-surface rounded-2xl p-8 text-center border border-navy/5 dark:border-gold/10 mt-8">
            <p className="text-navy/60 dark:text-silver-muted">
              {searchQuery || filterCat !== 'all' ? 'No matches found.' : 'No expenses yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {grouped.map(group => (
                <motion.div 
                  key={group.date}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-end mb-3 border-b border-navy/10 dark:border-gold/20 pb-2">
                    <h3 className="font-serif text-lg text-navy/80 dark:text-silver">{group.title}</h3>
                    <span className="text-sm font-medium text-navy/60 dark:text-silver-muted">{formatMoney(group.total, currency)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    {group.items.map(item => {
                      const cat = resolveCategory(item.categoryId, categories)
                      return (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-cream-surface dark:bg-navy-surface rounded-xl border border-navy/5 dark:border-gold/5"
                        >
                          <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
                            <span className="text-2xl shrink-0">{cat.emoji}</span>
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-medium text-navy dark:text-cream truncate">{cat.name}</span>
                              {item.note && (
                                <span className="text-xs text-navy/60 dark:text-silver-muted truncate">{item.note}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <span className="font-serif text-lg text-navy dark:text-cream tabular-nums">{formatMoney(item.amount, currency)}</span>
                            <div className="flex -mr-2">
                              <button 
                                onClick={() => handleEdit(item)}
                                className="w-11 h-11 flex items-center justify-center text-navy/60 hover:text-navy dark:text-silver-muted dark:hover:text-gold"
                                aria-label="Edit expense"
                              >
                                <EditIcon className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(item)}
                                className="w-11 h-11 flex items-center justify-center text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                aria-label="Delete expense"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AddExpenseSheet 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        currency={currency}
        initialExpense={editExpense}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </PageTransition>
  )
}
