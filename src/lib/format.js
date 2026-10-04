export function toPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') return 0
  const num = Number(rupees)
  if (Number.isNaN(num)) return 0
  
  // Use Math.round to avoid floating point issues like 0.1 + 0.2
  return Math.round(num * 100)
}

export function toRupees(paise) {
  return paise / 100
}

export function formatMoney(paise, currency = '₹') {
  if (typeof paise !== 'number' || Number.isNaN(paise)) {
    paise = 0
  }
  const rupees = toRupees(paise)
  
  // Use Intl.NumberFormat for proper comma separation (e.g. Indian numbering system)
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  
  // Replace the default INR symbol with the user's chosen currency
  return formatter.format(rupees).replace('₹', currency + ' ')
}

export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = parseLocalDate(dateStr)
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  }).format(date)
}

export function formatRelativeDay(dateStr) {
  const today = getTodayStr()
  
  const d = parseLocalDate(dateStr)
  const t = parseLocalDate(today)
  
  const diffTime = t.getTime() - d.getTime()
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return formatDate(dateStr)
}
