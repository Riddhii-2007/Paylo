import { describe, it, expect } from 'vitest'
import { computeSavings } from '../lib/savings'
import { willExpenseExceedBalance } from '../lib/cycle'

const CYCLE_DAY = 1

function buildCycle(id, startDate, income = 0, extras = []) {
  return { id, startDate, income, extras }
}

function buildExpense(id, amount, date, categoryId = 'food') {
  return { id, amount, date, categoryId }
}

describe('Income and Savings Flow', () => {
  it('adding money received increases current-cycle balance and does not increase spent or reduce savings', () => {
    // 4000 income, 4000 spent. Balance should be 0.
    // Add 1000 extra money.
    const cycle = buildCycle('c1', '2026-10-01', 4000, [
      { amount: 1000, date: '2026-10-05', note: 'Gift' }
    ])
    const expenses = [
      buildExpense('e1', 4000, '2026-10-02')
    ]
    const today = '2026-10-05'
    
    // We can verify total received is 5000 via computeSavings
    const savings = computeSavings([cycle], expenses, 0, CYCLE_DAY, today)
    
    // It's the current cycle, so it is in projected savings, not totalSavedRaw
    // Wait, if it's projected savings, we can check the projection.
    const entry = savings.cycleEntries[0]
    expect(entry.received).toBe(5000)
    expect(entry.spent).toBe(4000)
    expect(entry.delta).toBe(1000) // The remaining balance!
    expect(entry.isCurrentCycle).toBe(true)
    
    // Savings is NOT reduced
    expect(savings.isOverspent).toBe(false)
    expect(savings.totalSaved).toBe(0) // since only current cycle has money, total finished savings = 0
  })

  it('willExpenseExceedBalance returns true when balance is 0 and trying to add expense', () => {
    const cycles = [
      buildCycle('c1', '2026-10-01', 4000)
    ]
    const expenses = [
      buildExpense('e1', 4000, '2026-10-02')
    ]
    const result = willExpenseExceedBalance(500, '2026-10-03', cycles, expenses, CYCLE_DAY, 0)
    expect(result).toBe(true)
  })

  it('willExpenseExceedBalance returns false if we edit an expense and the new amount fits', () => {
    const cycles = [
      buildCycle('c1', '2026-10-01', 4000)
    ]
    const expenses = [
      buildExpense('e1', 4000, '2026-10-02')
    ]
    // If we edit e1 from 4000 to 3000, it fits
    const result = willExpenseExceedBalance(3000, '2026-10-02', cycles, expenses, CYCLE_DAY, 4000)
    expect(result).toBe(false)
  })

  it('adding an expense that uses savings correctly updates savings and shows Using from savings', () => {
    // Opening savings 2000
    // Current cycle income 4000
    // Spent 5000 (1000 uses savings)
    const cycles = [
      buildCycle('c1', '2026-10-01', 4000)
    ]
    const expenses = [
      buildExpense('e1', 5000, '2026-10-05')
    ]
    const today = '2026-10-05'

    const savings = computeSavings(cycles, expenses, 2000, CYCLE_DAY, today)
    
    expect(savings.currentCycleUsingFromSavings).toBe(true)
    expect(savings.savingsBeingUsed).toBe(1000)
    // Projected savings = 2000 (total) - 1000 (used) = 1000
    expect(savings.projectedSavings).toBe(1000)
    expect(savings.isOverspent).toBe(false)
  })

  it('overspending beyond savings triggers the overspent state', () => {
    // Opening savings 500
    // Current cycle income 4000
    // Spent 5000 (Uses 1000, but only 500 savings available)
    const cycles = [
      buildCycle('c1', '2026-10-01', 4000)
    ]
    const expenses = [
      buildExpense('e1', 5000, '2026-10-05')
    ]
    const today = '2026-10-05'

    const savings = computeSavings(cycles, expenses, 500, CYCLE_DAY, today)
    
    expect(savings.currentCycleUsingFromSavings).toBe(true)
    expect(savings.isOverspent).toBe(true)
    expect(savings.overspentAmount).toBe(500)
    expect(savings.projectedSavings).toBe(-500)
  })
})
