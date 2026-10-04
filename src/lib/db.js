import Dexie from 'dexie'
import { DEFAULT_CATEGORIES } from './categories.js'

export const db = new Dexie('expense-tracker')

db.version(1).stores({
  settings: 'key',
  expenses: '++id, date',
  cycles: '++id, startDate'
})

// Provide some default helper functions for DB init/check
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
}
