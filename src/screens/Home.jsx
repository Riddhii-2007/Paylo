import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, animate } from 'motion/react'
import { db } from '../lib/db'
import { PageTransition } from '../components/layout/PageTransition'
import { i18n } from '../lib/i18n'
import { 
  findCycleForDate, getDaysLeft, isCycleEnded, getExpensesForCycle, 
  suggestNextStartDate, validateStartDateEdit, getCycleEndDate, sortCycles
} from '../lib/cycle'
import { getTodayStr, formatMoney, formatMoneyNoDecimals, toMinorUnits, parseLocalDate } from '../lib/format'
import { DEFAULT_CATEGORIES, resolveCategory } from '../lib/categories'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/layout/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { AddExpenseSheet } from '../components/AddExpenseSheet'
import { computeSavings } from '../lib/savings'

const BAR_COLORS = [
  'bg-gold/50', 'bg-silver/50', 'bg-teal/50', 'bg-terracotta/50', 'bg-sand/50',
  'bg-gold/30', 'bg-silver/30', 'bg-teal/30', 'bg-terracotta/30', 'bg-sand/30',
  'bg-gold/70', 'bg-silver/70', 'bg-teal/70', 'bg-terracotta/70', 'bg-sand/70',
]

function AnimatedAmount({ amount, currency }) {
  const [displayAmount, setDisplayAmount] = useState(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      setDisplayAmount(amount)
      return
    }

    const controls = animate(displayAmount, amount, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (value) => setDisplayAmount(value)
    })
    return () => controls.stop()
  }, [amount])

  return <span>{formatMoney(displayAmount, currency)}</span>
}

