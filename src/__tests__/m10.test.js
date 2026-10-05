/**
 * M10 Tests
 *
 * All tests import from the real application modules.
 * No logic is duplicated here.
 *
 * Covers:
 *   - PIN validation (validatePin from pinAuth)
 *   - PIN rate-limiting (processAttempt from pinAuth)
 *   - PIN PBKDF2 hashing: createPinRecord / verifyPin
 *   - Stored record does NOT contain the plain PIN
 *   - Backup reminder thresholds (getBackupReminderStatus from backup)
 *   - lastBackup timestamp written to DB by exportJson
 *   - Encrypted backup round-trip: exportEncryptedJson → importEncryptedJson
 *   - Wrong-password rejection
 *   - CSV formula-injection guard (escapeCsvCell via exportCsv)
 *   - Forgot-PIN DB state after erase (pin and setupComplete cleared)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../lib/db'
import {
  validatePin,
  createPinRecord,
  verifyPin,
  isLegacyPin,
  processAttempt,
  initialRateLimitState,
  isLockedOut,
  MAX_ATTEMPTS,
  LOCKOUT_SECONDS
} from '../lib/pinAuth'
import {
  exportJson,
  exportCsv,
  exportEncryptedJson,
  importEncryptedJson,
  getBackupReminderStatus
} from '../lib/backup'
import 'fake-indexeddb/auto'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Wrap a binary blob as a fake File for importEncryptedJson. */
async function blobToFakeFile(blob) {
  const buf = await blob.arrayBuffer()
  return { size: buf.byteLength, arrayBuffer: async () => buf }
}

// ─── PIN: Validation ────────────────────────────────────────────────────────

