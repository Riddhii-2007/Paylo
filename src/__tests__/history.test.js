import { describe, it, expect } from 'vitest'
import { groupExpensesByDate, filterExpenses } from '../lib/history'

describe('History Utils', () => {
  const categories = [
    { id: 'food', name: 'Food', emoji: '🍔' },
    { id: 'transport', name: 'Transport', emoji: '🚗' },
    { id: 'other', name: 'Other', emoji: '✨' }
  ]

  const expenses = [
    { id: 1, amount: 500, categoryId: 'food', note: 'Lunch', date: '2026-10-12', createdAt: 100 },
    { id: 2, amount: 200, categoryId: 'transport', note: 'Bus', date: '2026-10-12', createdAt: 200 },
    { id: 3, amount: 1500, categoryId: 'food', note: 'Dinner', date: '2026-10-11', createdAt: 50 },
    { id: 4, amount: 300, categoryId: 'other', note: 'Misc', date: '2026-10-09', createdAt: 10 }
  ]

  describe('groupExpensesByDate', () => {
    it('groups expenses by date and formats titles relatively', () => {
      const today = '2026-10-12'
      const grouped = groupExpensesByDate(expenses, today)
      
      expect(grouped).toHaveLength(3) // 12, 11, 09
      
      // First group: Today (2026-10-12)
      expect(grouped[0].title).toBe('Today')
      expect(grouped[0].total).toBe(700)
      // Sorted by createdAt descending
      expect(grouped[0].items[0].id).toBe(2) // createdAt 200
      expect(grouped[0].items[1].id).toBe(1) // createdAt 100

      // Second group: Yesterday (2026-10-11)
      expect(grouped[1].title).toBe('Yesterday')
      expect(grouped[1].total).toBe(1500)

      // Third group: Older
      expect(grouped[2].title).toBe('Oct 9') // Using formatDate
      expect(grouped[2].total).toBe(300)
    })
  })

  describe('filterExpenses', () => {
    it('returns all expenses if no filter or search applied', () => {
      const result = filterExpenses(expenses, 'all', '', categories)
      expect(result).toHaveLength(4)
    })

    it('filters by category chip', () => {
      const result = filterExpenses(expenses, 'food', '', categories)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(3)
    })

    it('filters by search text in note (case insensitive)', () => {
      const result = filterExpenses(expenses, 'all', '  lunCH ', categories)
      expect(result).toHaveLength(1)
      expect(result[0].note).toBe('Lunch')
    })

    it('filters by search text in category name', () => {
      const result = filterExpenses(expenses, 'all', 'trans', categories)
      expect(result).toHaveLength(1)
      expect(result[0].categoryId).toBe('transport')
    })

    it('filters by exact amount matching (rough)', () => {
      const result = filterExpenses(expenses, 'all', '5', categories) // matches 5.00 (from 500) and 15.00 (from 1500)
      expect(result).toHaveLength(2)
    })

    it('combines category filter and search', () => {
      // Search 'Lunch' but filter 'transport' -> no matches
      let result = filterExpenses(expenses, 'transport', 'lunch', categories)
      expect(result).toHaveLength(0)

      // Search 'Lunch' and filter 'food' -> 1 match
      result = filterExpenses(expenses, 'food', 'lunch', categories)
      expect(result).toHaveLength(1)
      expect(result[0].note).toBe('Lunch')
    })
  })
})

import { getExpensesForCycle } from '../lib/cycle'

describe('Editing an expense date shifts its cycle', () => {
  it('correctly associates the expense with a new cycle based on its date', () => {
    const sortedCycles = [
      { id: 'c2', startDate: '2026-10-22', income: 1000 },
      { id: 'c1', startDate: '2026-09-22', income: 1000 }
    ]
    // Expense was initially in cycle c1
    const expense = { id: 1, amount: 100, categoryId: 'food', date: '2026-10-15', createdAt: 100 }
    
    const exps = [expense]
    
    // Cycle c1 covers Sept 22 - Oct 21
    let c1Expenses = getExpensesForCycle(sortedCycles[1], exps, sortedCycles, 22)
    let c2Expenses = getExpensesForCycle(sortedCycles[0], exps, sortedCycles, 22)
    
    expect(c1Expenses).toHaveLength(1)
    expect(c2Expenses).toHaveLength(0)

    // Edit the date to Oct 25, which belongs to c2 (Oct 22 - Nov 21)
    const editedExpense = { ...expense, date: '2026-10-25' }
    const updatedExps = [editedExpense]

    c1Expenses = getExpensesForCycle(sortedCycles[1], updatedExps, sortedCycles, 22)
    c2Expenses = getExpensesForCycle(sortedCycles[0], updatedExps, sortedCycles, 22)
    
    expect(c1Expenses).toHaveLength(0)
    expect(c2Expenses).toHaveLength(1)
  })
})
