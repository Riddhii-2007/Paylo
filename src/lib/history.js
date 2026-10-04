import { parseLocalDate, formatDate } from './format'
import { resolveCategory } from './categories'

export function groupExpensesByDate(expenses, today) {
  const groups = {}
  expenses.forEach(e => {
    if (!groups[e.date]) groups[e.date] = { date: e.date, total: 0, items: [] }
    groups[e.date].items.push(e)
    groups[e.date].total += e.amount
  })

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  return sortedDates.map(date => {
    let title = date
    if (date === today) title = 'Today'
    else {
      const d = parseLocalDate(date)
      const t = parseLocalDate(today)
      const diffDays = Math.round((t - d) / (1000 * 3600 * 24))
      if (diffDays === 1) title = 'Yesterday'
      else title = formatDate(date)
    }

    // Sort items descending by createdAt
    const items = [...groups[date].items].sort((a, b) => b.createdAt - a.createdAt)

    return {
      date,
      title,
      total: groups[date].total,
      items
    }
  })
}

export function filterExpenses(baseExpenses, filterCat, searchQuery, categories) {
  const query = searchQuery.trim().toLowerCase()
  
  return baseExpenses.filter(e => {
    const matchCat = filterCat === 'all' || e.categoryId === filterCat
    if (!matchCat) return false
    
    if (query) {
      const catObj = resolveCategory(e.categoryId, categories)
      const inNote = (e.note || '').toLowerCase().includes(query)
      const inCat = catObj.name.toLowerCase().includes(query)
      const inAmount = (e.amount / 100).toString().includes(query) // rough match
      return inNote || inCat || inAmount
    }
    return true
  })
}
