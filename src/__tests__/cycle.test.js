import { describe, it, expect } from 'vitest'
import {
  findCycleForDate,
  getCurrentCycle,
  getCycleEndDate,
  getDaysLeft,
  isCycleEnded,
  getExpensesForCycle,
  suggestNextStartDate,
  validateStartDateEdit,
  checkLowBalance,
  getCycleEditAllowedRange,
  findInvalidCycles,
  repairInvalidCycleDate,
  validateAmount,
  isMuchLargerThanLastCycle,
  getDeleteCycleImpact
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
    
    it('start Oct 4 with pay day 22 ends Oct 21', () => {
      const cycles = [{ id: 1, startDate: '2026-10-04' }]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-10-21')
    })

    it('start on the 22nd ends next month 21st', () => {
      const cycles = [{ id: 1, startDate: '2026-10-22' }]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-11-21')
    })

    it('start after the pay day ends next month', () => {
      const cycles = [{ id: 1, startDate: '2026-10-25' }]
      expect(getCycleEndDate(0, cycles, 22)).toBe('2026-11-21')
    })

    it('pay days 31 and last', () => {
      const cycles1 = [{ id: 1, startDate: '2026-02-05' }]
      // 31 in Feb clamps to 28 (or 29). So next 31st is Feb 28. End is Feb 27.
      expect(getCycleEndDate(0, cycles1, 31)).toBe('2026-02-27')
      
      const cycles2 = [{ id: 1, startDate: '2026-04-10' }]
      // 'last' in April is April 30. End is April 29.
      expect(getCycleEndDate(0, cycles2, 'last')).toBe('2026-04-29')
      
      // Start on 30th of April with 'last' -> ends May 30 (since May last is 31)
      const cycles3 = [{ id: 1, startDate: '2026-04-30' }]
      expect(getCycleEndDate(0, cycles3, 'last')).toBe('2026-05-30')
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
      expect(cycleBExpenses.map(e => e.id)).toEqual([3])
    })

    it('Handles expenses outside any cycle (unassigned)', () => {
      const cycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-20' }
      ]
      // Passing undefined for cycle to get unassigned
      const unassigned = getExpensesForCycle(undefined, expenses, cycles, 22)
      expect(unassigned.map(e => e.id)).toEqual([1, 4])
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

  describe('E. Allowed range calculation (getCycleEditAllowedRange)', () => {
    const today = '2026-10-24'
    const cycles = [
      { id: 1, startDate: '2026-08-22' },
      { id: 2, startDate: '2026-09-22' },
      { id: 3, startDate: '2026-10-22' }
    ]

    it('middle cycle: min is day after prev, max is day before next', () => {
      const range = getCycleEditAllowedRange(1, cycles, today)
      expect(range.min).toBe('2026-08-23')
      expect(range.max).toBe('2026-10-21')
      expect(range.prev.startDate).toBe('2026-08-22')
      expect(range.next.startDate).toBe('2026-10-22')
    })

    it('first cycle: min is 2000-01-01, max is day before next', () => {
      const range = getCycleEditAllowedRange(0, cycles, today)
      expect(range.min).toBe('2000-01-01')
      expect(range.max).toBe('2026-09-21')
      expect(range.prev).toBeNull()
      expect(range.next.startDate).toBe('2026-09-22')
    })

    it('latest cycle: min is day after prev, max is 7 days from today', () => {
      const range = getCycleEditAllowedRange(2, cycles, today)
      expect(range.min).toBe('2026-09-23')
      expect(range.max).toBe('2026-10-31')
      expect(range.prev.startDate).toBe('2026-09-22')
      expect(range.next).toBeNull()
    })

    it('single cycle: min is 2000-01-01, max is 7 days from today', () => {
      const single = [{ id: 1, startDate: '2026-10-22' }]
      const range = getCycleEditAllowedRange(0, single, today)
      expect(range.min).toBe('2000-01-01')
      expect(range.max).toBe('2026-10-31')
      expect(range.prev).toBeNull()
      expect(range.next).toBeNull()
    })
  })

  describe('F. Validation messages (validateStartDateEdit)', () => {
    const today = '2026-10-24'
    const cycles = [
      { id: 1, startDate: '2026-09-22' },
      { id: 2, startDate: '2026-10-22' }
    ]

    it('shows "Enter a valid date." for empty or incomplete dates', () => {
      const r1 = validateStartDateEdit('', 0, cycles, 22, today)
      expect(r1.valid).toBe(false)
      expect(r1.error).toBe('Enter a valid date.')

      const r2 = validateStartDateEdit('dd-05-0005', 0, cycles, 22, today)
      expect(r2.valid).toBe(false)
      expect(r2.error).toBe('Enter a valid date.')

      const r3 = validateStartDateEdit('2026-05-', 0, cycles, 22, today)
      expect(r3.valid).toBe(false)
      expect(r3.error).toBe('Enter a valid date.')
    })

    it('shows "Start date cannot be before 2000." for years before 2000', () => {
      const r1 = validateStartDateEdit('0005-05-01', 0, cycles, 22, today)
      expect(r1.valid).toBe(false)
      expect(r1.error).toBe('Start date cannot be before 2000.')

      const r2 = validateStartDateEdit('1999-12-31', 0, cycles, 22, today)
      expect(r2.valid).toBe(false)
      expect(r2.error).toBe('Start date cannot be before 2000.')
    })

    it('shows "Start date cannot be more than 7 days in the future." when past 7 days', () => {
      const r1 = validateStartDateEdit('2026-11-01', 1, cycles, 22, today)
      expect(r1.valid).toBe(false)
      expect(r1.error).toBe('Start date cannot be more than 7 days in the future.')
    })

    it('names neighbouring next cycle and allowed range when overlapping next', () => {
      // Editing cycle 0 (Sep 22). Next cycle is Oct 22.
      // Date on or after Oct 22:
      const r = validateStartDateEdit('2026-10-22', 0, cycles, 22, today)
      expect(r.valid).toBe(false)
      expect(r.error).toBe('Start date must be before Oct 22 (the next cycle starts on Oct 22).')
    })

    it('names neighbouring prev cycle and allowed range when overlapping prev', () => {
      // Editing cycle 1 (Oct 22). Prev cycle is Sep 22.
      // Date on or before Sep 22:
      const r = validateStartDateEdit('2026-09-22', 1, cycles, 22, today)
      expect(r.valid).toBe(false)
      expect(r.error).toBe('Start date must be after Sep 22 (the previous cycle starts on Sep 22).')
    })

    it('names both neighbours when middle cycle overlaps next or prev', () => {
      const threeCycles = [
        { id: 1, startDate: '2026-09-22' },
        { id: 2, startDate: '2026-10-10' },
        { id: 3, startDate: '2026-10-22' }
      ]
      // Overlap next
      const rNext = validateStartDateEdit('2026-10-22', 1, threeCycles, 22, today)
      expect(rNext.valid).toBe(false)
      expect(rNext.error).toBe('Start date must be after Sep 22 and before Oct 22 (the next cycle starts on Oct 22).')

      // Overlap prev
      const rPrev = validateStartDateEdit('2026-09-20', 1, threeCycles, 22, today)
      expect(rPrev.valid).toBe(false)
      expect(rPrev.error).toBe('Start date must be after Sep 22 and before Oct 22 (the previous cycle starts on Sep 22).')
    })

    it('allows valid dates within the allowed range', () => {
      const r = validateStartDateEdit('2026-10-05', 0, cycles, 22, today)
      expect(r.valid).toBe(true)
      expect(r.error).toBeNull()
    })

    it('identifies orphaned extras when start date moves forward', () => {
      const cyclesWithExtras = [
        { id: 1, startDate: '2026-09-22', extras: [{ date: '2026-09-25' }, { date: '2026-10-18' }] },
        { id: 2, startDate: '2026-10-22' }
      ]
      const res = validateStartDateEdit('2026-09-30', 0, cyclesWithExtras, 22, today)
      expect(res.valid).toBe(true)
      expect(res.orphanedExtras.length).toBe(1)
      expect(res.orphanedExtras[0].date).toBe('2026-09-25')
    })

    it('identifies orphaned expenses when start date moves forward', () => {
      const allExpenses = [
        { id: 10, date: '2026-09-23', amount: 500, categoryId: 'food' },
        { id: 11, date: '2026-10-01', amount: 1500, categoryId: 'food' }
      ]
      const res = validateStartDateEdit('2026-09-25', 0, cycles, 22, allExpenses, today)
      expect(res.valid).toBe(true)
      expect(res.orphanedExpenses.length).toBe(1)
      expect(res.orphanedExpenses[0].id).toBe(10)
    })
  })

  describe('G. Invalid cycles detection and repair (findInvalidCycles, repairInvalidCycleDate)', () => {
    const today = '2026-10-24'

    it('detects cycles with year < 2000, > 1 year in future, or invalid format', () => {
      const badCycles = [
        { id: 1, startDate: '0005-05-01' },
        { id: 2, startDate: '1998-11-20' },
        { id: 3, startDate: '2026-09-22' },
        { id: 4, startDate: '2029-01-01' },
        { id: 5, startDate: 'invalid-date' }
      ]
      const invalid = findInvalidCycles(badCycles, today)
      expect(invalid.map(c => c.id)).toEqual([1, 2, 4, 5])
    })

    it('repairs invalid cycle date based on neighbouring cycles or cycleDay', () => {
      const badCycles = [
        { id: 1, startDate: '2026-08-22' },
        { id: 2, startDate: '0005-05-01' },
        { id: 3, startDate: '2026-10-22' }
      ]
      const repaired = repairInvalidCycleDate(badCycles[1], badCycles, 22, today)
      expect(repaired).toBe('2026-09-22')
    })

    it('repairs first invalid cycle using next cycle', () => {
      const badCycles = [
        { id: 1, startDate: '0005-05-01' },
        { id: 2, startDate: '2026-10-22' }
      ]
      const repaired = repairInvalidCycleDate(badCycles[0], badCycles, 22, today)
      expect(repaired).toBe('2026-09-22')
    })
  })
  
  describe('H. suggestNextStartDate', () => {
    it('Suggests current month if cycle day not passed', () => {
      expect(suggestNextStartDate(22, '2026-10-04')).toBe('2026-10-22')
    })
    
    it('Suggests next month if cycle day already passed', () => {
      expect(suggestNextStartDate(22, '2026-10-23')).toBe('2026-11-22')
    })
  })
  describe('I. Pay day clamping and "last" month options', () => {
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


describe('checkLowBalance', () => {
  it('returns true when remaining is exactly equal to threshold', () => {
    expect(checkLowBalance(500, 500)).toBe(true)
  })
  it('returns true when remaining is below threshold', () => {
    expect(checkLowBalance(400, 500)).toBe(true)
  })
  it('returns false when remaining is above threshold', () => {
    expect(checkLowBalance(600, 500)).toBe(false)
  })
  it('returns false when threshold is null or undefined', () => {
    expect(checkLowBalance(400, null)).toBe(false)
    expect(checkLowBalance(400, undefined)).toBe(false)
  })
})

describe('getCurrentCycle', () => {
  const today = '2026-10-24'
  const cycleDay = 24

  it('selects the cycle that contains today, never the latest future cycle', () => {
    const cycles = [
      { id: 1, startDate: '2026-09-24', income: 50000 },
      { id: 2, startDate: '2026-10-24', income: 50000 },
      { id: 3, startDate: '2026-11-24', income: 2345678 } // future cycle from focus bug
    ]
    // Today is 2026-10-24. Cycle 2 starts 2026-10-24 and ends 2026-11-23.
    // Cycle 3 starts in the future.
    const current = getCurrentCycle(cycles, cycleDay, today)
    expect(current).toBeDefined()
    expect(current.id).toBe(2)
  })

  it('selects current cycle in the middle of the list', () => {
    const cycles = [
      { id: 1, startDate: '2026-08-01' },
      { id: 2, startDate: '2026-09-01' },
      { id: 3, startDate: '2026-10-01' },
      { id: 4, startDate: '2026-11-01' }
    ]
    // today is 2026-09-15 -> cycle 2 contains today (index 1)
    const current = getCurrentCycle(cycles, 1, '2026-09-15')
    expect(current?.id).toBe(2)
  })

  it('returns null when today has passed all cycles or when all cycles are in the future', () => {
    const cycles = [
      { id: 1, startDate: '2026-09-01' },
      { id: 2, startDate: '2026-10-01' }  // ends 2026-10-31 (with cycleDay 1)
    ]
    // 1. Today is after all cycles have ended (2026-11-15 > 2026-10-31)
    expect(getCurrentCycle(cycles, 1, '2026-11-15')).toBeNull()

    // 2. Today is before all cycles (2026-08-15 < 2026-09-01)
    expect(getCurrentCycle(cycles, 1, '2026-08-15')).toBeNull()
  })
})

describe('validateAmount & isMuchLargerThanLastCycle', () => {
  it('validateAmount rejects zero and negative amounts', () => {
    expect(validateAmount(0, '₹').valid).toBe(false)
    expect(validateAmount(0, '₹').error).toBe('Amount must be greater than 0.')

    expect(validateAmount(-100, '₹').valid).toBe(false)
    expect(validateAmount(-100, '₹').error).toBe('Amount must be greater than 0.')

    expect(validateAmount(NaN, '₹').valid).toBe(false)
  })

  it('validateAmount enforces hard max of 1,000,000,000 minor units', () => {
    expect(validateAmount(1_000_000_000, '₹').valid).toBe(true)

    const overMax = validateAmount(1_000_000_001, '₹')
    expect(overMax.valid).toBe(false)
    expect(overMax.error).toContain('Amount cannot exceed')
  })

  it('validateAmount accepts valid amounts', () => {
    expect(validateAmount(5000, '₹').valid).toBe(true)
    expect(validateAmount(5000, '₹').error).toBeNull()
  })

  it('isMuchLargerThanLastCycle flags amounts more than 10x previous cycle', () => {
    const lastCycleAmount = 5000000 // 50,000.00
    // Exactly 10x is not more than 10x
    expect(isMuchLargerThanLastCycle(50000000, lastCycleAmount)).toBe(false)
    // 10x + 1 is more than 10x
    expect(isMuchLargerThanLastCycle(50000001, lastCycleAmount)).toBe(true)
    // 2,345,678 (234,567,800 minor units) is ~46x
    expect(isMuchLargerThanLastCycle(234567800, lastCycleAmount)).toBe(true)
  })

  it('isMuchLargerThanLastCycle returns false if no previous cycle or last amount is 0', () => {
    expect(isMuchLargerThanLastCycle(5000000, 0)).toBe(false)
    expect(isMuchLargerThanLastCycle(5000000, null)).toBe(false)
    expect(isMuchLargerThanLastCycle(5000000, undefined)).toBe(false)
  })
})

describe('getDeleteCycleImpact', () => {
  const cycles = [
    { id: 1, startDate: '2026-08-22', income: 50000, extras: [] },
    { id: 2, startDate: '2026-09-22', income: 50000, extras: [{ amount: 1000, date: '2026-09-25' }, { amount: 2000, date: '2026-10-05' }] },
    { id: 3, startDate: '2026-10-22', income: 50000, extras: [{ amount: 500, date: '2026-10-25' }] }
  ]
  const expenses = [
    { id: 10, date: '2026-08-25', amount: 500 }, // cycle 1
    { id: 20, date: '2026-09-23', amount: 1200 }, // cycle 2
    { id: 21, date: '2026-10-10', amount: 800 },  // cycle 2
    { id: 30, date: '2026-10-23', amount: 300 }   // cycle 3
  ]

  it('calculates orphaned expenses and extras when deleting the latest cycle', () => {
    // When cycle 3 is deleted, remaining cycles are 1 and 2.
    // Cycle 2 ends on 2026-10-21.
    // Expense id:30 (date 2026-10-23) falls outside any cycle afterward!
    const impact = getDeleteCycleImpact(cycles[2], cycles, expenses, 22)
    expect(impact.orphanedExpensesCount).toBe(1)
    expect(impact.orphanedExtrasCount).toBe(1)
  })

  it('calculates orphaned extras when middle cycle expenses are absorbed by previous cycle', () => {
    // When cycle 2 is deleted, cycle 1's end date extends to cycle 3's start date (2026-10-21).
    // Expenses 20 and 21 are absorbed into cycle 1, so 0 expenses are orphaned.
    // However, cycle 2's 2 extra-money entries are orphaned.
    const impact = getDeleteCycleImpact(cycles[1], cycles, expenses, 22)
    expect(impact.orphanedExpensesCount).toBe(0)
    expect(impact.orphanedExtrasCount).toBe(2)
  })

  it('calculates orphaned expenses when the only cycle is deleted', () => {
    const singleCycle = cycles[0]
    const impact = getDeleteCycleImpact(singleCycle, [singleCycle], [expenses[0]], 22)
    expect(impact.orphanedExpensesCount).toBe(1)
    expect(impact.orphanedExtrasCount).toBe(0)
  })

  it('returns 0 when cycle has no expenses or extras', () => {
    const emptyCycle = { id: 4, startDate: '2026-11-22', income: 50000, extras: [] }
    const impact = getDeleteCycleImpact(emptyCycle, [...cycles, emptyCycle], expenses, 22)
    expect(impact.orphanedExpensesCount).toBe(0)
    expect(impact.orphanedExtrasCount).toBe(0)
  })
})
