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

function getNextOccurrenceOfCycleDay(startDateStr, cycleDay) {
  const start = parseLocalDate(startDateStr)
  
  // The projected next cycle start is simply the cycleDay of the following month.
  // This gracefully handles early pay (e.g. Oct 20 for Oct 22) and late pay (e.g. Oct 25 for Oct 22).
  const next = new Date(start.getFullYear(), start.getMonth() + 1, cycleDay)
  
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
    const firstCycleStart = sortCycles(allCycles)[0].startDate
    return expenses.filter(e => e.date < firstCycleStart)
  }
  
  const sorted = sortCycles(allCycles)
  const index = sorted.findIndex(c => c.id === cycle.id)
  
  const startDate = cycle.startDate
  const endDate = getCycleEndDate(index, sorted, cycleDaySetting)
  
  return expenses.filter(e => e.date >= startDate && e.date <= endDate)
}

export function suggestNextStartDate(cycleDaySetting, todayStr) {
  const today = parseLocalDate(todayStr)
  
  // If today is past the cycle day of this month, suggest next month's cycle day
  let suggested = new Date(today.getFullYear(), today.getMonth(), cycleDaySetting)
  if (today > suggested) {
    suggested = new Date(today.getFullYear(), today.getMonth() + 1, cycleDaySetting)
  }
  
  const y = suggested.getFullYear()
  const m = String(suggested.getMonth() + 1).padStart(2, '0')
  const d = String(suggested.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function validateStartDateEdit(newDateStr, cycleIndex, cycles, cycleDaySetting) {
  const sorted = sortCycles(cycles)
  
  const prev = sorted[cycleIndex - 1]
  const next = sorted[cycleIndex + 1]
  
  if (prev && newDateStr <= prev.startDate) return { valid: false, reason: 'overlap_prev' }
  if (next && newDateStr >= next.startDate) return { valid: false, reason: 'overlap_next' }
  
  // Check for orphaned extras
  const cycle = sorted[cycleIndex]
  let orphanedExtras = []
  if (cycle.extras && cycle.extras.length > 0) {
    // New boundaries for this cycle
    const start = newDateStr
    // The end date is either the day before the next cycle, or the projected end
    let end = ''
    if (next) {
      end = subDays(next.startDate, 1)
    } else {
      const nextStart = getNextOccurrenceOfCycleDay(newDateStr, cycleDaySetting)
      end = subDays(nextStart, 1)
    }
    
    orphanedExtras = cycle.extras.filter(extra => extra.date < start || extra.date > end)
  }
  
  return { valid: true, orphanedExtras }
}
