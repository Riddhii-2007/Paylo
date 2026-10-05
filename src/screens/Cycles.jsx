import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'motion/react'
import { db } from '../lib/db'
import { sortCycles, getCycleEndDate, getExpensesForCycle, validateStartDateEdit, findCycleForDate } from '../lib/cycle'
import { formatMoney, formatDate, getTodayStr, toMinorUnits, toMajorUnits } from '../lib/format'
import { DEFAULT_CATEGORIES, resolveCategory } from '../lib/categories'
import { PageTransition } from '../components/layout/PageTransition'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/layout/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TrashIcon, EditIcon, ChevronRightIcon } from '../components/icons'
import { computeSavings } from '../lib/savings'

export function Cycles() {
  const allCycles = useLiveQuery(() => db.cycles.toArray())
  const allExpenses = useLiveQuery(() => db.expenses.toArray())
  const settings = useLiveQuery(() => db.settings.toArray())

  const [expandedId, setExpandedId] = useState(null)

  // Edit Cycle State
  const [isEditCycleOpen, setIsEditCycleOpen] = useState(false)
  const [editingCycle, setEditingCycle] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editIncome, setEditIncome] = useState('')
  const [confirmCycleEdit, setConfirmCycleEdit] = useState(null)

  // Edit Addition State
  const [isEditAdditionOpen, setIsEditAdditionOpen] = useState(false)
  const [editingAddition, setEditingAddition] = useState(null)
  const [additionAmount, setAdditionAmount] = useState('')
  const [additionNote, setAdditionNote] = useState('')
  const [deleteAdditionConfirm, setDeleteAdditionConfirm] = useState(null)

  const today = getTodayStr()

  const config = useMemo(() => {
    if (!settings) return {}
    return settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }, [settings])
  const { currency = '₹', cycleDay = 22, categories = DEFAULT_CATEGORIES, openingSavings = 0 } = config

  const sortedCycles = useMemo(() => allCycles ? sortCycles(allCycles) : [], [allCycles])

  // ── Savings derived data ───────────────────────────────────────────────────
  const savings = useMemo(() => {
    if (!allCycles || !allExpenses) return null
    return computeSavings(allCycles, allExpenses, openingSavings || 0, cycleDay, today)
  }, [allCycles, allExpenses, openingSavings, cycleDay, today])

  // Map savings entries by cycle id for O(1) lookup in the render
  const savingsById = useMemo(() => {
    if (!savings) return {}
    return Object.fromEntries(savings.cycleEntries.map(e => [String(e.id), e]))
  }, [savings])

  const cyclesData = useMemo(() => {
    if (!sortedCycles.length || !allExpenses) return []
    return sortedCycles.map((cycle, i) => {
      const expenses = getExpensesForCycle(cycle, allExpenses, sortedCycles, cycleDay)
      const endDate = getCycleEndDate(i, sortedCycles, cycleDay, today)
      
      const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
      const baseIncome = cycle.income || 0
      const extras = (cycle.extras || [])
      const extraTotal = extras.reduce((sum, e) => sum + e.amount, 0)
      const received = baseIncome + extraTotal
      const remaining = received - spent

      const catTotals = {}
      expenses.forEach(e => {
        const cId = e.categoryId || 'other'
        catTotals[cId] = (catTotals[cId] || 0) + e.amount
      })
      const breakdown = Object.entries(catTotals).sort((a, b) => b[1] - a[1])

      return {
        ...cycle,
        index: i,
        endDate,
        expenses,
        spent,
        baseIncome,
        extraTotal,
        received,
        remaining,
        breakdown,
        extras,
        isCurrentCycle: findCycleForDate(today, sortedCycles)?.id === cycle.id
      }
    })
  }, [sortedCycles, allExpenses, cycleDay, today])

  // --- Cycle Editing ---
  const handleEditCycleInit = (e, cycle) => {
    e.stopPropagation()
    setEditingCycle(cycle)
    setEditDate(cycle.startDate)
    setEditIncome(toMajorUnits(cycle.income, currency).toString())
    setIsEditCycleOpen(true)
  }

  const submitCycleEdit = () => {
    const val = validateStartDateEdit(editDate, editingCycle.index, sortedCycles, cycleDay, editingCycle.expenses)
    if (!val.valid) { alert('Invalid date: overlaps with another cycle.'); return }
    
    const inc = toMinorUnits(editIncome, currency)
    const updates = { startDate: editDate, income: inc }

    if ((val.orphanedExtras && val.orphanedExtras.length > 0) || (val.orphanedExpenses && val.orphanedExpenses.length > 0)) {
      setConfirmCycleEdit({ updates, orphanedExtras: val.orphanedExtras || [], orphanedExp: val.orphanedExpenses || [] })
    } else {
      finalizeCycleEdit(updates)
    }
  }

  const finalizeCycleEdit = async (updates, orphanedExtrasToDrop = []) => {
    if (orphanedExtrasToDrop.length > 0) {
      updates.extras = editingCycle.extras.filter(e => !orphanedExtrasToDrop.includes(e))
    }
    await db.cycles.update(editingCycle.id, updates)
    setIsEditCycleOpen(false)
    setConfirmCycleEdit(null)
    setEditingCycle(null)
  }

  // --- Addition Editing ---
  const handleEditAddition = (cycle, index, extra) => {
    setEditingAddition({ cycle, index })
    setAdditionAmount(toMajorUnits(extra.amount, currency).toString())
    setAdditionNote(extra.note || '')
    setIsEditAdditionOpen(true)
  }

  const saveAddition = async () => {
    const amt = toMinorUnits(additionAmount, currency)
    if (amt <= 0) return
    const { cycle, index } = editingAddition
    const extras = [...cycle.extras]
    extras[index] = { ...extras[index], amount: amt, note: additionNote }
    await db.cycles.update(cycle.id, { extras })
    setIsEditAdditionOpen(false)
    setEditingAddition(null)
  }

  const confirmDeleteAddition = async () => {
    const { cycle, index } = deleteAdditionConfirm
    const extras = cycle.extras.filter((_, i) => i !== index)
    await db.cycles.update(cycle.id, { extras })
    setDeleteAdditionConfirm(null)
  }

  if (!allCycles || !allExpenses || !settings) return null

  return (
    <PageTransition className="pb-[calc(7rem+env(safe-area-inset-bottom))] p-6 flex flex-col h-full">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-2">Cycles</h1>
        <p className="text-navy/70 dark:text-silver-muted text-sm">View and manage all your cycles.</p>

        {/* Global savings summary */}
        {savings && (savings.totalSaved > 0 || savings.isOverspent) && (
          <div className={`mt-4 rounded-xl px-4 py-3 border ${
            savings.isOverspent
              ? 'bg-terracotta/10 border-terracotta/20'
              : 'bg-cream-surface dark:bg-navy-surface border-navy/5 dark:border-gold/10'
          }`}>
            {savings.isOverspent ? (
              <p className="text-sm text-terracotta font-medium">
                Overspent beyond savings: {formatMoney(savings.overspentAmount, currency)}
              </p>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-xs text-navy/60 dark:text-silver-muted uppercase tracking-wider font-medium">
                  Total saved
                </span>
                <span className="font-serif text-lg text-navy dark:text-gold">
                  {formatMoney(savings.totalSaved, currency)}
                </span>
              </div>
            )}
            {savings.isProjection && savings.projectedSavings !== null && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-navy/50 dark:text-silver-muted/70">Projected (incl. current)</span>
                <span className="text-sm font-medium text-navy/70 dark:text-silver-muted">
                  {formatMoney(Math.max(0, savings.projectedSavings), currency)}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-4">
        {cyclesData.length === 0 ? (
          <div className="bg-cream-surface dark:bg-navy-surface rounded-2xl p-8 text-center border border-navy/5 dark:border-gold/10">
            <p className="text-navy/60 dark:text-silver-muted">No cycles yet.</p>
          </div>
        ) : (
          cyclesData.map(c => {
            const isExpanded = expandedId === c.id
            const se = savingsById[String(c.id)]

            return (
              <div 
                key={c.id} 
                className="bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/10 rounded-2xl overflow-hidden"
              >
                <div 
                  className="p-5 cursor-pointer flex flex-col gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-navy dark:text-cream">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                      </h3>
                      {c.isCurrentCycle && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-navy/5 dark:bg-gold/10 text-navy/70 dark:text-gold text-[10px] uppercase tracking-wider font-semibold rounded">
                          Current Cycle
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => handleEditCycleInit(e, c)}
                      className="p-2 -mr-2 text-navy/50 hover:text-navy dark:text-silver-muted dark:hover:text-gold transition-colors"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex justify-between text-sm mt-2">
                    <div className="flex flex-col">
                      <span className="text-navy/60 dark:text-silver-muted text-xs uppercase tracking-wider font-medium mb-1">Received</span>
                      <span className="font-serif text-lg text-teal-dark dark:text-teal">{formatMoney(c.received, currency)}</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-navy/60 dark:text-silver-muted text-xs uppercase tracking-wider font-medium mb-1">Spent</span>
                      <span className="font-serif text-lg text-terracotta">{formatMoney(c.spent, currency)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-navy/60 dark:text-silver-muted text-xs uppercase tracking-wider font-medium mb-1">Left</span>
                      <span className="font-serif text-lg text-navy dark:text-cream">{formatMoney(Math.max(0, c.remaining), currency)}</span>
                    </div>
                  </div>

                  {/* Per-cycle savings badge */}
                  {se && !se.skipped && (
                    <div className={`flex justify-between items-center rounded-lg px-3 py-2 text-xs font-medium ${
                      se.isCurrentCycle
                        ? 'bg-gold/10 border border-gold/20 text-navy/70 dark:text-gold/80'
                        : se.delta >= 0
                          ? 'bg-teal/10 border border-teal/20 text-teal-dark dark:text-teal'
                          : 'bg-terracotta/10 border border-terracotta/20 text-terracotta'
                    }`}>
                      <span>
                        {se.isCurrentCycle
                          ? `Projected: ${se.delta >= 0 ? 'save' : 'overspend'} ${formatMoney(Math.abs(se.delta), currency)}`
                          : se.delta >= 0
                            ? `Saved ${formatMoney(se.delta, currency)}`
                            : `Overspent ${formatMoney(Math.abs(se.delta), currency)} (taken from savings)`
                        }
                      </span>
                      {!se.isCurrentCycle && (
                        <span className="text-navy/50 dark:text-silver-muted/60 font-normal">
                          Running: {formatMoney(Math.max(0, se.runningTotal), currency)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-center mt-2 -mb-2 text-navy/30 dark:text-gold/30">
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRightIcon className="w-5 h-5" />
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-navy/5 dark:border-gold/5"
                    >
                      <div className="p-5 space-y-6">
                        {/* Breakdowns */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider font-bold text-navy/50 dark:text-silver-muted mb-3">Expenses by Category</h4>
                          {c.breakdown.length === 0 ? (
                            <p className="text-sm text-navy/50 dark:text-silver-muted">No expenses recorded.</p>
                          ) : (
                            <div className="space-y-3">
                              {c.breakdown.map(([catId, amt]) => {
                                const catObj = resolveCategory(catId, categories)
                                return (
                                  <div key={catId} className="flex justify-between text-sm items-center">
                                    <span className="text-navy dark:text-cream flex items-center gap-2">
                                      <span className="text-lg">{catObj.emoji}</span> {catObj.name}
                                    </span>
                                    <span className="font-medium text-navy/80 dark:text-silver">{formatMoney(amt, currency)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Extra money (renamed from Additional Income) */}
                        {c.extras.length > 0 && (
                          <div>
                            <h4 className="text-xs uppercase tracking-wider font-bold text-navy/50 dark:text-silver-muted mb-3">Extra Money</h4>
                            <div className="space-y-2">
                              {c.extras.map((extra, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-3 bg-cream dark:bg-navy rounded-xl border border-navy/5 dark:border-gold/5">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-teal-dark dark:text-teal">{formatMoney(extra.amount, currency)}</span>
                                    {extra.note && <span className="text-xs text-navy/60 dark:text-silver-muted">{extra.note}</span>}
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleEditAddition(c, idx, extra)}
                                      className="p-1.5 text-navy/50 hover:text-navy dark:text-silver-muted dark:hover:text-gold"
                                    >
                                      <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => setDeleteAdditionConfirm({ cycle: c, index: idx })}
                                      className="p-1.5 text-terracotta/70 hover:text-terracotta"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>

      {/* Edit Cycle Sheet */}
      <BottomSheet isOpen={isEditCycleOpen} onClose={() => setIsEditCycleOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Edit cycle</h3>
        <div className="flex flex-col gap-6">
          <Input label="Start Date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
          <Input label="Base Income" type="number" value={editIncome} onChange={e => setEditIncome(e.target.value)} />
          <Button onClick={submitCycleEdit} className="mt-2">Save changes</Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!confirmCycleEdit}
        title="Cycle change warning"
        description={`Changing the start date will cause ${confirmCycleEdit?.orphanedExp?.length || 0} expenses and ${confirmCycleEdit?.orphanedExtras?.length || 0} extra incomes to fall outside this cycle. They will become unassigned or move to a different cycle. Proceed?`}
        confirmText="Yes, change date"
        onConfirm={() => finalizeCycleEdit(confirmCycleEdit.updates, confirmCycleEdit.orphanedExtras)}
        onCancel={() => setConfirmCycleEdit(null)}
      />

      {/* Edit Addition Sheet */}
      <BottomSheet isOpen={isEditAdditionOpen} onClose={() => setIsEditAdditionOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Edit Extra Money</h3>
        <div className="flex flex-col gap-6">
          <Input label="Amount" type="number" value={additionAmount} onChange={e => setAdditionAmount(e.target.value)} />
          <Input label="Note (Optional)" value={additionNote} onChange={e => setAdditionNote(e.target.value)} maxLength={100} />
          <Button onClick={saveAddition} className="mt-2">Save changes</Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!deleteAdditionConfirm}
        title="Delete extra money"
        description="Are you sure you want to delete this extra income? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={confirmDeleteAddition}
        onCancel={() => setDeleteAdditionConfirm(null)}
      />
    </PageTransition>
  )
}
