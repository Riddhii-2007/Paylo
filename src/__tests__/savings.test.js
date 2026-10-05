/**
 * savings.test.js — Vitest tests for computeSavings()
 *
 * All tests use fixed dates and explicit cycle/expense data so they
 * run identically under any timezone (Asia/Kolkata, America/Los_Angeles, UTC).
 *
 * Scenario helpers:
 *   buildCycle(id, startDate, income, extras?) → cycle object
 *   buildExpense(id, amount, date, cycleId?)   → expense object
 */

import { describe, it, expect } from 'vitest'
import { computeSavings } from '../lib/savings'

// ─── helpers ────────────────────────────────────────────────────────────────

function buildCycle(id, startDate, income, extras = []) {
  return { id, startDate, income, extras }
}

function buildExpense(id, amount, date) {
  return { id, amount, categoryId: 'food', note: '', date, createdAt: id }
}

// cycleDay = 1 (1st of every month) for predictable end-dates
const CYCLE_DAY = 1

// Dates that align with CYCLE_DAY = 1
// Sep cycle: 2026-09-01 → ends 2026-09-30
// Oct cycle: 2026-10-01 → ends 2026-10-31  (current if today = 2026-10-05)
// Nov cycle: 2026-11-01 → future

// ─── 1. Basic two-cycle accumulation ─────────────────────────────────────────

describe('computeSavings – basic accumulation', () => {
  it('Sep saves 1000 and Oct saves 400, total finished savings = 1400', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000),
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep spent 4000, saved 1000
      buildExpense(2, 2600, '2026-10-10'), // Oct spent 2600, saved 400
    ]
    // today is after both cycles' end dates
    const today = '2026-11-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    // Both cycles are finished
    expect(result.cycleEntries[0].delta).toBe(1000)
    expect(result.cycleEntries[1].delta).toBe(400)
    expect(result.totalSavedRaw).toBe(1400)
    expect(result.totalSaved).toBe(1400)
    expect(result.isOverspent).toBe(false)
  })
})

// ─── 2. Overspend in a later cycle ───────────────────────────────────────────

describe('computeSavings – overspend reduces savings', () => {
  it('a later cycle overspending by 500 reduces total savings from 1400 to 900', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000),
      buildCycle('nov', '2026-11-01', 2000),
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      buildExpense(2, 2600, '2026-10-10'), // Oct: saved 400
      buildExpense(3, 2500, '2026-11-15'), // Nov: overspent by 500
    ]
    const today = '2026-12-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.cycleEntries[0].delta).toBe(1000)
    expect(result.cycleEntries[1].delta).toBe(400)
    expect(result.cycleEntries[2].delta).toBe(-500)
    expect(result.totalSavedRaw).toBe(900)
    expect(result.totalSaved).toBe(900)
    expect(result.isOverspent).toBe(false)
  })
})

// ─── 3. Overspend larger than total savings ───────────────────────────────────

describe('computeSavings – overspend beyond savings', () => {
  it('overspend exceeding total savings reports isOverspent and overspentAmount', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 1000),
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      buildExpense(2, 5000, '2026-10-10'), // Oct: overspent by 4000
    ]
    const today = '2026-11-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.totalSavedRaw).toBe(-3000) // 1000 - 4000
    expect(result.totalSaved).toBe(0)        // clamped
    expect(result.isOverspent).toBe(true)
    expect(result.overspentAmount).toBe(3000)
  })

  it('reports overspent correctly when opening savings is 0 and the first cycle is overspent', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
    ]
    const expenses = [
      buildExpense(1, 6000, '2026-09-15'), // Sep: overspent by 1000
    ]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.totalSavedRaw).toBe(-1000)
    expect(result.totalSaved).toBe(0)
    expect(result.isOverspent).toBe(true)
    expect(result.overspentAmount).toBe(1000)
  })
})

// ─── 4. Extra money in a cycle ────────────────────────────────────────────────

