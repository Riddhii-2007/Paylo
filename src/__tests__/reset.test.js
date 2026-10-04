import { describe, it, expect, beforeEach } from 'vitest'
import { db, initializeSettings } from '../lib/db'
import { DEFAULT_CATEGORIES } from '../lib/categories'
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

  it('restores default categories on next setup, and clears PIN and backup date', async () => {
    // 1. User sets custom categories, PIN, and backup date
    await db.settings.put({ key: 'categories', value: [{ id: 'custom', name: 'Custom', emoji: '🌟' }] })
    await db.settings.put({ key: 'pin', value: '1234' })
    await db.settings.put({ key: 'lastBackup', value: 123456789 })

    // 2. Perform reset
    await db.settings.clear()

    // Verify they are gone
    expect(await db.settings.get('pin')).toBeUndefined()
    expect(await db.settings.get('lastBackup')).toBeUndefined()

    // 3. Next setup (initializeSettings)
    await initializeSettings()

    // 4. Verify default categories are restored
    const catSetting = await db.settings.get('categories')
    expect(catSetting.value).toEqual(DEFAULT_CATEGORIES)
    // PIN and lastBackup should remain cleared
    expect(await db.settings.get('pin')).toBeUndefined()
    expect(await db.settings.get('lastBackup')).toBeUndefined()
  })
})
