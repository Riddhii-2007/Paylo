import { db } from './db'
import { getTodayStr } from './format'

export async function seedDevData() {
  const settingsCount = await db.settings.count()
  if (settingsCount === 0) {
    await db.settings.bulkPut([
      { key: 'name', value: 'Demo' },
      { key: 'currency', value: '₹' },
      { key: 'cycleDay', value: 1 },
      { key: 'theme', value: 'system' },
      { key: 'setupComplete', value: true },
      { key: 'openingSavings', value: 500000 }, // ₹5,000 saved before app
    ])
  }

  const cyclesCount = await db.cycles.count()
  if (cyclesCount === 0) {
    // Aug cycle: income 40,000 – spent 35,000 = saved 5,000
    await db.cycles.add({ startDate: '2026-08-01', income: 4000000, extras: [] })
    // Sep cycle: income 40,000 + 5,000 bonus – spent 46,000 = saved -1,000 (overspent)
    await db.cycles.add({
      startDate: '2026-09-01',
      income: 4000000,
      extras: [{ amount: 500000, date: '2026-09-15', note: 'Freelance bonus' }],
    })
    // Oct cycle: current (income 40,000, spending so far)
    await db.cycles.add({ startDate: '2026-10-01', income: 4000000, extras: [] })
  }

  const expensesCount = await db.expenses.count()
  if (expensesCount > 0) return

  const today = getTodayStr()

  // Aug expenses → spent ₹35,000 of ₹40,000 → saved ₹5,000
  await db.expenses.bulkPut([
    { amount: 1500000, categoryId: 'food',      note: 'Groceries',     date: '2026-08-03', createdAt: 1000 },
    { amount: 800000,  categoryId: 'transport', note: 'Fuel & Uber',   date: '2026-08-10', createdAt: 1001 },
    { amount: 2000000, categoryId: 'shopping',  note: 'New laptop bag', date: '2026-08-14', createdAt: 1002 },
    { amount: 700000,  categoryId: 'food',      note: 'Dining out',    date: '2026-08-20', createdAt: 1003 },
    // Total Aug: 5,000,000 paise = ₹50,000 — wait let me recalculate for ₹35,000 spent
    // Actually amounts are in paise (×100): 15000+8000+20000+7000 = 50000 hundred-paise = ₹50,000... 
    // Let me use smaller numbers. 1 paise = 0.01 ₹. So ₹350 = 35000 paise.
    // But the seed has 2000000 for 20k INR earlier. So amounts are in paise.
    // ₹40,000 = 4,000,000 paise. ₹35,000 = 3,500,000 paise.
  ])

  // Clear above and redo properly
  await db.expenses.clear()

  // Aug: received ₹40,000 = 4,000,000 paise; spent ₹35,000 = 3,500,000 paise; saved ₹5,000
  await db.expenses.bulkPut([
    { amount: 1500000, categoryId: 'food',      note: 'Groceries Aug',  date: '2026-08-03', createdAt: 1000 },
    { amount: 800000,  categoryId: 'transport', note: 'Fuel & Uber',    date: '2026-08-10', createdAt: 1001 },
    { amount: 500000,  categoryId: 'shopping',  note: 'Clothes',        date: '2026-08-14', createdAt: 1002 },
    { amount: 700000,  categoryId: 'food',      note: 'Dining out',     date: '2026-08-20', createdAt: 1003 },
    // Aug total: 3,500,000 paise = ₹35,000. Saved: ₹5,000

    // Sep: received ₹40,000 + ₹5,000 bonus = ₹45,000; spent ₹46,000; overspent by ₹1,000
    { amount: 1800000, categoryId: 'food',      note: 'Groceries Sep',  date: '2026-09-04', createdAt: 2000 },
    { amount: 1200000, categoryId: 'shopping',  note: 'Diwali shopping',date: '2026-09-10', createdAt: 2001 },
    { amount: 900000,  categoryId: 'transport', note: 'Flight tickets', date: '2026-09-18', createdAt: 2002 },
    { amount: 700000,  categoryId: 'food',      note: 'Restaurant',     date: '2026-09-25', createdAt: 2003 },
    { amount: 1000000, categoryId: 'other',     note: 'Medical',        date: '2026-09-28', createdAt: 2004 },
    // Sep total: 5,600,000 paise = ₹56,000. Received: 4,000,000 + 500,000 = 4,500,000 = ₹45,000. Overspent ₹11,000
    // That's too much. Let me set Sep to exactly ₹46,000 spent
  ])

  await db.expenses.clear()

  await db.expenses.bulkPut([
    // Aug: received 40k, spent 35k → saved 5k
    { amount: 1500000, categoryId: 'food',      note: 'Groceries',       date: '2026-08-03', createdAt: 1000 },
    { amount: 800000,  categoryId: 'transport', note: 'Fuel',            date: '2026-08-10', createdAt: 1001 },
    { amount: 500000,  categoryId: 'shopping',  note: 'Clothes',         date: '2026-08-14', createdAt: 1002 },
    { amount: 700000,  categoryId: 'food',      note: 'Dining out',      date: '2026-08-20', createdAt: 1003 },
    // aug: 3,500,000 = ₹35,000 ✓

    // Sep: received 40k+5k=45k, spent 46k → overspent 1k (taken from savings)
    { amount: 1500000, categoryId: 'food',      note: 'Groceries',       date: '2026-09-04', createdAt: 2000 },
    { amount: 1000000, categoryId: 'shopping',  note: 'Diwali shopping', date: '2026-09-10', createdAt: 2001 },
    { amount: 900000,  categoryId: 'transport', note: 'Travel',          date: '2026-09-18', createdAt: 2002 },
    { amount: 700000,  categoryId: 'food',      note: 'Restaurant',      date: '2026-09-25', createdAt: 2003 },
    { amount: 500000,  categoryId: 'other',     note: 'Medical',         date: '2026-09-28', createdAt: 2004 },
    // sep: 4,600,000 = ₹46,000 ✓ (received 45k, overspent 1k)

    // Oct (current): received 40k, spent 15k so far → saving so far
    { amount: 600000,  categoryId: 'food',      note: 'Groceries',       date: today,        createdAt: Date.now() - 3000 },
    { amount: 300000,  categoryId: 'transport', note: 'Uber',            date: today,        createdAt: Date.now() - 2000 },
    { amount: 600000,  categoryId: 'food',      note: 'Dining out',      date: today,        createdAt: Date.now() - 1000 },
  ])
}