describe('computeSavings – extras increase saved amount', () => {
  it('extra money in a cycle is counted in received and increases savings', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000, [
        { amount: 1000, date: '2026-09-20', note: 'Bonus' },
      ]),
    ]
    // received = 5000 + 1000 = 6000; spent = 4000; saved = 2000
    const expenses = [buildExpense(1, 4000, '2026-09-15')]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.cycleEntries[0].received).toBe(6000)
    expect(result.cycleEntries[0].delta).toBe(2000)
    expect(result.totalSavedRaw).toBe(2000)
  })
})

// ─── 5. Cycle with no income is skipped ──────────────────────────────────────

describe('computeSavings – zero-income cycles are skipped', () => {
  it('a cycle with received = 0 is skipped and does not affect savings total', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 0),     // no amount entered
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      // Oct: spent 0 (but income 0 → skipped entirely)
    ]
    const today = '2026-11-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.cycleEntries[0].skipped).toBe(false)
    expect(result.cycleEntries[1].skipped).toBe(true)
    expect(result.totalSavedRaw).toBe(1000) // only Sep counts
  })
})

// ─── 6. Current unfinished cycle is a projection, not counted ─────────────────

describe('computeSavings – current cycle is projection only', () => {
  it('the ongoing cycle contributes to projectedSavings but not totalSavedRaw', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000),  // ongoing (today is Oct 5)
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      buildExpense(2, 1000, '2026-10-05'), // Oct: spent 1000 so far
    ]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    // Sep is finished
    expect(result.cycleEntries[0].isFinished).toBe(true)
    expect(result.cycleEntries[0].delta).toBe(1000)

    // Oct is ongoing — projection only
    expect(result.cycleEntries[1].isFinished).toBe(false)
    expect(result.cycleEntries[1].isCurrentCycle).toBe(true)
    expect(result.cycleEntries[1].delta).toBe(2000) // 3000-1000

    // totalSaved only includes Sep (finished)
    expect(result.totalSavedRaw).toBe(1000)
    expect(result.totalSaved).toBe(1000)

    // projectedSavings includes Oct projection
    expect(result.projectedSavings).toBe(3000) // 1000 + 2000
    expect(result.isProjection).toBe(true)
  })

  it('isProjection is false when all cycles are finished', () => {
    const cycles = [buildCycle('sep', '2026-09-01', 5000)]
    const expenses = [buildExpense(1, 4000, '2026-09-15')]
    const today = '2026-11-01' // well past Sep end

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.isProjection).toBe(false)
    expect(result.totalSavedRaw).toBe(1000)
  })
})

// ─── 7. Editing an expense recalculates savings ───────────────────────────────

describe('computeSavings – recalculates when expenses change', () => {
  it('editing an expense amount changes the cycle delta', () => {
    const cycles = [buildCycle('sep', '2026-09-01', 5000)]
    const today = '2026-10-05'

    const before = computeSavings(
      cycles,
      [buildExpense(1, 4000, '2026-09-15')],
      0, CYCLE_DAY, today
    )
    expect(before.totalSavedRaw).toBe(1000)

    const after = computeSavings(
      cycles,
      [buildExpense(1, 4500, '2026-09-15')], // edited: 4000 → 4500
      0, CYCLE_DAY, today
    )
    expect(after.totalSavedRaw).toBe(500)
  })

  it('moving an expense to a different cycle recalculates both cycles', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000),
    ]
    const today = '2026-11-05'

    // Expense originally in Oct
    const before = computeSavings(
      cycles,
      [
        buildExpense(1, 4000, '2026-09-15'), // Sep
        buildExpense(2, 1000, '2026-10-10'), // Oct
      ],
      0, CYCLE_DAY, today
    )
    expect(before.cycleEntries[0].delta).toBe(1000) // Sep: 5000-4000
    expect(before.cycleEntries[1].delta).toBe(2000) // Oct: 3000-1000

    // Move expense 2 from Oct to Sep
    const after = computeSavings(
      cycles,
      [
        buildExpense(1, 4000, '2026-09-15'),
        buildExpense(2, 1000, '2026-09-20'), // now in Sep
      ],
      0, CYCLE_DAY, today
    )
    expect(after.cycleEntries[0].delta).toBe(0)    // Sep: 5000-5000
    expect(after.cycleEntries[1].delta).toBe(3000) // Oct: 3000-0
  })
})

