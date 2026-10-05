/**
 * M10 Tests: PIN, Backup Reminder, and Encrypted Backup
 *
 * Covers:
 *   - PIN validation (set, wrong length, non-digits)
 *   - PIN rate-limiting logic (MAX_ATTEMPTS threshold)
 *   - Backup reminder threshold (14+ days = warning)
 *   - Encrypted backup round-trip (export → import with correct password)
 *   - Encrypted backup rejects wrong password
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '../lib/db'
import { exportJson, importJson, exportEncryptedJson, importEncryptedJson } from '../lib/backup'
import 'fake-indexeddb/auto'

// ─── helpers ────────────────────────────────────────────────────────────────

const mockJsonFile = (content, size = content.length) => ({
  size,
  text: async () => content,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
})

// PIN validation mirrors the logic in Settings.jsx / PinLockScreen.jsx
function validatePin(p) {
  return typeof p === 'string' && p.length === 4 && /^\d+$/.test(p)
}

// Rate-limit logic mirrors PinLockScreen.jsx constants
const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

function simulateAttempts(correctPin, guesses) {
  let attempts = 0
  let lockedUntil = null
  const results = []

  for (const guess of guesses) {
    if (lockedUntil && Date.now() < lockedUntil) {
      results.push({ status: 'locked', remaining: Math.ceil((lockedUntil - Date.now()) / 1000) })
      continue
    }

    if (guess === correctPin) {
      attempts = 0
      results.push({ status: 'unlocked' })
    } else {
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000
        results.push({ status: 'locked_now', attempts })
      } else {
        results.push({ status: 'wrong', attempts })
      }
    }
  }
  return results
}

// ─── Backup reminder ─────────────────────────────────────────────────────────

function getBackupWarning(lastBackupTimestamp) {
  if (!lastBackupTimestamp) return 'never'
  const daysAgo = Math.floor((Date.now() - lastBackupTimestamp) / (1000 * 3600 * 24))
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  if (daysAgo >= 14) return 'overdue'
  return `${daysAgo} days ago`
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('M10: PIN Lock', () => {
  describe('PIN validation', () => {
    it('accepts a valid 4-digit numeric PIN', () => {
      expect(validatePin('1234')).toBe(true)
      expect(validatePin('0000')).toBe(true)
      expect(validatePin('9999')).toBe(true)
    })

    it('rejects PINs shorter than 4 digits', () => {
      expect(validatePin('123')).toBe(false)
      expect(validatePin('')).toBe(false)
    })

    it('rejects PINs longer than 4 digits', () => {
      expect(validatePin('12345')).toBe(false)
    })

    it('rejects non-digit PINs', () => {
      expect(validatePin('12ab')).toBe(false)
      expect(validatePin('    ')).toBe(false)
      expect(validatePin('12.4')).toBe(false)
    })
  })

  describe('PIN rate-limiting', () => {
    it('allows unlock on correct PIN', () => {
      const results = simulateAttempts('4321', ['4321'])
      expect(results[0].status).toBe('unlocked')
    })

    it('tracks wrong attempt count', () => {
      const results = simulateAttempts('4321', ['1111', '2222'])
      expect(results[0].status).toBe('wrong')
      expect(results[0].attempts).toBe(1)
      expect(results[1].status).toBe('wrong')
      expect(results[1].attempts).toBe(2)
    })

    it(`locks after ${MAX_ATTEMPTS} wrong attempts`, () => {
      const results = simulateAttempts('4321', ['1111', '2222', '3333'])
      expect(results[2].status).toBe('locked_now')
    })

    it('blocks further attempts while locked', () => {
      const guesses = Array(MAX_ATTEMPTS).fill('0000').concat(['4321'])
      const results = simulateAttempts('4321', guesses)
      // Last guess is the correct PIN but should be blocked
      expect(results[results.length - 1].status).toBe('locked')
    })

    it('resets attempt count after a correct unlock', () => {
      const results = simulateAttempts('4321', ['0000', '0000', '4321', '0000'])
      // After a correct unlock, the counter resets; next wrong is attempt 1
      expect(results[2].status).toBe('unlocked')
      expect(results[3].status).toBe('wrong')
      expect(results[3].attempts).toBe(1)
    })
  })

  describe('PIN persistence in DB', () => {
    beforeEach(async () => {
      await db.settings.clear()
    })

    it('stores a PIN in the database', async () => {
      await db.settings.put({ key: 'pin', value: '5678' })
      const record = await db.settings.get('pin')
      expect(record.value).toBe('5678')
    })

    it('removes the PIN when set to null', async () => {
      await db.settings.put({ key: 'pin', value: '5678' })
      await db.settings.put({ key: 'pin', value: null })
      const record = await db.settings.get('pin')
      expect(record.value).toBeNull()
    })

    it('clears PIN on full reset', async () => {
      await db.settings.put({ key: 'pin', value: '1234' })
      await db.settings.clear()
      expect(await db.settings.get('pin')).toBeUndefined()
    })
  })
})

// ─── Backup Reminder ─────────────────────────────────────────────────────────

describe('M10: Backup Reminder', () => {
  it('returns "never" when no backup has been made', () => {
    expect(getBackupWarning(null)).toBe('never')
    expect(getBackupWarning(undefined)).toBe('never')
  })

  it('returns "today" for a backup made within the last 24 hours', () => {
    expect(getBackupWarning(Date.now() - 1000 * 60 * 60)).toBe('today')
  })

  it('returns "yesterday" for a backup made 1 day ago', () => {
    expect(getBackupWarning(Date.now() - 1000 * 3600 * 24 * 1)).toBe('yesterday')
  })

  it('returns "overdue" for a backup made 14+ days ago', () => {
    expect(getBackupWarning(Date.now() - 1000 * 3600 * 24 * 14)).toBe('overdue')
    expect(getBackupWarning(Date.now() - 1000 * 3600 * 24 * 30)).toBe('overdue')
  })

  it('returns a day count for 2–13 days ago', () => {
    expect(getBackupWarning(Date.now() - 1000 * 3600 * 24 * 7)).toBe('7 days ago')
  })

  it('stores lastBackup timestamp in DB after export', async () => {
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()

    await exportJson()

    const record = await db.settings.get('lastBackup')
    expect(record).toBeDefined()
    expect(typeof record.value).toBe('number')
    expect(record.value).toBeGreaterThan(0)
  })
})

// ─── Encrypted Backup ─────────────────────────────────────────────────────────

describe('M10: Encrypted Backup Round-Trip', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()
  })

  it('exports an encrypted backup (binary blob, not plain JSON)', async () => {
    await db.settings.put({ key: 'cycleDay', value: 15 })

    const blob = await exportEncryptedJson('test-password-123')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/octet-stream')

    // Must NOT be plain JSON
    const text = await blob.text()
    expect(() => JSON.parse(text)).toThrow()
  })

  it('encrypts with a password and imports with the same password', async () => {
    // Seed data
    await db.settings.put({ key: 'cycleDay', value: 22 })
    await db.expenses.add({ amount: 1234, categoryId: 'food', note: 'enc-test', date: '2026-10-01', createdAt: 999 })
    await db.cycles.add({ startDate: '2026-10-01', income: 50000, extras: [] })

    const password = 'sup3r-s3cr3t!'

    // Export
    const blob = await exportEncryptedJson(password)

    // Clear DB
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()

    // Import
    const buffer = await blob.arrayBuffer()
    const encFile = {
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    }
    await importEncryptedJson(encFile, password)

    // Verify
    const cd = await db.settings.get('cycleDay')
    expect(cd.value).toBe(22)

    const exps = await db.expenses.toArray()
    expect(exps.length).toBe(1)
    expect(exps[0].amount).toBe(1234)
    expect(exps[0].note).toBe('enc-test')
  })

  it('rejects decryption with the wrong password', async () => {
    await db.settings.put({ key: 'theme', value: 'dark' })

    const blob = await exportEncryptedJson('correct-password')
    const buffer = await blob.arrayBuffer()
    const encFile = {
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    }

    await expect(importEncryptedJson(encFile, 'wrong-password')).rejects.toThrow(
      'Incorrect password or corrupted file'
    )
  })

  it('rejects a file that is too short to be a valid encrypted backup', async () => {
    const tinyFile = {
      size: 10,
      arrayBuffer: async () => new Uint8Array(10).buffer,
    }

    await expect(importEncryptedJson(tinyFile, 'any')).rejects.toThrow('Invalid encrypted file')
  })
})