export function Home() {
  const settings = useLiveQuery(() => db.settings.toArray())
  const allCycles = useLiveQuery(() => db.cycles.toArray())
  const allExpenses = useLiveQuery(() => db.expenses.toArray())

  const [isEditCycleOpen, setIsEditCycleOpen] = useState(false)
  const [isAddExtraOpen, setIsAddExtraOpen] = useState(false)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  
  const [editDate, setEditDate] = useState('')
  const [editIncome, setEditIncome] = useState('')
  const [confirmEdit, setConfirmEdit] = useState(null)

  const [extraAmount, setExtraAmount] = useState('')

  const today = getTodayStr()

  const config = useMemo(() => {
    if (!settings) return {}
    return settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }, [settings])

  const { currency = '₹', cycleDay = 22, name = '', categories = DEFAULT_CATEGORIES, lowBalanceWarning = null, openingSavings = 0 } = config

  const currentCycle = useMemo(() => {
    if (!allCycles || allCycles.length === 0) return null
    return findCycleForDate(today, allCycles)
  }, [allCycles, today])

  const sortedCycles = useMemo(() => allCycles ? sortCycles(allCycles) : [], [allCycles])
  const cycleIndex = currentCycle ? sortedCycles.findIndex(c => c.id === currentCycle.id) : -1

  const cycleExpenses = useMemo(() => {
    if (!allExpenses) return []
    return getExpensesForCycle(currentCycle, allExpenses, sortedCycles, cycleDay)
  }, [currentCycle, allExpenses, sortedCycles, cycleDay])

  const ended = currentCycle ? isCycleEnded(cycleIndex, sortedCycles, cycleDay, today) : false
  const daysLeft = currentCycle ? getDaysLeft(cycleIndex, sortedCycles, cycleDay, today) : 0

  const totalIncome = useMemo(() => {
    if (!currentCycle) return 0
    const base = currentCycle.income || 0
    const extras = (currentCycle.extras || []).reduce((sum, e) => sum + e.amount, 0)
    return base + extras
  }, [currentCycle])

  const totalSpent = useMemo(() => cycleExpenses.reduce((sum, e) => sum + e.amount, 0), [cycleExpenses])
  const spentToday = useMemo(() => cycleExpenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0), [cycleExpenses, today])
  
  const rawRemaining = totalIncome - totalSpent
  const remaining = Math.max(0, rawRemaining)
  const dailyBudget = daysLeft > 0 ? Math.max(0, remaining / daysLeft) : 0

  const isLowBalance = lowBalanceWarning !== null ? rawRemaining < lowBalanceWarning : false

  // ── Savings ───────────────────────────────────────────────────────────────
  const savings = useMemo(() => {
    if (!allCycles || !allExpenses) return null
    return computeSavings(allCycles, allExpenses, openingSavings || 0, cycleDay, today)
  }, [allCycles, allExpenses, openingSavings, cycleDay, today])

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const totals = {}
    cycleExpenses.forEach(e => {
      const cat = e.categoryId || 'other'
      totals[cat] = (totals[cat] || 0) + e.amount
    })
    return Object.entries(totals).sort((a, b) => b[1] - a[1])
  }, [cycleExpenses])

  const greeting = name ? `Good evening, ${name}` : 'Good evening'

  const [isStartCycleOpen, setIsStartCycleOpen] = useState(false)
  const [newCycleDate, setNewCycleDate] = useState('')
  const [newCycleIncome, setNewCycleIncome] = useState('')

  const handleStartNewCycleInit = () => {
    setNewCycleDate(suggestNextStartDate(cycleDay, today))
    setNewCycleIncome('')
    setIsStartCycleOpen(true)
  }

  const handleStartNewCycle = async () => {
    const inc = toMinorUnits(newCycleIncome, currency)
    if (inc <= 0) return
    await db.cycles.add({ startDate: newCycleDate, income: inc, extras: [] })
    setIsStartCycleOpen(false)
  }

  const handleSaveExtra = async () => {
    const amount = toMinorUnits(extraAmount, currency)
    if (amount <= 0 || !currentCycle) return
    const extras = [...(currentCycle.extras || []), { amount, date: today, note: '' }]
    await db.cycles.update(currentCycle.id, { extras })
    setIsAddExtraOpen(false)
    setExtraAmount('')
  }

  const handleEditCycleInit = () => {
    if (!currentCycle) return
    setEditDate(currentCycle.startDate)
    setEditIncome(currentCycle.income / 100)
    setIsEditCycleOpen(true)
  }

  const submitCycleEdit = () => {
    const val = validateStartDateEdit(editDate, cycleIndex, sortedCycles, cycleDay, cycleExpenses)
    if (!val.valid) { alert('Invalid date: overlaps with another cycle.'); return }
    
    if ((val.orphanedExtras && val.orphanedExtras.length > 0) || (val.orphanedExpenses && val.orphanedExpenses.length > 0)) {
      setConfirmEdit({ date: editDate, orphaned: val.orphanedExtras || [], orphanedExp: val.orphanedExpenses || [] })
    } else {
      finalizeCycleEdit(editDate)
    }
  }

  const finalizeCycleEdit = async (date) => {
    const inc = toMinorUnits(editIncome, currency)
    const updates = { startDate: date, income: inc }
    if (confirmEdit && confirmEdit.orphaned) {
      updates.extras = currentCycle.extras.filter(e => !confirmEdit.orphaned.includes(e))
    }
    await db.cycles.update(currentCycle.id, updates)
    setIsEditCycleOpen(false)
    setConfirmEdit(null)
  }

  if (!settings || !allCycles || !allExpenses) return null

  if (!currentCycle && allCycles.length > 0) {
    const futureCycle = sortCycles(allCycles).find(c => c.startDate > today)
    if (futureCycle) {
      const d = parseLocalDate(futureCycle.startDate)
      const formatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      return (
        <PageTransition className="p-6">
          <h1 className="font-serif text-2xl mb-4">{greeting}</h1>
          <div className="bg-cream-surface dark:bg-navy-surface rounded-2xl p-6 text-center border border-navy/5 dark:border-gold/10">
            <p className="mb-4 text-navy/70 dark:text-silver-muted">Your next cycle starts on {formatted}.</p>
          </div>
        </PageTransition>
      )
    }

    return (
      <PageTransition className="p-6">
        <h1 className="font-serif text-2xl mb-4">{greeting}</h1>
        <div className="bg-cream-surface dark:bg-navy-surface rounded-2xl p-6 text-center border border-navy/5 dark:border-gold/10">
          <p className="mb-4 text-navy/70 dark:text-silver-muted">No active cycle for today.</p>
          <Button onClick={handleStartNewCycleInit}>Start new cycle</Button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Low Balance Banner */}
      {isLowBalance && rawRemaining > 0 && !ended && (
        <div className="bg-terracotta text-cream px-6 py-2 text-sm font-medium text-center">
          Running low on funds for this cycle.
        </div>
      )}

      <div className="p-6">
        <h1 className="text-sm font-medium text-navy/70 dark:text-silver-muted mb-8">{greeting}</h1>

        {ended ? (
          <div className="bg-cream-surface dark:bg-navy-surface rounded-3xl p-6 mb-8 border border-navy/5 dark:border-gold/10">
            <h2 className="font-serif text-2xl text-navy dark:text-gold mb-2">{i18n.home.cycleEnded}</h2>
            <p className="text-navy/70 dark:text-silver-muted mb-6">It looks like your cycle has ended. Ready for the next one?</p>
            <Button className="w-full" onClick={handleStartNewCycleInit}>{i18n.home.startNewCycle}</Button>
          </div>
        ) : (
          <div className="mb-8">
            {/* Main balance */}
            <div className="font-serif text-5xl tracking-tight text-navy dark:text-gold mb-2">
              {totalIncome === 0 ? (
                <span className="text-3xl text-navy/50 dark:text-gold/50">No amount added yet</span>
              ) : (
                <AnimatedAmount amount={remaining} currency={currency} />
              )}
            </div>
            <p className="text-navy/60 dark:text-silver-muted/70 text-sm flex justify-between items-center mb-3">
              <span>{i18n.home.remainingOf(formatMoney(totalIncome, currency))}</span>
              <button 
                onClick={handleEditCycleInit}
                className="text-xs underline underline-offset-4 hover:text-navy dark:hover:text-gold transition-colors"
              >
                Edit cycle
              </button>
            </p>

            {/* Using from savings notice */}
            {savings && savings.currentCycleUsingFromSavings && (
              <div className="flex items-center gap-2 bg-terracotta/10 border border-terracotta/20 rounded-xl px-3 py-2 mb-3">
                <span className="text-xs text-terracotta font-medium">
                  Using {formatMoney(savings.savingsBeingUsed, currency)} from savings this cycle
                </span>
              </div>
            )}

            {/* Savings stat line */}
            {savings && (
              <div className="flex items-center justify-between bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-navy/60 dark:text-silver-muted uppercase tracking-wider font-medium">
                    {savings.isProjection ? 'Projected savings' : 'Total saved'}
                  </span>
                  {savings.isProjection && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gold/15 text-gold-dark dark:text-gold rounded font-medium uppercase tracking-wide">
                      Projection
                    </span>
                  )}
                </div>
                {savings.isOverspent && !savings.isProjection ? (
                  <span className="font-serif text-sm text-terracotta font-medium">
                    Overspent beyond savings: {formatMoney(savings.overspentAmount, currency)}
                  </span>
                ) : (
                  <span className="font-serif text-lg text-navy dark:text-gold">
                    {formatMoney(
                      savings.isProjection
                        ? Math.max(0, savings.projectedSavings ?? savings.totalSaved)
                        : savings.totalSaved,
                      currency
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatBox label={i18n.home.spentToday} value={formatMoney(spentToday, currency)} />
          <StatBox label={i18n.home.daysLeft} value={daysLeft} />
          <StatBox label={i18n.home.totalSpent} value={formatMoney(totalSpent, currency)} />
          <StatBox label={i18n.home.daily} value={formatMoneyNoDecimals(dailyBudget, currency)} />
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-navy dark:text-cream">{i18n.home.categoryBreakdown}</h2>
          <button 
            onClick={() => setIsAddExtraOpen(true)}
            className="text-sm font-medium text-navy/60 dark:text-gold/80 hover:text-navy dark:hover:text-gold transition-colors"
          >
            Add extra money
          </button>
        </div>

        <div className="space-y-4">
          {categoryTotals.length === 0 ? (
            <p className="text-sm text-navy/50 dark:text-silver-muted text-center py-4 bg-cream-surface dark:bg-navy-surface rounded-xl">
              No expenses yet.
            </p>
          ) : (
            <>
              {(showAllCategories ? categoryTotals : categoryTotals.slice(0, 5)).map(([catId, amt], i) => {
                const percentage = Math.min(100, Math.max(0, (amt / totalSpent) * 100))
                const catObj = resolveCategory(catId, categories)
                const barColor = BAR_COLORS[i % BAR_COLORS.length]
                
                return (
                  <div key={catId} className="bg-cream-surface dark:bg-navy-surface rounded-2xl p-4 border border-navy/5 dark:border-gold/5">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="capitalize font-medium text-navy dark:text-cream">
                        {catObj.emoji} {catObj.name}
                      </span>
                      <span className="text-navy/70 dark:text-silver-muted">{formatMoney(amt, currency)}</span>
                    </div>
                    <div className="h-2 bg-navy/5 dark:bg-silver/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${barColor}`}
                      />
                    </div>
                  </div>
                )
              })}
              {!showAllCategories && categoryTotals.length > 5 && (
                <button 
                  onClick={() => setShowAllCategories(true)}
                  className="w-full text-center py-3 text-sm font-medium text-navy/60 dark:text-gold/80 hover:text-navy dark:hover:text-gold transition-colors"
                >
                  Show all
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Cycle Sheet */}
      <BottomSheet isOpen={isEditCycleOpen} onClose={() => setIsEditCycleOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Edit cycle</h3>
        <div className="flex flex-col gap-6">
          <Input label="Start Date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
          <Input label="Total Amount Received" type="number" value={editIncome} onChange={e => setEditIncome(e.target.value)} />
          <Button onClick={submitCycleEdit} className="mt-2">Save changes</Button>
        </div>
      </BottomSheet>

      {/* Start Cycle Sheet */}
      <BottomSheet isOpen={isStartCycleOpen} onClose={() => setIsStartCycleOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Start new cycle</h3>
        <div className="flex flex-col gap-6">
          <Input label="Start Date" type="date" value={newCycleDate} onChange={e => setNewCycleDate(e.target.value)} />
          <div>
            <Input label="Amount Received" type="number" placeholder="0" value={newCycleIncome} onChange={e => setNewCycleIncome(e.target.value)} />
            {currentCycle && currentCycle.income > 0 && (
              <button 
                onClick={() => setNewCycleIncome((currentCycle.income / 100).toString())}
                className="text-xs text-navy/60 dark:text-gold/80 mt-2 text-left w-full hover:underline"
              >
                Use previous amount: {formatMoney(currentCycle.income, currency)}
              </button>
            )}
          </div>
          <Button onClick={handleStartNewCycle} disabled={!newCycleDate || !newCycleIncome} className="mt-2">Start Cycle</Button>
        </div>
      </BottomSheet>

      {/* Add Extra Money Sheet (renamed) */}
      <BottomSheet isOpen={isAddExtraOpen} onClose={() => setIsAddExtraOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">Add extra money</h3>
        <p className="text-sm text-navy/70 dark:text-silver-muted mb-6">Received a bonus, gift, or side income? Add it to your current cycle's budget.</p>
        <div className="flex flex-col gap-6">
          <Input label="Amount" type="number" placeholder="0" value={extraAmount} onChange={e => setExtraAmount(e.target.value)} />
          <Button onClick={handleSaveExtra} className="mt-2">Add to cycle</Button>
        </div>
      </BottomSheet>

      {/* Confirm Date Change Dialog */}
      <ConfirmDialog
        isOpen={!!confirmEdit}
        title="Cycle change warning"
        description={`Changing the start date will cause ${confirmEdit?.orphanedExp?.length || 0} expenses and ${confirmEdit?.orphaned?.length || 0} extra incomes to fall outside this cycle. They will become unassigned or move to a different cycle. Proceed?`}
        confirmText="Yes, change date"
        onConfirm={() => finalizeCycleEdit(confirmEdit.date)}
        onCancel={() => setConfirmEdit(null)}
      />

      {/* Add Expense Sheet */}
      <AddExpenseSheet 
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        currency={currency}
      />

      <button 
        onClick={() => setIsAddExpenseOpen(true)}
        className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] right-6 w-14 h-14 bg-navy dark:bg-gold text-cream dark:text-navy rounded-full shadow-lg flex items-center justify-center text-3xl font-light hover:scale-105 transition-transform z-40"
      >
        +
      </button>
    </PageTransition>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/10 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs text-navy/60 dark:text-silver-muted">{label}</span>
      <span className="font-serif text-xl text-navy dark:text-cream">{value}</span>
    </div>
  )
}
