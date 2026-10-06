import { db, initializeSettings } from './db'
import { getTodayStr } from './format'

const BACKUP_VERSION = 1
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Returns a human-readable reminder status for the backup UI.
 * Pure function — no side effects.
 * @param {number|null} lastBackupTimestamp  ms since epoch, or null
 * @returns {'never'|'today'|'yesterday'|'overdue'|string}
 */
export function getBackupReminderStatus(lastBackupTimestamp) {
  if (!lastBackupTimestamp) return 'never'
  const daysAgo = Math.floor((Date.now() - lastBackupTimestamp) / (1000 * 3600 * 24))
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  if (daysAgo >= 14) return 'overdue'
  return `${daysAgo} days ago`
}

export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist()
    return isPersisted
  }
  return false
}

// CSV formula injection protection
function escapeCsvCell(val) {
  if (typeof val !== 'string') return val
  if (/^[=+\-@]/.test(val)) {
    return "'" + val
  }
  // Also escape double quotes
  return `"${val.replace(/"/g, '""')}"`
}

export async function exportCsv() {
  const expenses = await db.expenses.toArray()
  
  const headers = ['id', 'amount (paise)', 'categoryId', 'note', 'date', 'createdAt']
  const rows = expenses.map(e => [
    e.id,
    e.amount,
    escapeCsvCell(e.categoryId),
    escapeCsvCell(e.note),
    escapeCsvCell(e.date),
    e.createdAt
  ].join(','))
  
  const csvContent = [headers.join(','), ...rows].join('\n')
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
}

