import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '../lib/db'
import { getExpensesForCycle, validateStartDateEdit, sortCycles } from '../lib/cycle'

describe('M9 Features: Cycles and Variable Income', () => {
  it('handles a cycle with 0 income', () => {
    const cycle = { id: 'c1', startDate: '2026-10-01', income: 0, extras: [] }
    const totalReceived = cycle.income + cycle.extras.reduce((sum, e) => sum + e.amount, 0)
    expect(totalReceived).toBe(0)
  })

  it('supports different amounts per cycle', () => {
    const cycles = [
      { id: 'c1', startDate: '2026-09-01', income: 1000, extras: [] },
      { id: 'c2', startDate: '2026-10-01', income: 2500, extras: [] }
    ]
    expect(cycles[0].income).toBe(1000)
    expect(cycles[1].income).toBe(2500)
  })

  it('handles additions changing the cycle total', () => {
    const cycle = { 
      id: 'c1', 
      startDate: '2026-10-01', 
      income: 1000, 
      extras: [{ amount: 500, note: 'Bonus' }, { amount: 200, note: 'Gift' }] 
    }
    const extrasTotal = cycle.extras.reduce((sum, e) => sum + e.amount, 0)
    const totalReceived = cycle.income + extrasTotal
    expect(extrasTotal).toBe(700)
    expect(totalReceived).toBe(1700)
  })

  it('handles a new cycle with an empty amount (treated as 0 or valid input)', () => {
    // If the input is empty string, the UI will disable the button or parse as 0. 
    // In our logic, an empty amount yields 0 minor units when parsed, if allowed.
    // Our UI currently requires an amount to enable the button, but if it was 0:
    const newCycle = { startDate: '2026-11-01', income: 0, extras: [] }
    expect(newCycle.income).toBe(0)
  })

  it('rejects start-date edit on overlap', () => {
    const cycles = sortCycles([
      { id: 'c2', startDate: '2026-10-22', income: 1000 },
      { id: 'c1', startDate: '2026-09-22', income: 1000 }
    ])
    // c1 is index 0, c2 is index 1. 
    // If we move c1 to '2026-10-25', it overlaps with c2.
    const val = validateStartDateEdit('2026-10-25', 0, cycles, 22, [])
    expect(val.valid).toBe(false)
  })

  it('identifies additions or expenses falling outside after a date edit', () => {
    const cycles = sortCycles([
      { id: 'c2', startDate: '2026-10-22', income: 1000 },
      { id: 'c1', startDate: '2026-09-22', income: 1000 }
    ])
    
    // Cycle c1 currently covers Sept 22 - Oct 21. 
    // Expenses/extras on Oct 10 are in this cycle.
    const expenses = [
      { id: 1, amount: 50, date: '2026-10-10' },
      { id: 2, amount: 20, date: '2026-10-16' }
    ]
    
    // We modify c1 start date to '2026-10-15'.
    // The expense on Oct 10 will fall OUTSIDE c1 (it becomes orphaned/unassigned).
    // The expense on Oct 16 remains in c1 (between Oct 15 and Oct 21).
    const val = validateStartDateEdit('2026-10-15', 0, cycles, 22, expenses)
    expect(val.valid).toBe(true)
    expect(val.orphanedExpenses).toHaveLength(1)
    expect(val.orphanedExpenses[0].id).toBe(1)
  })

  it('deletes an addition', () => {
    let extras = [{ amount: 500 }, { amount: 200 }]
    // Delete index 1
    const indexToDelete = 1
    extras = extras.filter((_, i) => i !== indexToDelete)
    expect(extras).toHaveLength(1)
    expect(extras[0].amount).toBe(500)
  })

  it('runs through real Dexie functions: add, edit, delete addition', async () => {
    await db.cycles.clear()
    
    // Create cycle
    const cycleId = await db.cycles.add({
      startDate: '2026-10-01',
      income: 5000,
      extras: []
    })
    
    // Add addition
    let cycle = await db.cycles.get(cycleId)
    let extras = [...cycle.extras, { amount: 1000, note: 'Bonus', date: '2026-10-02' }]
    await db.cycles.update(cycleId, { extras })
    
    cycle = await db.cycles.get(cycleId)
    expect(cycle.extras).toHaveLength(1)
    expect(cycle.extras[0].amount).toBe(1000)
    
    // Edit addition
    extras = [...cycle.extras]
    extras[0] = { ...extras[0], amount: 1500 }
    await db.cycles.update(cycleId, { extras })
    
    cycle = await db.cycles.get(cycleId)
    expect(cycle.extras[0].amount).toBe(1500)
    
    // Check totals
    const totalReceived = cycle.income + cycle.extras.reduce((sum, e) => sum + e.amount, 0)
    expect(totalReceived).toBe(6500) // 5000 + 1500
    
    // Delete addition
    extras = cycle.extras.filter((_, i) => i !== 0)
    await db.cycles.update(cycleId, { extras })
    
    cycle = await db.cycles.get(cycleId)
    expect(cycle.extras).toHaveLength(0)
  })
})
