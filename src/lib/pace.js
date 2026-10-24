import { parseLocalDate, formatMoney } from './format.js'
import { sortCycles, getCycleEndDate, getExpensesForCycle } from './cycle.js'

/**
 * Calculates daily budget, average spending per day, and quiet spending pace.
 *
 * @param {Object} params
 * @param {Object|null} params.currentCycle
 * @param {Array} [params.cycleExpenses=[]]
 * @param {Array} [params.allCycles=[]]
 * @param {Array} [params.allExpenses=[]]
 * @param {string} params.today
 * @param {number|string} params.cycleDay
 * @param {string} [params.currency='INR']
 * @param {number} [params.remaining=0]
 * @param {number} [params.daysLeft=0]
 * @returns {Object} Pace result
 */
export function calculatePace({
  currentCycle,
  cycleExpenses = [],
  allCycles = [],
  allExpenses = [],
  today,
  cycleDay,
  currency = 'INR',
  remaining = 0,
  daysLeft = 0,
}) {
  if (!currentCycle) {
    return {
      hide: true,
      hasAmount: false,
      dailyBudget: 0,
      daysElapsed: 0,
      avgPerDay: null,
      isCurrentAvg: false,
      avgLabel: 'Avg per day',
      avgCaption: 'Needs a few days of data',
      projectedLeft: null,
      runsOutInDays: null,
      daysEarly: null,
      paceMessage: null,
    }
  }

  const baseIncome = currentCycle.income || 0
  const extrasTotal = (currentCycle.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0)
  const totalIncome = baseIncome + extrasTotal

  if (totalIncome === 0) {
    return {
      hide: true,
      hasAmount: false,
      dailyBudget: 0,
      daysElapsed: 0,
      avgPerDay: null,
      isCurrentAvg: false,
      avgLabel: 'Avg per day',
      avgCaption: 'Needs a few days of data',
      projectedLeft: null,
      runsOutInDays: null,
      daysEarly: null,
      paceMessage: null,
    }
  }

  // 1. Daily Budget (stays remaining / daysLeft, 0 when remaining is 0)
  const dailyBudget = remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0

  // 2. Days elapsed in the cycle (inclusive of today)
  let daysElapsed = 1
  if (today && currentCycle.startDate) {
    const start = parseLocalDate(currentCycle.startDate)
    const current = parseLocalDate(today)
    const diff = Math.round((current.getTime() - start.getTime()) / (1000 * 3600 * 24))
    daysElapsed = diff + 1
  }

  const totalSpent = cycleExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const hasCurrentAvg = daysElapsed >= 3 && cycleExpenses.length >= 1

  let avgPerDay = null
  let isCurrentAvg = false
  let avgLabel = 'Avg per day'
  let avgCaption = null

  if (hasCurrentAvg) {
    avgPerDay = daysElapsed > 0 ? Math.round(totalSpent / daysElapsed) : 0
    isCurrentAvg = true
    avgLabel = 'Avg per day'
    avgCaption = null
  } else {
    // 4. From second cycle onward, if current cycle has < 3 days of data, fallback to previous cycle avg
    const sorted = sortCycles(allCycles)
    const currentIndex = sorted.findIndex(
      c => (c.id && currentCycle.id && c.id === currentCycle.id) || c.startDate === currentCycle.startDate
    )

    let prevAvg = null
    if (currentIndex > 0) {
      const prevCycle = sorted[currentIndex - 1]
      const prevEndDate = getCycleEndDate(currentIndex - 1, sorted, cycleDay)
      if (prevCycle && prevEndDate) {
        const prevStart = parseLocalDate(prevCycle.startDate)
        const prevEnd = parseLocalDate(prevEndDate)
        const prevTotalDays = Math.round((prevEnd.getTime() - prevStart.getTime()) / (1000 * 3600 * 24)) + 1
        const prevExpenses = getExpensesForCycle(prevCycle, allExpenses, sorted, cycleDay)
        const prevSpent = prevExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        if (prevTotalDays > 0 && prevExpenses.length > 0) {
          prevAvg = Math.round(prevSpent / prevTotalDays)
        }
      }
    }

    if (prevAvg !== null) {
      avgPerDay = prevAvg
      isCurrentAvg = false
      avgLabel = 'Last cycle avg'
      avgCaption = null
    } else {
      avgPerDay = null
      isCurrentAvg = false
      avgLabel = 'Avg per day'
      avgCaption = 'Needs a few days of data'
    }
  }

  // 3. Quiet pace line (shown only when current cycle's Avg per day is available)
  let paceMessage = null
  let projectedLeft = null
  let runsOutInDays = null
  let daysEarly = null

  if (isCurrentAvg && avgPerDay !== null) {
    projectedLeft = remaining - avgPerDay * daysLeft
    const avgFormatted = formatMoney(avgPerDay, currency)

    if (projectedLeft >= 0) {
      const projectedFormatted = formatMoney(projectedLeft, currency)
      paceMessage = `At ${avgFormatted}/day you'll finish with about ${projectedFormatted} left.`
    } else {
      runsOutInDays = avgPerDay > 0 ? Math.floor(remaining / avgPerDay) : 0
      daysEarly = Math.max(0, daysLeft - runsOutInDays)
      paceMessage = `At ${avgFormatted}/day you'll run out in ${runsOutInDays} days, about ${daysEarly} days early.`
    }
  }

  return {
    hide: false,
    hasAmount: true,
    dailyBudget,
    daysElapsed,
    avgPerDay,
    isCurrentAvg,
    avgLabel,
    avgCaption,
    projectedLeft,
    runsOutInDays,
    daysEarly,
    paceMessage,
  }
}
