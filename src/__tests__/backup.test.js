import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { importJson, exportCsv, exportJson, exportEncryptedJson, importEncryptedJson } from '../lib/backup'
import { db } from '../lib/db'
import Dexie from 'dexie'
import 'fake-indexeddb/auto'

describe('Backup & Export Safety', () => {
  beforeEach(async () => {
    // Clear in-memory db before tests
    await db.settings.clear()
    await db.expenses.clear()
    await db.cycles.clear()
  })

  // Mock crypto since it's not available in JSDOM/Vitest by default
  beforeAll(async () => {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
      const { webcrypto } = await import('node:crypto')
      globalThis.crypto = webcrypto
    }
  })

  describe('CSV Export Formula Injection Guard', () => {
    it('escapes cells starting with =, +, -, or @', async () => {
      await db.expenses.add({ amount: 1000, categoryId: '=cmd|/c', note: '+something', date: '2026-10-04', createdAt: 123 })
      await db.expenses.add({ amount: 500, categoryId: 'food', note: '-500', date: '2026-10-05', createdAt: 124 })
      await db.expenses.add({ amount: 200, categoryId: 'other', note: '@test', date: '2026-10-06', createdAt: 125 })
      
      const blob = await exportCsv()
      const text = await blob.text()
      const lines = text.split('\n')
      
      // Line 0 is header
      expect(lines[1]).toContain(`'=cmd|/c`)
      expect(lines[1]).toContain(`'+something`)
      expect(lines[2]).toContain(`'-500`)
      expect(lines[3]).toContain(`'@test`)
    })
  })

  describe('JSON Import Validation', () => {
    const mockFile = (content, size = 1000) => ({
      size,
      text: async () => content
    })

    it('rejects files larger than 5MB', async () => {
      const file = mockFile('{}', 6 * 1024 * 1024)
      await expect(importJson(file)).rejects.toThrow('File too large')
    })

    it('rejects invalid JSON', async () => {
      const file = mockFile('{ bad json }')
      await expect(importJson(file)).rejects.toThrow('Invalid JSON format')
    })

    it('rejects missing version', async () => {
      const file = mockFile(JSON.stringify({ expenses: [] }))
      await expect(importJson(file)).rejects.toThrow('Missing backup version field')
    })

    it('rejects invalid expense amounts (e.g. floats, negatives, strings)', async () => {
      const payloads = [
        { version: 1, expenses: [{ amount: -10, categoryId: 'a', note: '', date: '2026-10-04' }] },
        { version: 1, expenses: [{ amount: 10.5, categoryId: 'a', note: '', date: '2026-10-04' }] },
        { version: 1, expenses: [{ amount: '100', categoryId: 'a', note: '', date: '2026-10-04' }] },
      ]
      
      for (const p of payloads) {
        await expect(importJson(mockFile(JSON.stringify(p)))).rejects.toThrow('expenses[0].amount is invalid')
      }
    })

    it('rejects invalid dates (e.g. malformed or non-existent)', async () => {
      const payloads = [
        { version: 1, expenses: [{ amount: 10, categoryId: 'a', note: '', date: '2026-13-01' }] }, // bad month
        { version: 1, expenses: [{ amount: 10, categoryId: 'a', note: '', date: '2026-02-30' }] }, // bad day
        { version: 1, expenses: [{ amount: 10, categoryId: 'a', note: '', date: '10-04-2026' }] }, // bad format
      ]
      
      for (const p of payloads) {
        await expect(importJson(mockFile(JSON.stringify(p)))).rejects.toThrow('expenses[0].date is not a valid date')
      }
    })

    it('rejects massive strings to prevent memory exhaustion', async () => {
      const hugeString = 'a'.repeat(2000)
      const payload = { version: 1, expenses: [{ amount: 10, categoryId: 'a', note: hugeString, date: '2026-10-04' }] }
      await expect(importJson(mockFile(JSON.stringify(payload)))).rejects.toThrow('expenses[0].note is invalid')
    })

    it('successfully imports valid data in a single transaction', async () => {
      const payload = {
        version: 1,
        settings: [{ key: 'theme', value: 'dark' }, { key: 'cycleDay', value: 'last' }],
        expenses: [{ amount: 1000, categoryId: 'food', note: 'lunch', date: '2026-10-04', createdAt: 123 }],
        cycles: [{ startDate: '2026-10-01', income: 50000, extras: [] }]
      }
      
      await importJson(mockFile(JSON.stringify(payload)))
      
      const theme = await db.settings.get('theme')
      expect(theme.value).toBe('dark')
      
      const exps = await db.expenses.toArray()
      expect(exps.length).toBe(1)
      expect(exps[0].amount).toBe(1000)
    })

    it('rejects invalid cycleDay settings', async () => {
      const payloads = [
        { version: 1, settings: [{ key: 'cycleDay', value: 32 }] },
        { version: 1, settings: [{ key: 'cycleDay', value: 0 }] },
        { version: 1, settings: [{ key: 'cycleDay', value: 'first' }] },
        { version: 1, settings: [{ key: 'cycleDay', value: 15.5 }] }
      ]
      for (const p of payloads) {
        await expect(importJson(mockFile(JSON.stringify(p)))).rejects.toThrow('settings[0] (cycleDay): Invalid cycleDay setting')
      }
    })

    it('accepts valid cycleDay settings (1-31 and last)', async () => {
      const payloads = [
        { version: 1, settings: [{ key: 'cycleDay', value: 1 }] },
        { version: 1, settings: [{ key: 'cycleDay', value: 31 }] },
        { version: 1, settings: [{ key: 'cycleDay', value: 'last' }] }
      ]
      for (const p of payloads) {
        await importJson(mockFile(JSON.stringify(p)))
        expect(await db.settings.get('cycleDay')).toBeDefined()
      }
    })
  })

  describe('Round-Trip JSON Export/Import', () => {
    it('exports and imports identical data successfully', async () => {
      // Setup initial data
      await db.settings.put({ key: 'cycleDay', value: 15 })
      await db.expenses.add({ amount: 500, categoryId: 'test', note: 'test', date: '2026-10-10', createdAt: 100 })
      await db.cycles.add({ startDate: '2026-10-01', income: 1000, extras: [] })

      // Export
      const blob = await exportJson()
      const text = await blob.text()

      // Clear DB
      await db.settings.clear()
      await db.expenses.clear()
      await db.cycles.clear()

      // Import
      await importJson({ size: text.length, text: async () => text })

      // Verify
      const s = await db.settings.get('cycleDay')
      expect(s.value).toBe(15)

      const e = await db.expenses.toArray()
      expect(e.length).toBe(1)
      expect(e[0].amount).toBe(500)

      const c = await db.cycles.toArray()
      expect(c.length).toBe(1)
      expect(c[0].income).toBe(1000)
    })

    it('exports and imports identical data successfully including all complex fields', async () => {
      // Setup initial data with ALL fields
      await db.settings.put({ key: 'cycleDay', value: 'last' })
      await db.settings.put({ key: 'openingSavings', value: 1000 })
      await db.settings.put({ key: 'categories', value: [{ id: 'c1', name: 'Cat1', emoji: '🐱' }] })
      await db.settings.put({ key: 'pin', value: { hash: 'abc', salt: '123', iterations: 1000 } })

      await db.expenses.add({ amount: 500, categoryId: 'c1', note: 'test', date: '2026-10-10', createdAt: 100 })
      await db.cycles.add({ startDate: '2026-10-01', income: 1000, extras: [{ amount: 200, date: '2026-10-02', note: 'bonus' }] })

      // Export
      const blob = await exportJson()
      const text = await blob.text()

      // Clear DB
      await db.settings.clear()
      await db.expenses.clear()
      await db.cycles.clear()

      // Import
      await importJson({ size: text.length, text: async () => text })

      // Verify settings
      const cycleDay = await db.settings.get('cycleDay')
      expect(cycleDay.value).toBe('last')

      const openingSavings = await db.settings.get('openingSavings')
      expect(openingSavings.value).toBe(1000)

      const categories = await db.settings.get('categories')
      expect(categories.value[0].name).toBe('Cat1')

      // PIN should NOT be exported in plain JSON
      const pin = await db.settings.get('pin')
      expect(pin).toBeUndefined()

      // Expenses
      const e = await db.expenses.toArray()
      expect(e.length).toBe(1)
      expect(e[0].amount).toBe(500)
      expect(e[0].note).toBe('test')

      // Cycles
      const c = await db.cycles.toArray()
      expect(c.length).toBe(1)
      expect(c[0].extras.length).toBe(1)
      expect(c[0].extras[0].amount).toBe(200)
      expect(c[0].extras[0].note).toBe('bonus')
    })

    it('exports and imports identical data successfully including encrypted JSON', async () => {
      // Setup initial data with ALL fields
      await db.settings.put({ key: 'cycleDay', value: 'last' })
      await db.settings.put({ key: 'openingSavings', value: 1000 })
      await db.settings.put({ key: 'categories', value: [{ id: 'c1', name: 'Cat1', emoji: '🐱' }] })
      await db.settings.put({ key: 'pin', value: { hash: 'abc', salt: '123', iterations: 1000 } })

      await db.expenses.add({ amount: 500, categoryId: 'c1', note: 'test', date: '2026-10-10', createdAt: 100 })
      await db.cycles.add({ startDate: '2026-10-01', income: 1000, extras: [{ amount: 200, date: '2026-10-02', note: 'bonus' }] })

      // Export Encrypted
      const password = 'my-secure-password'
      const blob = await exportEncryptedJson(password)
      const buffer = await blob.arrayBuffer()

      // Clear DB
      await db.settings.clear()
      await db.expenses.clear()
      await db.cycles.clear()

      // Import Encrypted
      await importEncryptedJson(new Blob([buffer], { type: 'application/octet-stream' }), password)

      // Verify settings
      const cycleDay = await db.settings.get('cycleDay')
      expect(cycleDay.value).toBe('last')

      const openingSavings = await db.settings.get('openingSavings')
      expect(openingSavings.value).toBe(1000)

      const categories = await db.settings.get('categories')
      expect(categories.value[0].name).toBe('Cat1')

      // PIN should NOT be exported
      const pin = await db.settings.get('pin')
      expect(pin).toBeUndefined()

      // Expenses
      const e = await db.expenses.toArray()
      expect(e.length).toBe(1)
      expect(e[0].amount).toBe(500)
      expect(e[0].note).toBe('test')

      // Cycles
      const c = await db.cycles.toArray()
      expect(c.length).toBe(1)
      expect(c[0].extras.length).toBe(1)
      expect(c[0].extras[0].amount).toBe(200)
      expect(c[0].extras[0].note).toBe('bonus')
    })
  })
})
