import { parseLocalDate, formatDate, isValidDateString, getTodayStr } from './format.js'

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

export function addDays(dateStr, days) {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

export function getOneYearFromToday(todayStr = getTodayStr()) {
  const [y, m, d] = (todayStr || getTodayStr()).split('-').map(Number)
  const nextY = y + 1
  let day = d
  if (m === 2 && d === 29) {
    day = 28
  }
  return `${nextY}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getCycleEditAllowedRange(cycleIndex, cycles, todayStr = getTodayStr()) {
  const sorted = sortCycles(cycles || [])
  const prev = sorted[cycleIndex - 1]
  const next = sorted[cycleIndex + 1]

  const maxFutureDate = getOneYearFromToday(todayStr)
  const minLimit = '2000-01-01'

  let minDate = minLimit
  let maxDate = maxFutureDate

  if (prev && prev.startDate) {
    const nextDay = addDays(prev.startDate, 1)
    if (nextDay > minDate) minDate = nextDay
  }

  if (next && next.startDate) {
    const prevDay = subDays(next.startDate, 1)
    if (prevDay < maxDate) maxDate = prevDay
  }

  return {
    min: minDate,
    max: maxDate,
    prev: prev || null,
    next: next || null,
  }
}

export function findInvalidCycles(cycles, todayStr = getTodayStr()) {
  if (!cycles || !Array.isArray(cycles)) return []
  const maxFutureDate = getOneYearFromToday(todayStr)
  return cycles.filter(c => {
    if (!c.startDate || !isValidDateString(c.startDate)) return true
    if (c.startDate < '2000-01-01') return true
    if (c.startDate > maxFutureDate) return true
    return false
  })
}

export function repairInvalidCycleDate(invalidCycle, allCycles, cycleDaySetting, todayStr = getTodayStr()) {
  const list = allCycles || []
  const invIdx = list.findIndex(c => c.id === invalidCycle.id)
  
  // Try to find previous valid cycle before invIdx
  let prevValid = null
  const startIdx = invIdx >= 0 ? invIdx - 1 : list.length - 1
  for (let i = startIdx; i >= 0; i--) {
    const c = list[i]
    if (c.id !== invalidCycle.id && isValidDateString(c.startDate) && c.startDate >= '2000-01-01') {
      prevValid = c
      break
    }
  }

  if (prevValid) {
    return getNextOccurrenceOfCycleDay(prevValid.startDate, cycleDaySetting)
  }

  // Try to find next valid cycle after invIdx
  let nextValid = null
  if (invIdx >= 0) {
    for (let i = invIdx + 1; i < list.length; i++) {
      const c = list[i]
      if (c.id !== invalidCycle.id && isValidDateString(c.startDate) && c.startDate >= '2000-01-01') {
        nextValid = c
        break
      }
    }
  }

  if (nextValid) {
    // Step backward by 1 month from nextValid
    const [y, m] = nextValid.startDate.split('-').map(Number)
    let prevY = y
    let prevM = m - 1
    if (prevM < 1) {
      prevM = 12
      prevY -= 1
    }
    const maxDays = getDaysInMonth(prevY, prevM - 1)
    let day = cycleDaySetting === 'last' ? maxDays : Math.min(Number(cycleDaySetting) || 22, maxDays)
    return `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Fallback if no valid cycles exist
  return suggestNextStartDate(cycleDaySetting, todayStr)
}

export function validateStartDateEdit(newDateStr, cycleIndex, cycles, cycleDaySetting, currentCycleExpenses = [], todayStr = getTodayStr()) {
  if (typeof currentCycleExpenses === 'string') {
    todayStr = currentCycleExpenses
    currentCycleExpenses = []
  }
  if (!Array.isArray(currentCycleExpenses)) {
    currentCycleExpenses = []
  }
  if (!todayStr) todayStr = getTodayStr()

  const sorted = sortCycles(cycles || [])
  const prev = sorted[cycleIndex - 1]
  const next = sorted[cycleIndex + 1]

  // 1. Is it a valid date format and calendar date?
  if (!isValidDateString(newDateStr)) {
    return {
      valid: false,
      reason: 'invalid_date',
      error: 'Enter a valid date.',
      orphanedExtras: [],
      orphanedExpenses: []
    }
  }

  // 2. Block start dates before 2000
  if (newDateStr < '2000-01-01') {
    return {
      valid: false,
      reason: 'before_2000',
      error: 'Start date cannot be before 2000.',
      orphanedExtras: [],
      orphanedExpenses: []
    }
  }

  // 3. Block start dates more than a year in the future
  const maxFutureDate = getOneYearFromToday(todayStr)
  if (newDateStr > maxFutureDate) {
    return {
      valid: false,
      reason: 'too_far_future',
      error: 'Start date cannot be more than a year in the future.',
      orphanedExtras: [],
      orphanedExpenses: []
    }
  }

  // 4. Overlap with previous cycle
  if (prev && newDateStr <= prev.startDate) {
    let errorMsg = ''
    if (next) {
      errorMsg = `Start date must be after ${formatDate(prev.startDate)} and before ${formatDate(next.startDate)} (the previous cycle starts on ${formatDate(prev.startDate)}).`
    } else {
      errorMsg = `Start date must be after ${formatDate(prev.startDate)} (the previous cycle starts on ${formatDate(prev.startDate)}).`
    }
    return {
      valid: false,
      reason: 'overlap_prev',
      error: errorMsg,
      orphanedExtras: [],
      orphanedExpenses: []
    }
  }

  // 5. Overlap with next cycle
  if (next && newDateStr >= next.startDate) {
    let errorMsg = ''
    if (prev) {
      errorMsg = `Start date must be after ${formatDate(prev.startDate)} and before ${formatDate(next.startDate)} (the next cycle starts on ${formatDate(next.startDate)}).`
    } else {
      errorMsg = `Start date must be before ${formatDate(next.startDate)} (the next cycle starts on ${formatDate(next.startDate)}).`
    }
    return {
      valid: false,
      reason: 'overlap_next',
      error: errorMsg,
      orphanedExtras: [],
      orphanedExpenses: []
    }
  }

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

  if (cycle && cycle.extras && cycle.extras.length > 0) {
    orphanedExtras = cycle.extras.filter(extra => extra.date < start || extra.date > end)
  }

  if (currentCycleExpenses && currentCycleExpenses.length > 0) {
    orphanedExpenses = currentCycleExpenses.filter(e => e.date < start || e.date > end)
  }

  return { valid: true, error: null, orphanedExtras, orphanedExpenses }
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
