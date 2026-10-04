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
      expect(formatMoney(999999999999, 'INR')).toContain('99,99,99,99,999')
    })
  })
})
