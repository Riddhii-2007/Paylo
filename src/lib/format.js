export function getCurrencyFractions(currencyCode) {
  try {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
    return fmt.resolvedOptions().maximumFractionDigits
  } catch (e) {
    return 2 // fallback for custom symbols
  }
}

export function toMinorUnits(amountStr, currencyCode = 'INR') {
  if (amountStr === null || amountStr === undefined || amountStr === '') return 0
  const num = Number(amountStr)
  if (Number.isNaN(num)) return 0
  const decimals = getCurrencyFractions(currencyCode)
  return Math.round(num * Math.pow(10, decimals))
}

// Keep toPaise for backwards compatibility during migration/tests if needed
export const toPaise = (amount) => toMinorUnits(amount, 'INR')

export function toMajorUnits(minorUnits, currencyCode = 'INR') {
  const decimals = getCurrencyFractions(currencyCode)
  return minorUnits / Math.pow(10, decimals)
}

export function formatMoney(minorUnits, currencyCode = 'INR') {
  if (typeof minorUnits !== 'number' || Number.isNaN(minorUnits)) {
    minorUnits = 0
  }
  const major = toMajorUnits(minorUnits, currencyCode)
  
  let isIso = true
  try {
    Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
  } catch (e) {
    isIso = false
  }

  if (!isIso) {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: major % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
    return `${currencyCode} ${formatter.format(major)}`
  }

  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US'
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: major % 1 === 0 ? 0 : getCurrencyFractions(currencyCode),
    maximumFractionDigits: getCurrencyFractions(currencyCode),
  })
  
  return formatter.format(major)
}

export function formatMoneyNoDecimals(minorUnits, currencyCode = 'INR') {
  if (typeof minorUnits !== 'number' || Number.isNaN(minorUnits)) {
    minorUnits = 0
  }
  const major = Math.floor(toMajorUnits(minorUnits, currencyCode))
  
  let isIso = true
  try {
    Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
  } catch (e) {
    isIso = false
  }

  if (!isIso) {
    const formatter = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    })
    return `${currencyCode} ${formatter.format(major)}`
  }

  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US'
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  })
  
  return formatter.format(major)
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
