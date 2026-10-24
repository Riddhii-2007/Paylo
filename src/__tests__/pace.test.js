import { describe, it, expect } from 'vitest'
import { calculatePace } from '../lib/pace.js'

describe('Pace & Daily Budget Logic (calculatePace)', () => {
  const defaultCycle = {
    id: 'cycle-1',
    startDate: '2026-10-01',
    income: 50000, // 500.00
    extras: []
  }

  it('no expenses gives "—" with caption "Needs a few days of data"', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [],
      allCycles: [defaultCycle],
      today: '2026-10-05',
      cycleDay: 1,
      remaining: 50000,
      daysLeft: 26,
    })

    expect(result.avgPerDay).toBeNull()
    expect(result.avgLabel).toBe('Avg per day')
    expect(result.avgCaption).toBe('Needs a few days of data')
    expect(result.paceMessage).toBeNull()
  })

  it('2 days elapsed gives "—"', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [{ amount: 1000, date: '2026-10-02' }],
      allCycles: [defaultCycle],
      today: '2026-10-02', // 2nd day (daysElapsed = 2)
      cycleDay: 1,
      remaining: 49000,
      daysLeft: 29,
    })

    expect(result.daysElapsed).toBe(2)
    expect(result.avgPerDay).toBeNull()
    expect(result.avgCaption).toBe('Needs a few days of data')
    expect(result.paceMessage).toBeNull()
  })

  it('3 days with spending gives the right average', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [
        { amount: 3000, date: '2026-10-01' },
        { amount: 6000, date: '2026-10-02' }
      ],
      allCycles: [defaultCycle],
      today: '2026-10-03', // 3rd day (daysElapsed = 3)
      cycleDay: 1,
      remaining: 41000,
      daysLeft: 28,
    })

    expect(result.daysElapsed).toBe(3)
    // 9000 / 3 = 3000
    expect(result.avgPerDay).toBe(3000)
    expect(result.isCurrentAvg).toBe(true)
    expect(result.avgLabel).toBe('Avg per day')
    expect(result.avgCaption).toBeNull()
    expect(result.paceMessage).not.toBeNull()
  })

  it('under-pace message when projectedLeft >= 0', () => {
    // avg = 1000, daysLeft = 10 -> projected spending = 10000. Remaining = 25000 -> projectedLeft = 15000
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [
        { amount: 3000, date: '2026-10-01' }
      ],
      allCycles: [defaultCycle],
      today: '2026-10-03', // daysElapsed = 3 -> avg = 1000
      cycleDay: 1,
      currency: 'USD',
      remaining: 25000,
      daysLeft: 10,
    })

    expect(result.projectedLeft).toBe(15000)
    expect(result.paceMessage).toContain("you'll finish with about")
    expect(result.paceMessage).toContain("left")
  })

  it('over-pace message when projectedLeft < 0', () => {
    // avg = 2000, daysLeft = 10. Remaining = 6000.
    // runsOutInDays = floor(6000 / 2000) = 3 days.
    // daysEarly = 10 - 3 = 7 days early.
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [
        { amount: 6000, date: '2026-10-01' }
      ],
      allCycles: [defaultCycle],
      today: '2026-10-03', // daysElapsed = 3 -> avg = 2000
      cycleDay: 1,
      currency: 'USD',
      remaining: 6000,
      daysLeft: 10,
    })

    expect(result.projectedLeft).toBe(-14000)
    expect(result.runsOutInDays).toBe(3)
    expect(result.daysEarly).toBe(7)
    expect(result.paceMessage).toContain("run out in 3 days, about 7 days early.")
  })

  it('zero spending with at least 1 expense handles zero division safely', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [{ amount: 0, date: '2026-10-01' }],
      allCycles: [defaultCycle],
      today: '2026-10-03', // daysElapsed = 3
      cycleDay: 1,
      currency: 'INR',
      remaining: 50000,
      daysLeft: 20,
    })

    expect(result.avgPerDay).toBe(0)
    expect(result.projectedLeft).toBe(50000)
    expect(result.paceMessage).toContain("you'll finish with about")
  })

  it('remaining 0 produces expected over-pace message and 0 daily budget', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [
        { amount: 15000, date: '2026-10-01' }
      ],
      allCycles: [defaultCycle],
      today: '2026-10-03', // daysElapsed = 3 -> avg = 5000
      cycleDay: 1,
      currency: 'USD',
      remaining: 0,
      daysLeft: 5,
    })

    expect(result.dailyBudget).toBe(0)
    expect(result.runsOutInDays).toBe(0)
    expect(result.daysEarly).toBe(5)
    expect(result.paceMessage).toContain("run out in 0 days, about 5 days early.")
  })

  it('the first day of a cycle gives daysElapsed = 1 and needs data for brand-new user', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [{ amount: 1000, date: '2026-10-01' }],
      allCycles: [defaultCycle],
      today: '2026-10-01',
      cycleDay: 1,
      remaining: 49000,
      daysLeft: 31,
    })

    expect(result.daysElapsed).toBe(1)
    expect(result.avgPerDay).toBeNull()
    expect(result.avgCaption).toBe('Needs a few days of data')
    expect(result.paceMessage).toBeNull()
  })

  it('the last day calculates pace correctly with daysLeft = 1', () => {
    const result = calculatePace({
      currentCycle: defaultCycle,
      cycleExpenses: [{ amount: 30000, date: '2026-10-01' }],
      allCycles: [defaultCycle],
      today: '2026-10-31', // 31 days elapsed -> avg = 30000 / 31 ~= 968
      cycleDay: 1,
      currency: 'INR',
      remaining: 20000,
      daysLeft: 1,
    })

    expect(result.daysLeft).toBeUndefined() // passed in
    expect(result.dailyBudget).toBe(20000) // remaining / 1
    expect(result.projectedLeft).toBe(20000 - result.avgPerDay * 1)
    expect(result.paceMessage).toContain("you'll finish with about")
  })

  it('previous-cycle fallback works from second cycle onward when current has < 3 days', () => {
    const cycle1 = { id: 'c1', startDate: '2026-09-01', income: 30000 }
    const cycle2 = { id: 'c2', startDate: '2026-10-01', income: 40000 }
    const allExpenses = [
      { amount: 3000, date: '2026-09-05' },
      { amount: 6000, date: '2026-09-15' },
    ]

    // Day 1 of cycle 2 (only 1 day elapsed in cycle 2)
    const result = calculatePace({
      currentCycle: cycle2,
      cycleExpenses: [],
      allCycles: [cycle1, cycle2],
      allExpenses,
      today: '2026-10-01',
      cycleDay: 1,
      currency: 'INR',
      remaining: 40000,
      daysLeft: 31,
    })

    expect(result.isCurrentAvg).toBe(false)
    expect(result.avgLabel).toBe('Last cycle avg')
    expect(result.avgCaption).toBeNull()
    expect(result.avgPerDay).toBeGreaterThan(0)
    // Pace line is only shown when current cycle Avg per day is available
    expect(result.paceMessage).toBeNull()
  })

  it('a cycle with no amount hides everything', () => {
    const emptyCycle = { id: 'c-empty', startDate: '2026-10-01', income: 0, extras: [] }
    const result = calculatePace({
      currentCycle: emptyCycle,
      cycleExpenses: [],
      allCycles: [emptyCycle],
      today: '2026-10-05',
      cycleDay: 1,
      remaining: 0,
      daysLeft: 26,
    })

    expect(result.hide).toBe(true)
    expect(result.dailyBudget).toBe(0)
    expect(result.avgPerDay).toBeNull()
    expect(result.paceMessage).toBeNull()
  })
})
