import { describe, it, expect } from 'vitest'
import { getExpensesForCycle } from '../lib/cycle'
import { computeSavings } from '../lib/savings'
import { groupExpensesByDate, filterExpenses } from '../lib/history'

describe('Integration: Home, Cycles, and History alignment', () => {
  it('updates Home, Cycles, and History totals identically when an expense is added', () => {
    // 1. Initial State
    const cycles = [{ id: 'c1', startDate: '2026-10-01', income: 10000 }]
    const initialExpenses = [
      { id: 'e1', amount: 2000, date: '2026-10-02', categoryId: 'food' }
    ]
    const cycleDay = 1
    const today = '2026-10-05'

    // Home calculates current cycle spent
    const homeCycleExpenses1 = getExpensesForCycle(cycles[0], initialExpenses, cycles, cycleDay)
    const homeSpent1 = homeCycleExpenses1.reduce((sum, e) => sum + e.amount, 0)

    // Cycles calculates cycle spent
    const cyclesSpent1 = homeCycleExpenses1.reduce((sum, e) => sum + e.amount, 0)

    // History filters and groups
    const historyFiltered1 = filterExpenses(initialExpenses, 'all', '', [])
    const historyGrouped1 = groupExpensesByDate(historyFiltered1, today)
    const historyTotal1 = historyGrouped1.reduce((sum, g) => sum + g.total, 0)

    expect(homeSpent1).toBe(2000)
    expect(cyclesSpent1).toBe(2000)
    expect(historyTotal1).toBe(2000)

    // 2. Add new expense
    const newExpense = { id: 'e2', amount: 500, date: '2026-10-04', categoryId: 'transport' }
    const updatedExpenses = [...initialExpenses, newExpense]

    // 3. Recalculate all three
    const homeCycleExpenses2 = getExpensesForCycle(cycles[0], updatedExpenses, cycles, cycleDay)
    const homeSpent2 = homeCycleExpenses2.reduce((sum, e) => sum + e.amount, 0)

    const cyclesSpent2 = homeCycleExpenses2.reduce((sum, e) => sum + e.amount, 0)

    const historyFiltered2 = filterExpenses(updatedExpenses, 'all', '', [])
    const historyGrouped2 = groupExpensesByDate(historyFiltered2, today)
    const historyTotal2 = historyGrouped2.reduce((sum, g) => sum + g.total, 0)

    // 4. Assert they all reflect the new total identically
    expect(homeSpent2).toBe(2500)
    expect(cyclesSpent2).toBe(2500)
    expect(historyTotal2).toBe(2500)
    expect(homeSpent2).toBe(historyTotal2)
  })
})