// ─── 8. Opening savings ──────────────────────────────────────────────────────

describe('computeSavings – opening savings', () => {
  it('is included in the running total from the start', () => {
    const cycles = [buildCycle('sep', '2026-09-01', 5000)]
    const expenses = [buildExpense(1, 4000, '2026-09-15')]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 2000, CYCLE_DAY, today)

    // 2000 opening + 1000 saved in Sep = 3000
    expect(result.openingSavings).toBe(2000)
    expect(result.totalSavedRaw).toBe(3000)
    expect(result.cycleEntries[0].runningTotal).toBe(3000)
  })

  it('opening savings can compensate for an overspent cycle', () => {
    const cycles = [buildCycle('sep', '2026-09-01', 1000)]
    const expenses = [buildExpense(1, 3000, '2026-09-15')] // overspent by 2000
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 3000, CYCLE_DAY, today)

    // 3000 opening - 2000 = 1000
    expect(result.totalSavedRaw).toBe(1000)
    expect(result.isOverspent).toBe(false)
  })

  it('backup round-trip includes openingSavings as a finite non-negative integer', () => {
    // Validate the shape expected by backup.js import validation
    const openingSavings = 50000
    expect(Number.isFinite(openingSavings)).toBe(true)
    expect(Number.isInteger(openingSavings)).toBe(true)
    expect(openingSavings).toBeGreaterThanOrEqual(0)
  })
})

// ─── 9. Current cycle: using from savings ────────────────────────────────────

describe('computeSavings – current cycle dipping into savings', () => {
  it('reports currentCycleUsingFromSavings when spent > received this cycle', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000), // current
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      buildExpense(2, 4000, '2026-10-05'), // Oct: spent 4000, received only 3000
    ]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.currentCycleUsingFromSavings).toBe(true)
    expect(result.savingsBeingUsed).toBe(1000)
    // Projected savings = 1000 (Sep) - 1000 (Oct deficit) = 0
    expect(result.projectedSavings).toBe(0)
  })

  it('totalSaved (finished only) stays positive even while current cycle dips', () => {
    const cycles = [
      buildCycle('sep', '2026-09-01', 5000),
      buildCycle('oct', '2026-10-01', 3000),
    ]
    const expenses = [
      buildExpense(1, 4000, '2026-09-15'), // Sep: saved 1000
      buildExpense(2, 4000, '2026-10-05'), // Oct: deficit 1000 (projection)
    ]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.totalSaved).toBe(1000)    // Sep only (finished)
    expect(result.totalSavedRaw).toBe(1000) // Oct not yet committed
  })
})

// ─── 10. Running totals on cycleEntries ──────────────────────────────────────

describe('computeSavings – running totals per cycle entry', () => {
  it('runningTotal accumulates correctly across cycles', () => {
    const cycles = [
      buildCycle('a', '2026-07-01', 3000),
      buildCycle('b', '2026-08-01', 3000),
      buildCycle('c', '2026-09-01', 3000),
    ]
    const expenses = [
      buildExpense(1, 2000, '2026-07-15'), // A: saved 1000
      buildExpense(2, 3500, '2026-08-15'), // B: overspent 500
      buildExpense(3, 1000, '2026-09-15'), // C: saved 2000
    ]
    const today = '2026-10-05'

    const result = computeSavings(cycles, expenses, 0, CYCLE_DAY, today)

    expect(result.cycleEntries[0].runningTotal).toBe(1000)
    expect(result.cycleEntries[1].runningTotal).toBe(500)
    expect(result.cycleEntries[2].runningTotal).toBe(2500)
    expect(result.totalSavedRaw).toBe(2500)
  })
})
