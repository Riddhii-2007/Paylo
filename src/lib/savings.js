/**
 * savings.js — Pure savings computation derived from cycles and expenses.
 *
 * Savings = opening savings + sum over every FINISHED cycle of (received − spent).
 * A cycle is "finished" when today > its end date (i.e. the next cycle has
 * already started, or the projected end date has passed).
 * Cycles where received === 0 are skipped (no income entered yet).
 * A negative per-cycle delta reduces total savings.
 *
 * This file has no side effects and no DB imports.
 */

import { sortCycles, getCycleEndDate, getExpensesForCycle, getCurrentCycle } from './cycle.js'

/**
 * @typedef {Object} CycleSavingsEntry
 * @property {number|string} id           – cycle id
 * @property {boolean} isFinished         – true if this cycle has ended
 * @property {boolean} [isFuture]         – true if this cycle starts in the future
 * @property {boolean} skipped            – true if received === 0 (cycle ignored)
 * @property {number}  received           – income + extras (minor units)
 * @property {number}  spent              – total expenses (minor units)
 * @property {number}  delta              – received − spent (can be negative)
 * @property {number}  runningTotal       – cumulative savings after this cycle (incl. opening)
 * @property {boolean} isCurrentCycle     – true for the cycle that contains today
 */

/**
 * @typedef {Object} SavingsResult
 * @property {number}               openingSavings    – opening savings (minor units)
 * @property {number}               totalSaved        – clamped to 0 from below (display value)
 * @property {number}               totalSavedRaw     – real sum, can be negative
 * @property {boolean}              isOverspent       – true when totalSavedRaw < 0
 * @property {number}               overspentAmount   – |totalSavedRaw| when < 0
 * @property {CycleSavingsEntry[]}  cycleEntries      – one entry per cycle (sorted asc)
 * @property {number|null}          projectedSavings  – totalSavedRaw + currentCycleDelta (null if no current cycle)
 * @property {boolean}              isProjection      – true while the current cycle is ongoing
 * @property {number}               currentCycleSurplus – received − spent for current cycle (can be negative)
 * @property {boolean}              currentCycleUsingFromSavings – true if spent > received this cycle
 * @property {number}               savingsBeingUsed  – amount being pulled from savings this cycle
 */

/**
 * Compute savings across all cycles.
 *
 * @param {object[]} cycles            – raw cycle objects from DB
 * @param {object[]} expenses          – raw expense objects from DB
 * @param {number}   openingSavings    – opening savings in minor units (≥ 0)
 * @param {number|'last'} cycleDay     – cycle-day setting
 * @param {string}   todayStr          – YYYY-MM-DD
 * @returns {SavingsResult}
 */
export function computeSavings(cycles, expenses, openingSavings, cycleDay, todayStr) {
  const opening = typeof openingSavings === 'number' && openingSavings > 0 ? openingSavings : 0

  if (!cycles || cycles.length === 0) {
    return {
      openingSavings: opening,
      totalSaved: opening,
      totalSavedRaw: opening,
      isOverspent: false,
      overspentAmount: 0,
      cycleEntries: [],
      projectedSavings: null,
      isProjection: false,
      currentCycleSurplus: 0,
      currentCycleUsingFromSavings: false,
      savingsBeingUsed: 0,
    }
  }

  const sorted = sortCycles(cycles)
  const currentCycle = getCurrentCycle(sorted, cycleDay, todayStr)
  const currentCycleId = currentCycle?.id

  let running = opening
  const cycleEntries = []

  let projectedSavings = null
  let isProjection = false
  let currentCycleSurplus = 0
  let currentCycleUsingFromSavings = false
  let savingsBeingUsed = 0

  for (let i = 0; i < sorted.length; i++) {
    const cycle = sorted[i]
    const endDate = getCycleEndDate(i, sorted, cycleDay)
    const isFuture = cycle.startDate > todayStr
    const isCurrentCycle = cycle.id === currentCycleId
    const isFinished = !isFuture && !isCurrentCycle && todayStr > endDate

    const cycleExpenses = getExpensesForCycle(cycle, expenses, sorted, cycleDay)
    const spent = cycleExpenses.reduce((sum, e) => sum + e.amount, 0)
    const received = (cycle.income || 0) + (cycle.extras || []).reduce((sum, e) => sum + e.amount, 0)
    const delta = received - spent

    // Skip cycles with no income recorded
    if (received === 0) {
      cycleEntries.push({
        id: cycle.id,
        isFinished,
        isFuture,
        skipped: true,
        received: 0,
        spent,
        delta: 0,
        runningTotal: running,
        isCurrentCycle,
      })
      if (isCurrentCycle) {
        projectedSavings = running
        isProjection = true
        currentCycleSurplus = 0
        currentCycleUsingFromSavings = false
        savingsBeingUsed = 0
      }
      continue
    }

    if (isFuture) {
      // Future cycle — not counted in saved or projected savings
      cycleEntries.push({
        id: cycle.id,
        isFinished: false,
        isFuture: true,
        skipped: false,
        received,
        spent,
        delta,
        runningTotal: running,
        isCurrentCycle: false,
      })
    } else if (isCurrentCycle) {
      // Ongoing (current) cycle — projection only: projection = saved + current cycle delta
      const availableSavings = Math.max(0, running)
      currentCycleSurplus = delta
      
      savingsBeingUsed = delta < 0 ? Math.min(Math.abs(delta), availableSavings) : 0
      currentCycleUsingFromSavings = savingsBeingUsed > 0

      projectedSavings = running + delta
      isProjection = true

      cycleEntries.push({
        id: cycle.id,
        isFinished: false,
        isFuture: false,
        skipped: false,
        received,
        spent,
        delta,
        runningTotal: running + delta, // projection, not committed
        isCurrentCycle: true,
      })
    } else if (isFinished || cycle.startDate < (currentCycle?.startDate || '9999-99-99')) {
      // Finished cycle — count it permanently
      running += delta
      cycleEntries.push({
        id: cycle.id,
        isFinished: true,
        isFuture: false,
        skipped: false,
        received,
        spent,
        delta,
        runningTotal: running,
        isCurrentCycle: false,
      })
    } else {
      // Any other past cycle
      running += delta
      cycleEntries.push({
        id: cycle.id,
        isFinished: true,
        isFuture: false,
        skipped: false,
        received,
        spent,
        delta,
        runningTotal: running,
        isCurrentCycle: false,
      })
    }
  }

  const totalSavedRaw = running
  const isOverspentRaw = totalSavedRaw < 0
  const isOverspentProjected = isProjection && projectedSavings !== null && projectedSavings < 0
  
  const isOverspent = isOverspentRaw || isOverspentProjected
  const totalSaved = Math.max(0, totalSavedRaw)
  const overspentAmount = isOverspentProjected 
    ? Math.abs(projectedSavings) 
    : (isOverspentRaw ? Math.abs(totalSavedRaw) : 0)

  return {
    openingSavings: opening,
    totalSaved,
    totalSavedRaw,
    isOverspent,
    overspentAmount,
    cycleEntries,
    projectedSavings,
    isProjection,
    currentCycleSurplus,
    currentCycleUsingFromSavings,
    savingsBeingUsed,
  }
}
