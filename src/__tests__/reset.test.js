import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../lib/db'
import 'fake-indexeddb/auto'

describe('Reset all data', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.cycles.clear()
    await db.expenses.clear()
  })

  it('clears all databases when reset', async () => {
    // Seed some data
    await db.settings.put({ key: 'name', value: 'Test' })
    await db.cycles.add({ startDate: '2026-01-01', income: 1000, extras: [] })
    await db.expenses.add({ amount: 100, categoryId: 'food', note: '', date: '2026-01-02', createdAt: Date.now() })
    
    expect(await db.settings.count()).toBe(1)
    expect(await db.cycles.count()).toBe(1)
    expect(await db.expenses.count()).toBe(1)
    
    // Perform reset
    await Promise.all([
      db.settings.clear(),
      db.cycles.clear(),
      db.expenses.clear()
    ])
    
    expect(await db.settings.count()).toBe(0)
    expect(await db.cycles.count()).toBe(0)
    expect(await db.expenses.count()).toBe(0)
  })
})
