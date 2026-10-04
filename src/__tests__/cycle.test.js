import { describe, it, expect } from 'vitest'
import {
  findCycleForDate,
  getCycleEndDate,
  getDaysLeft,
  isCycleEnded,
  getExpensesForCycle,
  suggestNextStartDate,
  validateStartDateEdit
} from '../lib/cycle'

describe('Cycle Logic', () => {
  describe('A. Finding the current cycle (findCycleForDate)', () => {
    it('Single cycle: returns the cycle if date is on or after start date', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22', income: 5000 }]
      expect(findCycleForDate('2026-10-04', cycles)).toEqual(cycles[0])
    })

    it('Single cycle: returns undefined if date is before start date', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22', income: 5000 }]
      expect(findCycleForDate('2026-09-21', cycles)).toBeUndefined()
    })

    it('Multiple cycles: returns correct cycle for a given date', () => {
      const cycles = [
        { id: 1, startDate: '2026-07-22' },
        { id: 2, startDate: '2026-08-20' },
        { id: 3, startDate: '2026-09-25' }
      ]
      expect(findCycleForDate('2026-10-04', cycles)).toEqual(cycles[2])
      expect(findCycleForDate('2026-08-19', cycles)).toEqual(cycles[0])
    })

    it('Exact boundary: date equals start date belongs to that cycle', () => {
      const cycles = [
        { id: 1, startDate: '2026-08-20' },
        { id: 2, startDate: '2026-09-25' }
      ]
      expect(findCycleForDate('2026-09-25', cycles)).toEqual(cycles[1])
      expect(findCycleForDate('2026-09-24', cycles)).toEqual(cycles[0])
    })

    it('Dec → Jan boundary: handles year transition correctly', () => {
      const cycles = [
        { id: 1, startDate: '2026-11-22' },
        { id: 2, startDate: '2026-12-22' }
      ]
      expect(findCycleForDate('2027-01-05', cycles)).toEqual(cycles[1])
    })
  })

  describe('B. Deriving cycle end dates (getCycleEndDate)', () => {
    it('Two adjacent cycles: end date is day before next cycle', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-20' }
      ]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-10-19')
    })

    it('Current cycle (no next): projects end based on cycleDay setting', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22' }]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-10-21')
    })

    it('Irregular spacing: handles late pay gracefully', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-25' }
      ]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-10-24')
    })

    it('cycleDay suggestions: projects correctly based on setting (e.g. 1st or 28th)', () => {
      const cycles = [{ id: 1, startDate: '2026-09-01' }]
      expect(getCycleEndDate(0, cycles, 1)).toBe('2026-09-30')
      
      const cycles2 = [{ id: 1, startDate: '2026-12-28' }]
      expect(getCycleEndDate(0, cycles2, 28)).toBe('2027-01-27')
    })
  })

  describe('C. Days left & Ended status (getDaysLeft, isCycleEnded)', () => {
    it('Days left includes today and correctly computes diff', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22' }]
      // Projected end is 2026-10-21
      expect(getDaysLeft(0, cycles, 22, '2026-10-04')).toBe(18) // 4th to 21st is 18 days
    })

    it('Days left on start day is max, on end day is 1', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22' }] // ends 10-21
      expect(getDaysLeft(0, cycles, 22, '2026-09-22')).toBe(30)
      expect(getDaysLeft(0, cycles, 22, '2026-10-21')).toBe(1)
    })

    it('Cycle ended state when today is past projected end', () => {
      const cycles = [{ id: 1, startDate: '2026-09-22' }] // ends 10-21
      expect(isCycleEnded(0, cycles, 22, '2026-10-22')).toBe(true)
      expect(getDaysLeft(0, cycles, 22, '2026-10-22')).toBe(0)
    })
  })

  describe('D. Expense assignment (getExpensesForCycle)', () => {
    const expenses = [
      { id: 1, date: '2026-09-20' }, // before A
      { id: 2, date: '2026-09-25' }, // inside A
      { id: 3, date: '2026-10-18' }, // inside A (originally)
      { id: 4, date: '2026-10-22' }  // inside B
    ]
    
    it('Assigns expenses to the correct cycle bounds', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-20' }
      ]
      const cycleAExpenses = getExpensesForCycle(cycles[0], expenses, cycles, 22)
      expect(cycleAExpenses.map(e => e.id)).toEqual([2, 3])
    })

    it('Expense shifts to next cycle if next cycle start is moved earlier', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-18' } // Edited from 20
      ]
      const cycleAExpenses = getExpensesForCycle(cycles[0], expenses, cycles, 22)
      expect(cycleAExpenses.map(e => e.id)).toEqual([2])
      
      const cycleBExpenses = getExpensesForCycle(cycles[1], expenses, cycles, 22)
      expect(cycleBExpenses.map(e => e.id)).toEqual([3, 4])
    })

    it('Handles expenses outside any cycle (unassigned)', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-20' }
      ]
      // Passing undefined for cycle to get unassigned
      const unassigned = getExpensesForCycle(undefined, expenses, cycles, 22)
      expect(unassigned.map(e => e.id)).toEqual([1])
    })
    
    it('No expenses orphaned (all accounted for)', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-20' }
      ]
      const c1 = getExpensesForCycle(cycles[0], expenses, cycles, 22)
      const c2 = getExpensesForCycle(cycles[1], expenses, cycles, 22)
      const unassigned = getExpensesForCycle(undefined, expenses, cycles, 22)
      
      expect(c1.length + c2.length + unassigned.length).toBe(expenses.length)
    })
  })

  describe('E. Validation (validateStartDateEdit)', () => {
    const cycles = [
      { id: 1, startDate: '2026-09-22' },
      { id: 2, startDate: '2026-10-20' },
      { id: 3, startDate: '2026-11-18' }
    ]

    it('Overlap prevention: rejects if new date is before prev cycle start', () => {
      expect(validateStartDateEdit('2026-09-20', 1, cycles, 22).valid).toBe(false)
    })

    it('Overlap prevention: rejects if new date equals or is after next cycle start', () => {
      expect(validateStartDateEdit('2026-11-18', 1, cycles, 22).valid).toBe(false)
      expect(validateStartDateEdit('2026-11-19', 1, cycles, 22).valid).toBe(false)
    })

    it('Allows valid edits between bounds', () => {
      expect(validateStartDateEdit('2026-10-15', 1, cycles, 22).valid).toBe(true)
    })

    it('Single cycle edge case: allows any edit if it is the only cycle', () => {
      const singleCycle = [{ id: 1, startDate: '2026-09-22' }]
      expect(validateStartDateEdit('2025-01-01', 0, singleCycle, 22).valid).toBe(true)
      expect(validateStartDateEdit('2027-01-01', 0, singleCycle, 22).valid).toBe(true)
    })
    
    it('Identifies extras that would fall outside the cycle', () => {
      const cyclesWithExtras = [
        { id: 1, startDate: '2026-09-22', extras: [{ date: '2026-09-25' }, { date: '2026-10-18' }] },
        { id: 2, startDate: '2026-10-20' }
      ]
      // Edit cycle 1 start date to 2026-09-30 -> the 09-25 extra is orphaned
      const res = validateStartDateEdit('2026-09-30', 0, cyclesWithExtras, 22)
      expect(res.valid).toBe(true)
      expect(res.orphanedExtras.length).toBe(1)
      expect(res.orphanedExtras[0].date).toBe('2026-09-25')
    })
  })
  
  describe('F. suggestNextStartDate', () => {
    it('Suggests current month if cycle day not passed', () => {
      expect(suggestNextStartDate(22, '2026-10-04')).toBe('2026-10-22')
    })
    
    it('Suggests next month if cycle day already passed', () => {
      expect(suggestNextStartDate(22, '2026-10-23')).toBe('2026-11-22')
    })
  })
  describe('G. Pay day clamping and "last" month options', () => {
    it('Clamps 31 to 30 in short months (April)', () => {
      // suggestNextStartDate(31, '2026-04-01') -> April has 30 days
      expect(suggestNextStartDate(31, '2026-04-01')).toBe('2026-04-30')
    })
    
    it('Clamps 30 to 28 or 29 in February', () => {
      // 2026 is non-leap (28 days)
      expect(suggestNextStartDate(30, '2026-02-01')).toBe('2026-02-28')
      // 2024 is leap (29 days)
      expect(suggestNextStartDate(30, '2024-02-01')).toBe('2024-02-29')
    })
    
    it('Handles "last" option correctly across various months', () => {
      expect(suggestNextStartDate('last', '2026-01-01')).toBe('2026-01-31')
      expect(suggestNextStartDate('last', '2026-02-01')).toBe('2026-02-28')
      expect(suggestNextStartDate('last', '2024-02-01')).toBe('2024-02-29')
      expect(suggestNextStartDate('last', '2026-04-01')).toBe('2026-04-30')
    })
    
    it('Projects cycle end date correctly with "last"', () => {
      const cycles = [{ id: 1, startDate: '2026-01-31' }]
      // Next cycle starts 'last' of Feb -> 2026-02-28. End date is 2026-02-27.
      expect(getCycleEndDate(0, cycles, 'last')).toBe('2026-02-27')
    })

    it('Crosses Dec to Jan correctly with clamping', () => {
      // Dec 31
      expect(suggestNextStartDate(31, '2026-12-01')).toBe('2026-12-31')
      expect(suggestNextStartDate(31, '2027-01-01')).toBe('2027-01-31')
      
      const cycles = [{ id: 1, startDate: '2026-12-31' }]
      // Next start is Jan 31 -> end is Jan 30
      expect(getCycleEndDate(0, cycles, 31)).toBe('2027-01-30')
    })
  })
})
