import { db } from './db'
import { getTodayStr } from './format'

export async function seedDevData() {
  const settingsCount = await db.settings.count()
  if (settingsCount === 0) {
    await db.settings.bulkPut([
      { key: 'name', value: 'Demo' },
      { key: 'currency', value: '₹' },
      { key: 'cycleDay', value: 22 },
      { key: 'theme', value: 'system' },
      { key: 'setupComplete', value: true }
    ])
    await db.cycles.add({ startDate: getTodayStr(), income: 2000000, extras: [] }) // 20k INR
  }

  const expensesCount = await db.expenses.count()
  if (expensesCount > 0) return

  const today = getTodayStr()
  
  await db.expenses.bulkPut([
    { amount: 150000, categoryId: 'food', note: 'Groceries', date: today, createdAt: Date.now() },
    { amount: 50000, categoryId: 'transport', note: 'Taxi', date: today, createdAt: Date.now() - 1000 },
    { amount: 200000, categoryId: 'shopping', note: 'Clothes', date: today, createdAt: Date.now() - 2000 }
  ])
}
