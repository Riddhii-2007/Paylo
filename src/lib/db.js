import Dexie from 'dexie'
import { DEFAULT_CATEGORIES } from './categories.js'
import { findInvalidCycles, repairInvalidCycleDate } from './cycle.js'
import { getTodayStr } from './format.js'

export const db = new Dexie('expense-tracker')

db.version(1).stores({
  settings: 'key',
  expenses: '++id, date',
  cycles: '++id, startDate'
})

// Provide some default helper functions for DB init/check
export async function repairInvalidCyclesInDb() {
  try {
    const cycles = await db.cycles.toArray()
    const cycleDaySett = await db.settings.get('cycleDay')
    const cycleDay = cycleDaySett?.value || 22
    const today = getTodayStr()
    const invalid = findInvalidCycles(cycles, today)
    for (const c of invalid) {
      const repaired = repairInvalidCycleDate(c, cycles, cycleDay, today)
      await db.cycles.update(c.id, { startDate: repaired })
    }
    return invalid.length
  } catch (e) {
    return 0
  }
}

export async function initializeSettings() {
  const count = await db.settings.count()
  if (count === 0) {
    await db.settings.bulkPut([
      { key: 'name', value: '' },
      { key: 'currency', value: '₹' },
      { key: 'cycleDay', value: 22 },
      { key: 'theme', value: 'system' },
      { key: 'categories', value: DEFAULT_CATEGORIES },
      { key: 'lowBalanceWarning', value: null },
      { key: 'setupComplete', value: false }
    ])
  }
  await repairInvalidCyclesInDb()
}