export async function exportJson() {
  const settings = await db.settings.toArray()
  const expenses = await db.expenses.toArray()
  const cycles = await db.cycles.toArray()
  
  // Record backup time
  const backupTime = Date.now()
  await db.settings.put({ key: 'lastBackup', value: backupTime })
  
  // Filter out PIN before exporting
  const backupSettings = settings
    .filter(s => s.key !== 'lastBackup' && s.key !== 'pin')
    .concat({ key: 'lastBackup', value: backupTime })
  
  const data = {
    version: BACKUP_VERSION,
    timestamp: backupTime,
    settings: backupSettings,
    expenses,
    cycles
  }
  
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

function isValidDate(str) {
  if (!str || typeof str !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function isSafeString(val, maxLength = 500) {
  if (typeof val !== 'string') return false
  if (val.length > maxLength) return false
  return true
}

function isSafeAmount(val) {
  return Number.isSafeInteger(val) && val >= 0
}

export async function importJson(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 5MB)')
  
  const text = await file.text()
  if (!text.trim().startsWith('{')) {
    throw new Error('Invalid file type: expected a JSON file')
  }

  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('Invalid JSON format: file could not be parsed')
  }
  
  if (!data || !data.version) {
    throw new Error('Missing backup version field')
  }
  
  const { settings = [], expenses = [], cycles = [] } = data
  
  // Validate data strictly before touching DB
  const validSettings = settings.map((s, idx) => {
    if (!isSafeString(s.key, 100)) throw new Error(`settings[${idx}]: Invalid setting key`)
    if (s.key === 'cycleDay') {
      if (s.value !== 'last' && (!Number.isInteger(s.value) || s.value < 1 || s.value > 31)) {
        throw new Error(`settings[${idx}] (cycleDay): Invalid cycleDay setting`)
      }
    }
    if (s.key === 'openingSavings') {
      if (s.value !== null && s.value !== undefined) {
        if (!Number.isFinite(s.value) || !Number.isInteger(s.value) || s.value < 0) {
          throw new Error(`settings[${idx}] (openingSavings): must be a non-negative integer`)
        }
      }
    }
    if (s.key === 'categories') {
      if (!Array.isArray(s.value)) throw new Error(`settings[${idx}] (categories): must be an array`)
      s.value.forEach((c, cIdx) => {
        if (!c.id || typeof c.id !== 'string' || c.id.length > 50) throw new Error(`settings[${idx}] (categories)[${cIdx}]: Invalid category id`)
        if (!c.name || typeof c.name !== 'string' || c.name.length > 24) throw new Error(`settings[${idx}] (categories)[${cIdx}]: Invalid category name`)
        if (!c.emoji || typeof c.emoji !== 'string' || c.emoji.length > 10) throw new Error(`settings[${idx}] (categories)[${cIdx}]: Invalid category emoji`)
      })
    }
    if (s.key === 'pin' && s.value) {
      if (typeof s.value !== 'object') throw new Error(`settings[${idx}] (pin): Invalid pin setting`)
    }
    return { key: s.key, value: s.value }
  })

  const validExpenses = expenses.map((e, idx) => {
    if (!isSafeAmount(e.amount)) throw new Error(`expenses[${idx}].amount is invalid`)
    if (!isValidDate(e.date)) throw new Error(`expenses[${idx}].date is not a valid date`)
    if (!isSafeString(e.categoryId, 50)) throw new Error(`expenses[${idx}].categoryId is invalid`)
    const note = e.note || ''
    if (!isSafeString(note, 1000)) throw new Error(`expenses[${idx}].note is invalid`)
    return {
      amount: e.amount,
      categoryId: e.categoryId,
      note,
      date: e.date,
      createdAt: Number.isSafeInteger(e.createdAt) ? e.createdAt : Date.now()
    }
  })
  
  const validCycles = cycles.map((c, idx) => {
    if (!isValidDate(c.startDate)) throw new Error(`cycles[${idx}].startDate is not a valid date`)
    if (!isSafeAmount(c.income)) throw new Error(`cycles[${idx}].income is invalid`)
    
    let validExtras = []
    if (Array.isArray(c.extras)) {
      validExtras = c.extras.map((ex, exIdx) => {
        if (!isSafeAmount(ex.amount)) throw new Error(`cycles[${idx}].extras[${exIdx}].amount is invalid`)
        if (!isValidDate(ex.date)) throw new Error(`cycles[${idx}].extras[${exIdx}].date is not a valid date`)
        const exNote = ex.note || ''
        if (!isSafeString(exNote, 500)) throw new Error(`cycles[${idx}].extras[${exIdx}].note is invalid`)
        return { amount: ex.amount, date: ex.date, note: exNote }
      })
    }
    
    return {
      startDate: c.startDate,
      income: c.income,
      extras: validExtras
    }
  })
  
  // Single transaction block
  await db.transaction('rw', db.settings, db.expenses, db.cycles, async () => {
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()
    
    if (validSettings.length > 0) await db.settings.bulkAdd(validSettings)
    if (validExpenses.length > 0) await db.expenses.bulkAdd(validExpenses)
    if (validCycles.length > 0) await db.cycles.bulkAdd(validCycles)
    
    await initializeSettings() // Ensure critical settings exist
  })
}

// Encryption helpers for Backup
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16))
}

async function getCryptoKey(password, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function exportEncryptedJson(password) {
  const blob = await exportJson()
  const text = await blob.text()
  
  const salt = generateSalt()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getCryptoKey(password, salt)
  
  const encoder = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  )
  
  // Combine salt, iv, and encrypted data in a single file
  const encryptedBytes = new Uint8Array(encrypted)
  const bundle = new Uint8Array(salt.length + iv.length + encryptedBytes.length)
  bundle.set(salt, 0)
  bundle.set(iv, salt.length)
  bundle.set(encryptedBytes, salt.length + iv.length)
  
  return new Blob([bundle], { type: 'application/octet-stream' })
}

export async function importEncryptedJson(file, password) {
  if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 5MB)')
  
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  
  if (bytes.length < 28) throw new Error('Invalid encrypted file')
  
  const salt = bytes.slice(0, 16)
  const iv = bytes.slice(16, 28)
  const data = bytes.slice(28)
  
  try {
    const key = await getCryptoKey(password, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    const decoder = new TextDecoder()
    const jsonStr = decoder.decode(decrypted)
    
    const jsonBlob = new Blob([jsonStr], { type: 'application/json' })
    await importJson(jsonBlob)
  } catch (e) {
    throw new Error('Incorrect password or corrupted file')
  }
}

