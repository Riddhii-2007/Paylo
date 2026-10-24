import { describe, it, expect } from 'vitest'
import { toMinorUnits, formatMoney, toPaise } from '../lib/format'

describe('Format Logic', () => {
  describe('toMinorUnits / toPaise', () => {
    it('handles null, undefined, empty', () => {
      expect(toMinorUnits(null, 'INR')).toBe(0)
      expect(toMinorUnits(undefined, 'INR')).toBe(0)
      expect(toMinorUnits('', 'INR')).toBe(0)
      expect(toPaise(null)).toBe(0) // Legacy check
    })

    it('handles floating point math correctly (0.1 + 0.2)', () => {
      // 0.1 + 0.2 = 0.30000000000000004
      expect(toMinorUnits(0.1 + 0.2, 'INR')).toBe(30)
      expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30)
      expect(toMinorUnits(0.1 + 0.2, 'JPY')).toBe(0) // JPY has 0 fraction digits. 0.3 rounded is 0.
    })

    it('converts correctly for different currencies', () => {
      expect(toMinorUnits(1234.56, 'INR')).toBe(123456) // 2 decimals
      expect(toMinorUnits(1234.56, 'USD')).toBe(123456) // 2 decimals
      expect(toMinorUnits(1234.56, 'JPY')).toBe(1235) // 0 decimals
      expect(toMinorUnits(10.123, 'BHD')).toBe(10123) // BHD has 3 decimals!
    })
  })

  describe('formatMoney', () => {
    it('handles invalid inputs gracefully', () => {
      expect(formatMoney(NaN, 'INR')).toContain('0')
      expect(formatMoney(null, 'USD')).toContain('0')
    })

    it('formats INR with Indian digit grouping', () => {
      // 1 Lakh = 1,00,000
      expect(formatMoney(10000000, 'INR')).toContain('1,00,000') // 1,00,000.00
      expect(formatMoney(123456, 'INR')).toBe('₹1,234.56') 
      // If zero minor units, no fraction part
      expect(formatMoney(123400, 'INR')).toBe('₹1,234')
    })

    it('formats USD with standard US digit grouping', () => {
      // 100 thousand = 100,000
      expect(formatMoney(10000000, 'USD')).toBe('$100,000') 
      expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
    })

    it('formats JPY with no decimals', () => {
      expect(formatMoney(1234, 'JPY')).toBe('¥1,234')
    })

    it('formats custom non-ISO symbols correctly (defaults to 2 decimals)', () => {
      expect(formatMoney(123456, 'Points')).toBe('Points 1,234.56')
      expect(formatMoney(123400, 'Points')).toBe('Points 1,234')
      expect(toMinorUnits(1234.56, 'Points')).toBe(123456)
    })

    it('formats extremely large amounts correctly', () => {
      expect(formatMoney(999999999999, 'USD')).toBe('$9,999,999,999.99')
      expect(formatMoney(999999999999, 'INR')).toBe('₹9,99,99,99,999.99')
    })
  })

  describe('formatDate and parseLocalDate', () => {
    it('handles ISO timestamp strings without throwing Invalid time value', async () => {
      const { formatDate, parseLocalDate } = await import('../lib/format')
      const isoStr = '2026-10-24T10:18:31.000Z'
      expect(() => parseLocalDate(isoStr)).not.toThrow()
      expect(() => formatDate(isoStr)).not.toThrow()
      expect(formatDate(isoStr)).toContain('Oct 24')
    })

    it('handles standard YYYY-MM-DD date strings', async () => {
      const { formatDate } = await import('../lib/format')
      expect(formatDate('2026-05-15')).toContain('May 15')
    })
  })

  describe('getTimeGreeting', () => {
    it('returns appropriate greeting depending on the hour', async () => {
      const { getTimeGreeting } = await import('../lib/format')
      // Morning: < 12
      const morningDate = new Date(2026, 9, 24, 9, 0, 0)
      expect(getTimeGreeting(morningDate)).toBe('Good morning')

      // Afternoon: 12 <= hour < 17
      const afternoonDate = new Date(2026, 9, 24, 14, 0, 0)
      expect(getTimeGreeting(afternoonDate)).toBe('Good afternoon')

      // Evening: >= 17
      const eveningDate = new Date(2026, 9, 24, 19, 0, 0)
      expect(getTimeGreeting(eveningDate)).toBe('Good evening')
    })
  })
})