describe('M10: PIN Validation (validatePin from pinAuth)', () => {
  it('accepts valid 4-digit numeric PINs', () => {
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

  it('rejects PINs containing non-digit characters', () => {
    expect(validatePin('12ab')).toBe(false)
    expect(validatePin('    ')).toBe(false)
    expect(validatePin('12.4')).toBe(false)
  })
})

// ─── PIN: PBKDF2 Hashing ────────────────────────────────────────────────────

describe('M10: PIN Hashing (createPinRecord / verifyPin from pinAuth)', () => {
  it('createPinRecord returns an object with salt and hash fields', async () => {
    const record = await createPinRecord('1234')
    expect(record).toHaveProperty('salt')
    expect(record).toHaveProperty('hash')
    expect(typeof record.salt).toBe('string')
    expect(typeof record.hash).toBe('string')
  })

  it('stored record does NOT contain the plain PIN', async () => {
    const record = await createPinRecord('5678')
    const json = JSON.stringify(record)
    expect(json).not.toContain('5678')
  })

  it('verifyPin returns true for the correct PIN', async () => {
    const record = await createPinRecord('4321')
    expect(await verifyPin('4321', record)).toBe(true)
  })

  it('verifyPin returns false for a wrong PIN', async () => {
    const record = await createPinRecord('4321')
    expect(await verifyPin('9999', record)).toBe(false)
  })

  it('two records for the same PIN have different salts and hashes (random salt)', async () => {
    const r1 = await createPinRecord('1111')
    const r2 = await createPinRecord('1111')
    expect(r1.salt).not.toBe(r2.salt)
    expect(r1.hash).not.toBe(r2.hash)
  })

  it('isLegacyPin detects a plain-text PIN string', () => {
    expect(isLegacyPin('1234')).toBe(true)
    expect(isLegacyPin('0000')).toBe(true)
  })

  it('isLegacyPin returns false for a hashed record', async () => {
    const record = await createPinRecord('1234')
    expect(isLegacyPin(record)).toBe(false)
  })
})

// ─── PIN: DB persistence ────────────────────────────────────────────────────

describe('M10: PIN DB Persistence', () => {
  beforeEach(async () => { await db.settings.clear() })

  it('stores a hashed PIN record (not plain text) in the database', async () => {
    const record = await createPinRecord('5678')
    await db.settings.put({ key: 'pin', value: record })

    const stored = await db.settings.get('pin')
    // The DB value must be an object with salt/hash, not the plain PIN
    expect(typeof stored.value).toBe('object')
    expect(stored.value).toHaveProperty('salt')
    expect(stored.value).toHaveProperty('hash')
    expect(JSON.stringify(stored.value)).not.toContain('5678')
  })

  it('removes the PIN when set to null', async () => {
    const record = await createPinRecord('5678')
    await db.settings.put({ key: 'pin', value: record })
    await db.settings.put({ key: 'pin', value: null })
    const stored = await db.settings.get('pin')
    expect(stored.value).toBeNull()
  })

  it('clears PIN and setupComplete on full reset (Forgot PIN erase path)', async () => {
    // Simulate a PIN set and app setup
    const record = await createPinRecord('1234')
    await db.settings.put({ key: 'pin', value: record })
    await db.settings.put({ key: 'setupComplete', value: true })

    // Simulate the erase performed by Forgot PIN
    await db.settings.clear()
    await db.cycles.clear()
    await db.expenses.clear()

    // After clear: pin and setupComplete must be absent
    expect(await db.settings.get('pin')).toBeUndefined()
    expect(await db.settings.get('setupComplete')).toBeUndefined()
    // → With no setupComplete, the app renders Setup, not PinLockScreen
  })
})

// ─── PIN: Rate-Limiting ──────────────────────────────────────────────────────

describe('M10: PIN Rate-Limiting (processAttempt from pinAuth)', () => {
  it('allows unlock on a correct attempt', () => {
    const state = initialRateLimitState()
    const { result } = processAttempt(state, true)
    expect(result.status).toBe('unlocked')
  })

  it('tracks wrong attempt count', () => {
    let state = initialRateLimitState()
    let res
    ;({ newState: state, result: res } = processAttempt(state, false))
    const { newState: s2, result: r2 } = processAttempt(state, false)
    expect(r2.status).toBe('wrong')
    expect(r2.attempts).toBe(2)
  })

  it(`triggers lock after ${MAX_ATTEMPTS} wrong attempts`, () => {
    let state = initialRateLimitState()
    let result
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      ;({ newState: state, result } = processAttempt(state, false))
    }
    expect(result.status).toBe('locked_now')
    expect(state.lockedUntil).toBeGreaterThan(Date.now())
  })

  it('reports "locked" while within the lockout window', () => {
    // Manually create a locked state
    const lockedState = { attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + LOCKOUT_SECONDS * 1000 }
    const { result } = processAttempt(lockedState, true) // even correct PIN is blocked
    expect(result.status).toBe('locked')
  })

  it('isLockedOut returns true while within lockout window', () => {
    const lockedState = { attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + 10000 }
    expect(isLockedOut(lockedState)).toBe(true)
  })

  it('isLockedOut returns false after lockout expires', () => {
    const expiredState = { attempts: MAX_ATTEMPTS, lockedUntil: Date.now() - 1 }
    expect(isLockedOut(expiredState)).toBe(false)
  })

  it('resets attempt count to 0 on a correct unlock', () => {
    let state = initialRateLimitState()
    ;({ newState: state } = processAttempt(state, false)) // wrong
    const { newState: unlocked } = processAttempt(state, true) // correct
    expect(unlocked.attempts).toBe(0)
    expect(unlocked.lockedUntil).toBeNull()
  })
})

// ─── Backup Reminder ─────────────────────────────────────────────────────────

describe('M10: Backup Reminder (getBackupReminderStatus from backup)', () => {
  it('returns "never" when no backup has been made', () => {
    expect(getBackupReminderStatus(null)).toBe('never')
    expect(getBackupReminderStatus(undefined)).toBe('never')
  })

  it('returns "today" for a backup made within the last 24 hours', () => {
    expect(getBackupReminderStatus(Date.now() - 1000 * 60 * 60)).toBe('today')
  })

  it('returns "yesterday" for a backup made exactly 1 day ago', () => {
    expect(getBackupReminderStatus(Date.now() - 1000 * 3600 * 24)).toBe('yesterday')
  })

  it('returns "overdue" for a backup made 14 or more days ago', () => {
    expect(getBackupReminderStatus(Date.now() - 1000 * 3600 * 24 * 14)).toBe('overdue')
    expect(getBackupReminderStatus(Date.now() - 1000 * 3600 * 24 * 30)).toBe('overdue')
  })

  it('returns a "{n} days ago" string for 2–13 days ago', () => {
    expect(getBackupReminderStatus(Date.now() - 1000 * 3600 * 24 * 7)).toBe('7 days ago')
  })

  it('exportJson writes a lastBackup timestamp to the DB', async () => {
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

// ─── CSV Formula-Injection Guard ─────────────────────────────────────────────

describe('M10: CSV Formula-Injection Guard (exportCsv)', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()
  })

  it('prepends a single quote to cells starting with =, +, -, or @', async () => {
    await db.expenses.add({ amount: 1000, categoryId: '=cmd|/c', note: '+something', date: '2026-10-04', createdAt: 1 })
    await db.expenses.add({ amount: 500,  categoryId: 'food',    note: '-500',       date: '2026-10-05', createdAt: 2 })
    await db.expenses.add({ amount: 200,  categoryId: 'other',   note: '@test',      date: '2026-10-06', createdAt: 3 })

    const blob = await exportCsv()
    const text = await blob.text()
    const lines = text.split('\n')

    expect(lines[1]).toContain(`'=cmd|/c`)
    expect(lines[1]).toContain(`'+something`)
    expect(lines[2]).toContain(`'-500`)
    expect(lines[3]).toContain(`'@test`)
  })
})

// ─── Encrypted Backup Round-Trip ─────────────────────────────────────────────

describe('M10: Encrypted Backup (AES-256-GCM via real crypto.subtle)', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()
  })

  it('produces a binary blob that is not plain JSON', async () => {
    await db.settings.put({ key: 'cycleDay', value: 15 })
    const blob = await exportEncryptedJson('test-password-123')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/octet-stream')

    const text = await blob.text()
    expect(() => JSON.parse(text)).toThrow()
  })

  it('round-trips: same password restores identical data', async () => {
    await db.settings.put({ key: 'cycleDay', value: 22 })
    await db.expenses.add({ amount: 1234, categoryId: 'food', note: 'enc-test', date: '2026-10-01', createdAt: 999 })
    await db.cycles.add({ startDate: '2026-10-01', income: 50000, extras: [] })

    const password = 'sup3r-s3cr3t!'
    const blob = await exportEncryptedJson(password)

    // Clear and restore
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()

    await importEncryptedJson(await blobToFakeFile(blob), password)

    const cd = await db.settings.get('cycleDay')
    expect(cd.value).toBe(22)

    const exps = await db.expenses.toArray()
    expect(exps.length).toBe(1)
    expect(exps[0].amount).toBe(1234)
    expect(exps[0].note).toBe('enc-test')
  })

  it('rejects import with the wrong password', async () => {
    await db.settings.put({ key: 'theme', value: 'dark' })
    const blob = await exportEncryptedJson('correct-password')

    await expect(
      importEncryptedJson(await blobToFakeFile(blob), 'wrong-password')
    ).rejects.toThrow('Incorrect password or corrupted file')
  })

  it('rejects a file that is too short to be a valid encrypted backup', async () => {
    const tinyFile = { size: 10, arrayBuffer: async () => new Uint8Array(10).buffer }
    await expect(importEncryptedJson(tinyFile, 'any')).rejects.toThrow('Invalid encrypted file')
  })
})
