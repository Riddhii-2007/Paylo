import { parseLocalDate } from './format.js'

export function sortCycles(cycles) {
  return [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function findCycleForDate(dateStr, cycles) {
  if (!cycles || cycles.length === 0) return undefined
  
  const sorted = sortCycles(cycles)
  let found = undefined
  
  for (let i = 0; i < sorted.length; i++) {
    if (dateStr >= sorted[i].startDate) {
      found = sorted[i]
    } else {
      break // since they are sorted, no need to check further
    }
  }
  return found
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function resolveCycleDay(year, month, cycleDaySetting) {
  const daysInMonth = getDaysInMonth(year, month)
  if (cycleDaySetting === 'last') return daysInMonth
  const day = Number(cycleDaySetting)
  return Math.min(day, daysInMonth)
}

function getNextOccurrenceOfCycleDay(startDateStr, cycleDaySetting) {
  const start = parseLocalDate(startDateStr)
  
  let y = start.getFullYear()
  let m = start.getMonth()
  let d = resolveCycleDay(y, m, cycleDaySetting)
  let next = new Date(y, m, d)
  
  if (next <= start) {
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
    d = resolveCycleDay(y, m, cycleDaySetting)
    next = new Date(y, m, d)
  }
  
  const ry = next.getFullYear()
  const rm = String(next.getMonth() + 1).padStart(2, '0')
  const rd = String(next.getDate()).padStart(2, '0')
  return `${ry}-${rm}-${rd}`
}

function subDays(dateStr, days) {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

export function getCycleEndDate(cycleIndex, cycles, cycleDaySetting) {
  const sorted = sortCycles(cycles)
  const cycle = sorted[cycleIndex]
  
  if (!cycle) return undefined
  
  // If there is a next cycle, the end date is the day before the next cycle starts
  if (cycleIndex < sorted.length - 1) {
    return subDays(sorted[cycleIndex + 1].startDate, 1)
  }
  
  // For the latest cycle, project the end date
  const nextStart = getNextOccurrenceOfCycleDay(cycle.startDate, cycleDaySetting)
  return subDays(nextStart, 1)
}

export function getDaysLeft(cycleIndex, cycles, cycleDaySetting, todayStr) {
  const endDateStr = getCycleEndDate(cycleIndex, cycles, cycleDaySetting)
  if (!endDateStr) return 0
  
  if (todayStr > endDateStr) return 0 // past the end date
  
  const end = parseLocalDate(endDateStr)
  const today = parseLocalDate(todayStr)
  
  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24))
  
  // Includes today
  return diffDays + 1
}

export function isCycleEnded(cycleIndex, cycles, cycleDaySetting, todayStr) {
  const endDateStr = getCycleEndDate(cycleIndex, cycles, cycleDaySetting)
  return todayStr > endDateStr
}

export function getExpensesForCycle(cycle, expenses, allCycles, cycleDaySetting) {
  // If cycle is undefined, return unassigned expenses
  if (!cycle) {
    if (allCycles.length === 0) return expenses
    const sorted = sortCycles(allCycles)
    const firstCycleStart = sorted[0].startDate
    const lastCycleEndDate = getCycleEndDate(sorted.length - 1, sorted, cycleDaySetting)
    return expenses.filter(e => e.date < firstCycleStart || e.date > lastCycleEndDate)
  }
  
  const sorted = sortCycles(allCycles)
  const index = sorted.findIndex(c => c.id === cycle.id)
  
  const startDate = cycle.startDate
  const endDate = getCycleEndDate(index, sorted, cycleDaySetting)
  
  return expenses.filter(e => e.date >= startDate && e.date <= endDate)
}

export function suggestNextStartDate(cycleDaySetting, todayStr) {
  const today = parseLocalDate(todayStr)
  
  let y = today.getFullYear()
  let m = today.getMonth()
  let d = resolveCycleDay(y, m, cycleDaySetting)
  let suggested = new Date(y, m, d)
  
  if (today > suggested) {
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
    d = resolveCycleDay(y, m, cycleDaySetting)
    suggested = new Date(y, m, d)
  }
  
  const ry = suggested.getFullYear()
  const rm = String(suggested.getMonth() + 1).padStart(2, '0')
  const rd = String(suggested.getDate()).padStart(2, '0')
  return `${ry}-${rm}-${rd}`
}

export function validateStartDateEdit(newDateStr, cycleIndex, cycles, cycleDaySetting, currentCycleExpenses = []) {
  const sorted = sortCycles(cycles)
  
  const prev = sorted[cycleIndex - 1]
  const next = sorted[cycleIndex + 1]
  
  if (prev && newDateStr <= prev.startDate) return { valid: false, reason: 'overlap_prev' }
  if (next && newDateStr >= next.startDate) return { valid: false, reason: 'overlap_next' }
  
  const cycle = sorted[cycleIndex]
  let orphanedExtras = []
  let orphanedExpenses = []
  
  const start = newDateStr
  let end = ''
  if (next) {
    end = subDays(next.startDate, 1)
  } else {
    const nextStart = getNextOccurrenceOfCycleDay(newDateStr, cycleDaySetting)
    end = subDays(nextStart, 1)
  }
  
  if (cycle.extras && cycle.extras.length > 0) {
    orphanedExtras = cycle.extras.filter(extra => extra.date < start || extra.date > end)
  }
  
  if (currentCycleExpenses.length > 0) {
    orphanedExpenses = currentCycleExpenses.filter(e => e.date < start || e.date > end)
  }
  
  
  return { valid: true, orphanedExtras, orphanedExpenses }
}

export function willExpenseExceedBalance(minorAmount, expenseDate, allCycles, allExpenses, cycleDaySetting, initialExpenseAmount = 0) {
  const sorted = sortCycles(allCycles)
  const currentCycle = findCycleForDate(expenseDate, sorted)
  if (!currentCycle) return false

  const expenses = getExpensesForCycle(currentCycle, allExpenses, sorted, cycleDaySetting)
  
  let spent = expenses.reduce((sum, e) => sum + e.amount, 0)
  spent -= initialExpenseAmount
  
  const base = currentCycle.income || 0
  const extras = (currentCycle.extras || []).reduce((sum, e) => sum + e.amount, 0)
  const received = base + extras
  
  const remaining = Math.max(0, received - spent)
  return minorAmount > remaining
}

export function checkLowBalance(rawRemaining, lowBalanceWarning) {
  if (lowBalanceWarning === null || lowBalanceWarning === undefined) return false
  return rawRemaining <= lowBalanceWarning
}
