import { db, initializeSettings } from './db'
import { getTodayStr } from './format'

const BACKUP_VERSION = 1
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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
  
  const backupSettings = settings.filter(s => s.key !== 'lastBackup').concat({ key: 'lastBackup', value: backupTime })
  
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
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('Invalid JSON format')
  }
  
  if (!data || !data.version) {
    throw new Error('Missing backup version field')
  }
  
  const { settings = [], expenses = [], cycles = [] } = data
  
  // Validate data strictly before touching DB
  const validSettings = settings.map(s => {
    if (!isSafeString(s.key, 100)) throw new Error('Invalid setting key')
    if (s.key === 'cycleDay') {
      if (s.value !== 'last' && (!Number.isInteger(s.value) || s.value < 1 || s.value > 31)) {
        throw new Error('Invalid cycleDay setting')
      }
    }
    if (s.key === 'categories') {
      if (!Array.isArray(s.value)) throw new Error('Invalid categories setting')
      s.value.forEach(c => {
        if (!c.id || typeof c.id !== 'string' || c.id.length > 50) throw new Error('Invalid category id')
        if (!c.name || typeof c.name !== 'string' || c.name.length > 24) throw new Error('Invalid category name')
        if (!c.emoji || typeof c.emoji !== 'string' || c.emoji.length > 10) throw new Error('Invalid category emoji')
      })
    }
    return { key: s.key, value: s.value }
  })
  
  const validExpenses = expenses.map(e => {
    if (!isSafeAmount(e.amount)) throw new Error('Invalid expense amount')
    if (!isValidDate(e.date)) throw new Error('Invalid expense date')
    if (!isSafeString(e.categoryId, 50)) throw new Error('Invalid category ID')
    if (!isSafeString(e.note, 1000)) throw new Error('Invalid note length')
    return {
      amount: e.amount,
      categoryId: e.categoryId,
      note: e.note,
      date: e.date,
      createdAt: Number.isSafeInteger(e.createdAt) ? e.createdAt : Date.now()
    }
  })
  
  const validCycles = cycles.map(c => {
    if (!isValidDate(c.startDate)) throw new Error('Invalid cycle start date')
    if (!isSafeAmount(c.income)) throw new Error('Invalid cycle income')
    
    let validExtras = []
    if (Array.isArray(c.extras)) {
      validExtras = c.extras.map(ex => {
        if (!isSafeAmount(ex.amount)) throw new Error('Invalid extra amount')
        if (!isValidDate(ex.date)) throw new Error('Invalid extra date')
        if (!isSafeString(ex.note, 500)) throw new Error('Invalid extra note')
        return { amount: ex.amount, date: ex.date, note: ex.note }
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

